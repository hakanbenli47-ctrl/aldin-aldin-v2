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
    setTimeout(() => kutuRef.current?.scrollTo(0, kutuRef.current.scrollHeight), 50);

  // Açılışta localStorage MIGRASYON + yükleme
  useEffect(() => {
    let em: string | null = null;
    let chatId: number | null = null;

    // email
    const savedEmail = localStorage.getItem("destekEmail");
    if (savedEmail) {
      try { em = JSON.parse(savedEmail); } catch {}
    }

    // chatId (eski sürümde obje saklanmış olabilir)
    const savedChat = localStorage.getItem("destekChat");
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        if (typeof parsed === "number") {
          chatId = parsed;
        } else if (parsed && typeof parsed === "object") {
          chatId = parsed.sohbetId ?? parsed.id ?? null;
          if (!em && parsed.userEmail) em = parsed.userEmail;
          if (parsed.status === "active" || parsed.status === "pending") setStatus(parsed.status);
        }
      } catch {}
    }

    // Normalize et ve bağlan
    if (em && chatId) {
      setUserEmail(em);
      setSohbetId(chatId);
      localStorage.setItem("destekEmail", JSON.stringify(em));
      localStorage.setItem("destekChat", JSON.stringify(chatId)); // 🔧 artık sadece sayı
      subscribeRealtime(chatId);
      fetchMesajlar(chatId);
    }

    return () => { if (chanRef.current) supabase.removeChannel(chanRef.current); };
  }, []);

  // Realtime kanal
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
      // destek status güncellemesi
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "destek_sohbetleri", filter: `id=eq.${chatId}` },
        (payload) => {
          if ((payload.new as any)?.status) setStatus((payload.new as any).status);
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

    // sohbet kaydı (tek satır)
    const { data: sohbetData, error } = await supabase
      .from("destek_sohbetleri")
      .insert({ kullanici_email: em, status: "pending" })
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
    localStorage.setItem("destekChat", JSON.stringify(sohbetData.id)); // 🔧 sayı olarak yaz

    subscribeRealtime(sohbetData.id);

    // ilk bilgilendirme mesajı
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
      sohbet_id: sohbetId,           // ✅ BIGINT doğru tip
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

  // e-posta formu
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

  // sohbet ekranı
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
      </div>
    </div>
  );
}
