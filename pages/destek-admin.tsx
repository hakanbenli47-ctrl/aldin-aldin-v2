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
    }, 50);

  // Yetki + ilk yük
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

  // Sol liste: tek tablodan benzersiz mail
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

  // Sağ panel: geçmiş mesajlar (admin tarafında dursun)
  const fetchMesajlar = async (email: string) => {
    const { data, error } = await supabase
      .from("destek_sohbetleri")
      .select("*")
      .eq("kullanici_email", email)
      .order("gonderilme_tarihi", { ascending: true });

    if (!error) {
      setMesajlar((data || []) as Row[]);
      scrollToBottom();
    }
  };

  // Sohbet seç
  const openChat = async (email: string) => {
    setSelectedEmail(email);

    // Eski kanal varsa kapat
    if (chanRef.current) {
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }

    // Kullanıcıya katıldığımızı göster
    await supabase.from("destek_sohbetleri").update({ status: "active" }).eq("kullanici_email", email);

    await fetchMesajlar(email);

    // Realtime dinleme
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

  // Mesaj gönder
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

  // Kanal kapatma
  const kanaldanCik = () => {
    if (chanRef.current) {
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
    setSelectedEmail(null);
    setMesajlar([]);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "20px auto", display: "flex", gap: 20 }}>
      {/* SOL: sohbetler */}
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
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <b>{s.kullanici_email}</b>
            <span style={{ color: "#6b7280" }}>{s.status || "pending"}</span>
          </div>
        ))}
      </div>

      {/* SAĞ: mesajlar */}
      <div style={{ flex: 2, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>💬 Sohbet</h3>
          {selectedEmail && (
            <button
              onClick={kanaldanCik}
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 700 }}
            >
              Kanaldan Çık
            </button>
          )}
        </div>

        {selectedEmail ? (
          <>
            <div ref={boxRef} style={{ height: 430, overflowY: "auto", marginBottom: 10, paddingRight: 4 }}>
              {mesajlar.map((m) => (
                <div key={m.id} style={{ textAlign: m.rol === "destek" ? "right" : "left", marginBottom: 8 }}>
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
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
              />
              <button
                onClick={gonder}
                style={{ padding: "10px 16px", background: "#1648b0", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700 }}
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
