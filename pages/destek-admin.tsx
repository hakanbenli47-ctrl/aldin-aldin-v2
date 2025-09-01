import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

const DESTEK_EMAILS = ["destek80bir@gmail.com"]; // buraya destek personeli maillerini ekle

type Sohbet = {
  id: number;
  kullanici_email: string;
  status: string;
};

type Mesaj = {
  id: number;
  sohbet_id: number;
  gonderen_email: string | null;
  mesaj_metni: string;
  gonderilme_tarihi: string | null;
  rol: "kullanici" | "destek";
};

export default function DestekAdmin() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [sohbetler, setSohbetler] = useState<Sohbet[]>([]);
  const [selectedChat, setSelectedChat] = useState<Sohbet | null>(null);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    setTimeout(() => {
      boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
    }, 50);

  // Yetki kontrolü
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

  // Sohbet listesini çek
  const fetchSohbetler = async () => {
    const { data, error } = await supabase
      .from("destek_sohbetleri")
      .select("id, kullanici_email, status")
      .order("baslangic_tarihi", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setSohbetler(data || []);
  };

  // Mesajları çek
  const fetchMesajlar = async (chatId: number) => {
    const { data, error } = await supabase
      .from("destek_mesajlari")
      .select("*")
      .eq("sohbet_id", chatId)
      .order("gonderilme_tarihi", { ascending: true });

    if (!error) {
      setMesajlar((data as Mesaj[]) || []);
      scrollToBottom();
    }
  };

  // Sohbet aç
  const openChat = async (sohbet: Sohbet) => {
    setSelectedChat(sohbet);

    // Eski kanalı kapat
    if (chanRef.current) {
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }

    // Sohbeti active yap
    await supabase.from("destek_sohbetleri").update({ status: "active" }).eq("id", sohbet.id);

    await fetchMesajlar(sohbet.id);

    // Realtime dinleme
    const ch = supabase
      .channel(`realtime-destek-${sohbet.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "destek_mesajlari", filter: `sohbet_id=eq.${sohbet.id}` },
        (payload) => {
          setMesajlar((prev) => [...prev, payload.new as Mesaj]);
          scrollToBottom();
        }
      )
      .subscribe();

    chanRef.current = ch;
  };

  // Mesaj gönder
  const gonder = async () => {
    if (!yeniMesaj.trim() || !selectedChat || !me) return;

    const { error } = await supabase.from("destek_mesajlari").insert({
      sohbet_id: selectedChat.id,
      gonderen_email: me.email,
      mesaj_metni: yeniMesaj.trim(),
      rol: "destek",
    });

    if (!error) setYeniMesaj("");
    else console.error(error);
  };

  // Kanaldan çık
  const kanaldanCik = () => {
    if (chanRef.current) {
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
    setSelectedChat(null);
    setMesajlar([]);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "20px auto", display: "flex", gap: 20 }}>
      {/* SOL: sohbet listesi */}
      <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3>📋 Sohbetler</h3>
        {sohbetler.map((s) => (
          <div
            key={s.id}
            onClick={() => openChat(s)}
            style={{
              borderBottom: "1px solid #eee",
              padding: 8,
              cursor: "pointer",
              background: selectedChat?.id === s.id ? "#f3f4f6" : "transparent",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <b>{s.kullanici_email}</b>
            <span style={{ color: "#6b7280" }}>{s.status || "pending"}</span>
          </div>
        ))}
      </div>

      {/* SAĞ: mesaj paneli */}
      <div style={{ flex: 2, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>💬 Sohbet</h3>
          {selectedChat && (
            <button
              onClick={kanaldanCik}
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 700 }}
            >
              Kanaldan Çık
            </button>
          )}
        </div>

        {selectedChat ? (
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
