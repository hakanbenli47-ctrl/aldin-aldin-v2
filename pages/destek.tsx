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
  const [loading, setLoading] = useState(false);

  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const kutuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    setTimeout(() => kutuRef.current?.scrollTo(0, kutuRef.current.scrollHeight), 40);

  // ---- Realtime ----
  function subscribeRealtime(chatId: number) {
    if (chanRef.current) supabase.removeChannel(chanRef.current);

    const ch = supabase
      .channel(`realtime-destek-${chatId}`)
      // yeni mesajlar
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "destek_mesajlari", filter: `sohbet_id=eq.${chatId}` },
        (payload) => {
          setMesajlar((prev) => [...prev, payload.new as Mesaj]);
          scrollToBottom();
        }
      )
      // admin “active” yapınca statüyü güncelle
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "destek_sohbetleri", filter: `id=eq.${chatId}` },
        (payload) => {
          const st = (payload.new as any)?.status;
          if (st === "active" || st === "pending") setStatus(st);
        }
      )
      .subscribe();

    chanRef.current = ch;
  }

  // ---- İlk yük + localStorage göçü ----
  useEffect(() => {
    let em: string | null = null;
    let chatId: number | null = null;

    try {
      const savedEmail = localStorage.getItem("destekEmail");
      if (savedEmail) em = JSON.parse(savedEmail);
    } catch {}
    try {
      const savedChat = localStorage.getItem("destekChat");
      if (savedChat) {
        const parsed = JSON.parse(savedChat);
        chatId = typeof parsed === "number" ? parsed : (parsed?.id ?? parsed?.sohbetId ?? null);
      }
    } catch {}

    if (em && chatId) {
      setUserEmail(em);
      setSohbetId(chatId);
      localStorage.setItem("destekEmail", JSON.stringify(em));
      localStorage.setItem("destekChat", JSON.stringify(chatId)); // sadece sayı sakla
      subscribeRealtime(chatId);
      fetchMesajlar(chatId);
    }

    return () => { if (chanRef.current) supabase.removeChannel(chanRef.current); };
  }, []);

  // ---- Mesajları çek ----
  async function fetchMesajlar(chatId: number) {
    const { data, error } = await supabase
      .from("destek_mesajlari")
      .select("*")
      .eq("sohbet_id", chatId)
      .order("gonderilme_tarihi", { ascending: true });

    if (!error) setMesajlar((data ?? []) as Mesaj[]);
  }

  // ---- Sohbet başlat ----
  const baslatSohbet = async () => {
    const em = emailInput.trim();
    if (!em) return alert("Lütfen e-posta adresinizi girin.");

    setLoading(true);
    const { data: sohbetData, error } = await supabase
      .from("destek_sohbetleri")
      .insert({ kullanici_email: em, status: "pending" })
      .select("id")
      .single();

    setLoading(false);

    if (error || !sohbetData) {
      console.error(error);
      return alert("Sohbet başlatılamadı.");
    }

    const chatId = Number(sohbetData.id);
    setUserEmail(em);
    setSohbetId(chatId);
    localStorage.setItem("destekEmail", JSON.stringify(em));
    localStorage.setItem("destekChat", JSON.stringify(chatId));

    subscribeRealtime(chatId);

    // ilk bilgilendirme mesajı
    await supabase.from("destek_mesajlari").insert({
      sohbet_id: chatId,                 // FK → destek_sohbetleri.id
      gonderen_email: em,
      mesaj_metni: "🆕 Sohbet başlatıldı",
      rol: "kullanici",
    });

    await fetchMesajlar(chatId);
  };

  // ---- Mesaj gönder ----
  const gonder = async () => {
    if (!yeniMesaj.trim() || !userEmail || !sohbetId) return;

    const { error } = await supabase.from("destek_mesajlari").insert({
      sohbet_id: Number(sohbetId),
      gonderen_email: userEmail,
      mesaj_metni: yeniMesaj.trim(),
      rol: "kullanici",
    });

    if (error) {
      console.error(error);
      return alert("Mesaj gönderilemedi: " + error.message);
    }
    setYeniMesaj("");
  };

  const resetChat = () => {
    localStorage.removeItem("destekEmail");
    localStorage.removeItem("destekChat");
    if (chanRef.current) supabase.removeChannel(chanRef.current);
    setUserEmail("");
    setSohbetId(null);
    setMesajlar([]);
    setEmailInput("");
    setStatus("pending");
  };

  // ---- UI ----
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
          disabled={loading}
          style={{ background: "#1648b0", color: "#fff", borderRadius: 8, padding: "10px 16px", border: "none", fontWeight: 600, cursor: "pointer", width: "100%", opacity: loading ? .7 : 1 }}
        >
          {loading ? "Başlatılıyor…" : "Sohbeti Başlat"}
        </button>
      </div>
    );
  }

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

        {status === "pending" && (
          <div style={{ textAlign: "center", color: "#999", marginTop: 10 }}>
            🔔 Destek ekibinin sohbete katılması bekleniyor...
          </div>
        )}
        {status === "active" && (
          <div style={{ textAlign: "center", color: "green", marginTop: 10 }}>
            ✅ Destek ekibi sohbete katıldı.
          </div>
        )}
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
        <button onClick={resetChat} title="Sohbeti sıfırla" style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "10px 12px" }}>
          ↺
        </button>
      </div>
    </div>
  );
}
