import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Mesaj = {
  id: number;
  sohbet_id: number;
  gonderen_email: string | null;
  mesaj_metni: string;
  gonderilme_tarihi: string | null;
  rol: "kullanici" | "destek";
};

export default function Destek() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [emailInput, setEmailInput] = useState("");
  const [sohbetId, setSohbetId] = useState<number | null>(null);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const [status, setStatus] = useState<"pending" | "active">("pending");
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const kutuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    setTimeout(() => {
      kutuRef.current?.scrollTo(0, kutuRef.current.scrollHeight);
    }, 50);

  // Açılışta varsa e-postayı ve sohbeti geri yükle
  useEffect(() => {
    const saved = localStorage.getItem("destekEmail");
    const savedChat = localStorage.getItem("destekChat");
    if (saved && savedChat) {
      const em = JSON.parse(saved) as string;
      const chatId = JSON.parse(savedChat) as number;
      setUserEmail(em);
      setSohbetId(chatId);
      subscribeRealtime(chatId);
      fetchMesajlar(chatId);
    }
    return () => {
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, []);

  // Realtime kanal
  function subscribeRealtime(chatId: number) {
    if (chanRef.current) supabase.removeChannel(chanRef.current);

    const ch = supabase
      .channel(`realtime-destek-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "destek_mesajlari", filter: `sohbet_id=eq.${chatId}` },
        (payload) => {
          setMesajlar((prev) => [...prev, payload.new as Mesaj]);
          scrollToBottom();
        }
      )
      .subscribe();

    chanRef.current = ch;
  }

  // Mesajları çek
  async function fetchMesajlar(chatId: number) {
    const { data } = await supabase
      .from("destek_mesajlari")
      .select("*")
      .eq("sohbet_id", chatId)
      .order("gonderilme_tarihi", { ascending: true });
    setMesajlar((data as Mesaj[]) || []);
  }

  // Sohbet başlat
  const baslatSohbet = async () => {
    const em = emailInput.trim();
    if (!em) {
      alert("Lütfen e-posta adresinizi girin.");
      return;
    }

    // Sohbet aç
    const { data: sohbetData, error } = await supabase
      .from("destek_sohbetleri")
      .insert({
        kullanici_email: em,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !sohbetData) {
      console.error(error);
      alert("Sohbet başlatılamadı.");
      return;
    }

    setUserEmail(em);
    setSohbetId(sohbetData.id);
    localStorage.setItem("destekEmail", JSON.stringify(em));
    localStorage.setItem("destekChat", JSON.stringify(sohbetData.id));

    subscribeRealtime(sohbetData.id);

    // İlk mesaj (bilgilendirme)
    await supabase.from("destek_mesajlari").insert({
      sohbet_id: sohbetData.id,
      gonderen_email: em,
      mesaj_metni: "🆕 Sohbet başlatıldı",
      rol: "kullanici",
    });
  };

  // Mesaj gönder
  const gonder = async () => {
    if (!yeniMesaj.trim() || !userEmail || !sohbetId) return;

    const { error } = await supabase.from("destek_mesajlari").insert({
      sohbet_id: sohbetId,
      gonderen_email: userEmail,
      mesaj_metni: yeniMesaj.trim(),
      rol: "kullanici",
    });

    if (!error) setYeniMesaj("");
    else {
      console.error(error);
      alert("Mesaj gönderilemedi: " + error.message);
    }
  };

  // E-posta formu
  if (!userEmail || !sohbetId) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
        <h2 style={{ marginBottom: 18, color: "#1648b0" }}>💬 Canlı Destek Başlat</h2>
        <input
          type="email"
          placeholder="E-posta adresiniz"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 12 }}
        />
        <button
          onClick={baslatSohbet}
          style={{ background: "#1648b0", color: "#fff", borderRadius: 8, padding: "10px 16px", border: "none", fontWeight: 600, cursor: "pointer", width: "100%" }}
        >
          Sohbeti Başlat
        </button>
      </div>
    );
  }

  // Sohbet ekranı
  return (
    <div style={{ maxWidth: 680, margin: "20px auto", padding: 16 }}>
      <h2 style={{ color: "#1648b0", marginBottom: 8 }}>💬 Canlı Destek</h2>

      <div
        ref={kutuRef}
        style={{ border: "1px solid #e5e7eb", borderRadius: 10, height: 420, overflowY: "auto", padding: 12, background: "#f9fafb", marginBottom: 12 }}
      >
        {mesajlar.map((m) => (
          <div key={m.id} style={{ textAlign: m.rol === "kullanici" ? "right" : "left", marginBottom: 10 }}>
            <span
              style={{
                display: "inline-block",
                background: m.rol === "kullanici" ? "#dbeafe" : "#e5e7eb",
                padding: "8px 12px",
                borderRadius: 16,
                maxWidth: "75%",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.mesaj_metni}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={yeniMesaj}
          onChange={(e) => setYeniMesaj(e.target.value)}
          placeholder="Mesajınızı yazın…"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
        />
        <button
          onClick={gonder}
          style={{ background: "#1648b0", color: "#fff", borderRadius: 8, padding: "10px 16px", border: "none", fontWeight: 600, cursor: "pointer" }}
        >
          Gönder
        </button>
      </div>
    </div>
  );
}
