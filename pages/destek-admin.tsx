import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

const DESTEK_EMAILS = ["destek80bir@gmail.com"];

export default function DestekAdmin() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sohbetler, setSohbetler] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [mesajlar, setMesajlar] = useState<any[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const currentUser = data?.user;
      if (!currentUser) {
        router.push("/giris");
        return;
      }
      if (!currentUser.email || !DESTEK_EMAILS.includes(currentUser.email.toLowerCase())) {
        router.push("/");
        return;
      }
      setUser(currentUser);
      fetchSohbetler();
    });
  }, []);

  const fetchSohbetler = async () => {
    const { data } = await supabase
      .from("destek_sohbetleri")
      .select("kullanici_email, status")
      .order("gonderilme_tarihi", { ascending: false });

    // unique kullanıcı listesi
    const unique = Array.from(new Map((data || []).map((s) => [s.kullanici_email, s])).values());
    setSohbetler(unique);
  };

  const fetchMesajlar = async (email: string) => {
    const { data } = await supabase
      .from("destek_sohbetleri")
      .select("*")
      .eq("kullanici_email", email)
      .order("gonderilme_tarihi", { ascending: true });
    setMesajlar(data || []);
  };

  const sohbetiBaslat = async (email: string) => {
    setSelectedEmail(email);

    await supabase.from("destek_sohbetleri").update({ status: "active" }).eq("kullanici_email", email);
    await fetchMesajlar(email);

    supabase
      .channel(`realtime-destek-${email}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "destek_sohbetleri",
          filter: `kullanici_email=eq.${email}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMesajlar((prev) => [...prev, row]);
        }
      )
      .subscribe();
  };

  const gonder = async () => {
    if (!yeniMesaj.trim() || !selectedEmail || !user) return;

    await supabase.from("destek_sohbetleri").insert({
      kullanici_email: selectedEmail,
      gonderen_email: user.email,
      mesaj_metni: yeniMesaj.trim(),
      rol: "destek",
      status: "active",
    });

    setYeniMesaj("");
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", display: "flex", gap: 20 }}>
      <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3>📋 Sohbetler</h3>
        {sohbetler.map((s) => (
          <div
            key={s.kullanici_email}
            style={{
              borderBottom: "1px solid #eee",
              padding: 8,
              cursor: "pointer",
              background: selectedEmail === s.kullanici_email ? "#f3f4f6" : "transparent",
            }}
            onClick={() => sohbetiBaslat(s.kullanici_email)}
          >
            <b>{s.kullanici_email}</b> — {s.status}
          </div>
        ))}
      </div>

      <div style={{ flex: 2, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3>💬 Sohbet</h3>
        {selectedEmail ? (
          <>
            <div style={{ height: 400, overflowY: "auto", marginBottom: 10 }}>
              {mesajlar.map((m) => (
                <div
                  key={m.id}
                  style={{
                    textAlign: m.rol === "destek" ? "right" : "left",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: m.rol === "destek" ? "#dbeafe" : "#f3f4f6",
                    }}
                  >
                    {m.mesaj_metni}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={yeniMesaj}
                onChange={(e) => setYeniMesaj(e.target.value)}
                placeholder="Mesajınızı yazın…"
                style={{ flex: 1, padding: 8 }}
              />
              <button
                onClick={gonder}
                style={{
                  padding: "8px 14px",
                  background: "#1648b0",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                }}
              >
                Gönder
              </button>
            </div>
          </>
        ) : (
          <p>Bir sohbet seçin.</p>
        )}
      </div>
    </div>
  );
}
