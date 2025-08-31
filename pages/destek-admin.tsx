// pages/destek-admin.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

const DESTEK_EMAILS = ["destek80bir@gmail.com"];

export default function DestekAdmin() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sohbetler, setSohbetler] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [mesajlar, setMesajlar] = useState<any[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const [iban, setIban] = useState<string | null>(null); // <<< EKLENDİ

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
      .select("*")
      .order("baslangic_tarihi", { ascending: false });
    setSohbetler(data || []);
  };

  const fetchMesajlar = async (chatId: number) => {
    const { data } = await supabase
      .from("destek_mesajlari")
      .select("*")
      .eq("sohbet_id", chatId)
      .order("gonderilme_tarihi", { ascending: true });
    setMesajlar(data || []);
  };

  // <<< EKLENDİ: IBAN'ı son başvurudan çek
  const fetchIban = async (email: string) => {
    if (!email) {
      setIban(null);
      return;
    }
    const { data, error } = await supabase
      .from("satici_basvuru")
      .select("iban")
      .eq("user_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("IBAN çekilemedi:", error.message);
      setIban(null);
      return;
    }
    setIban(data?.iban ?? null);
  };

  const sohbetiBaslat = async (chat: any) => {
    setSelectedChat(chat);
    await supabase
      .from("destek_sohbetleri")
      .update({ status: "active" })
      .eq("id", chat.id);
    await fetchMesajlar(chat.id);
    await fetchIban(chat.kullanici_email); // <<< EKLENDİ
  };

  const gonder = async () => {
    if (!yeniMesaj.trim() || !selectedChat) return;
    await supabase.from("destek_mesajlari").insert({
      sohbet_id: selectedChat.id,
      gonderen_email: user.email,
      mesaj_metni: yeniMesaj.trim(),
      rol: "destek",
    });
    setYeniMesaj("");
    await fetchMesajlar(selectedChat.id);
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", display: "flex", gap: 20 }}>
      <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3>📋 Sohbetler</h3>
        {sohbetler.map((s) => (
          <div
            key={s.id}
            style={{
              borderBottom: "1px solid #eee",
              padding: 8,
              cursor: "pointer",
              background: selectedChat?.id === s.id ? "#f3f4f6" : "transparent",
            }}
            onClick={() => sohbetiBaslat(s)}
          >
            <b>{s.kullanici_email}</b> — {s.status}
          </div>
        ))}
      </div>

      <div style={{ flex: 2, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3>💬 Sohbet</h3>
        {selectedChat ? (
          <>
            {/* IBAN satırı - sadece gösterim */}
            <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>
              <b>IBAN:</b> {iban ?? "—"}
            </div>

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
              <button onClick={gonder} style={{ padding: "8px 14px", background: "#1648b0", color: "#fff", border: "none", borderRadius: 6 }}>
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
