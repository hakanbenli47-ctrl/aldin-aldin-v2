import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

const DESTEK_EMAILS = ["destek80bir@gmail.com"];

type Row = {
  id: number;
  kullanici_email: string;
  gonderen_email: string | null;
  mesaj_metni: string;
  gonderilme_tarihi: string | null;
  rol: "kullanici" | "destek";
  status?: "pending" | "active";
};

export default function DestekAdmin() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [sohbetler, setSohbetler] = useState<{ kullanici_email: string; status: string }[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [mesajlar, setMesajlar] = useState<Row[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    setTimeout(() => {
      boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
    }, 60);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (!u) return router.push("/giris");
      if (!u.email || !DESTEK_EMAILS.includes(u.email.toLowerCase())) return router.push("/");
      setMe(u);
      fetchSohbetler();
    });

    return () => {
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, []);

  // soldaki liste (tek tablo – kullanıcıya göre uniq)
  const fetchSohbetler = async () => {
    const { data, error } = await supabase
      .from("destek_sohbetleri")
      .select("kullanici_email, status, gonderilme_tarihi")
      .order("gonderilme_tarihi", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    const unique = Array.from(new Map((data || []).map((r: any) => [r.kullanici_email, r])).values());
    setSohbetler(unique as any);
  };

  // seçilen sohbetin geçmişini yükle (admin tarafında dursun)
  const fetchMesajlar = async (email: string) => {
    const { data, error } = await supabase
      .from("destek_sohbetleri")
      .select("*")
      .eq("kullanici_email", email)
      .order("gonderilme_tarihi", { ascending: true });

    if (!error) setMesajlar((data || []) as Row[]);
  };

  // e-posta satırına tıklayınca
  const openChat = async (email: string) => {
    setSelectedEmail(email);

    // eski kanalı kapat
    if (chanRef.current) {
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }

    // kullanıcıya “katıldı” bilgisini ilet
    await supabase.from("destek_sohbetleri").update({ status: "active" }).eq("kullanici_email", email);

    await fetchMesajlar(email);
    scrollToBottom();

    // realtime dinleme
    const ch = supabase
      .channel(`realtime-destek-${email}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "destek_sohbetleri", filter: `kullanici_email=eq.${email}` },
        (payload) => {
          setMesajlar((prev) => [...prev, payload.new as Row]);
          scrollToBottom();
        }
      )
      .subscribe();

    chanRef.current = ch;
  };

  // mesaj gönder
  const gonder = async () => {
    if (!yeniMesaj.trim() || !selectedEmail || !me) return;

    const { error } = await supabase.from("destek_sohbetleri").insert({
      kullanici_email: selectedEmail,
      gonderen_email: me.email,
      mesaj_metni: yeniMesaj.trim(),
      rol: "destek",
      status: "active",
    });

    if (!error) setYeniMesaj("");
    else console.error(error);
  };

  // admin için kanal kapatma
  const kanaliKapat = () => {
    if (chanRef.current) {
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", display: "flex", gap: 20 }}>
      {/* sol sütun: sohbetler */}
      <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3>📋 Sohbetler</h3>
        {sohbetler.map((s) => (
          <div
            key={s.kullanici_email}
            onClick={() => openChat(s.kullanici_email)}
            style={{
              borderBottom: "1px solid #eee",
              padding: 8,
              cursor: "pointer",
              background: selectedEmail === s.kullanici_email ? "#f3f4f6" : "transparent",
            }}
          >
            <b>{s.kullanici_email}</b> — {s.status}
          </div>
        ))}
      </div>

      {/* sağ sütun: mesajlar */}
      <div style={{ flex: 2, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>💬 Sohbet</h3>
          {selectedEmail && (
            <button
              onClick={kanaliKapat}
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}
            >
              Kanaldan Çık
            </button>
          )}
        </div>

        {selectedEmail ? (
          <>
            <div ref={boxRef} style={{ height: 400, overflowY: "auto", marginBottom: 10 }}>
              {mesajlar.map((m) => (
                <div key={m.id} style={{ textAlign: m.rol === "destek" ? "right" : "left", marginBottom: 6 }}>
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
