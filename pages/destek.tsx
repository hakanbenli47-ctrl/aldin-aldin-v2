import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Mesaj = {
  id: number;
  kullanici_email: string;
  gonderen_email: string;
  mesaj_metni: string;
  gonderilme_tarihi: string;
  rol: "kullanici" | "destek";
};

export default function Destek() {
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [emailInput, setEmailInput] = useState("");
  const [status, setStatus] = useState<"pending" | "active">("pending");
  const kutuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    setTimeout(() => {
      kutuRef.current?.scrollTo(0, kutuRef.current.scrollHeight);
    }, 80);

  // Sohbet başlat
  const baslatSohbet = async () => {
    if (!emailInput.trim()) {
      alert("Lütfen e-posta adresinizi girin.");
      return;
    }

    setUserEmail(emailInput);

    // İlk mesaj boş sohbet olarak insert ediliyor
    const { error } = await supabase.from("destek_sohbetleri").insert([
      {
        kullanici_email: emailInput,
        gonderen_email: emailInput,
        mesaj_metni: "🆕 Sohbet başlatıldı",
        rol: "kullanici",
        status: "pending",
      },
    ]);

    if (error) {
      console.error(error);
      alert("Sohbet başlatılamadı.");
      return;
    }

    setStatus("pending");

    // Realtime dinleme
    supabase
      .channel(`realtime-destek-${emailInput}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "destek_sohbetleri",
          filter: `kullanici_email=eq.${emailInput}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMesajlar((prev) => [...prev, row]);
          scrollToBottom();
        }
      )
      .subscribe();
  };

  // Mesaj gönder
  const gonder = async () => {
    if (!yeniMesaj.trim() || !userEmail) return;

    await supabase.from("destek_sohbetleri").insert({
      kullanici_email: userEmail,
      gonderen_email: userEmail,
      mesaj_metni: yeniMesaj.trim(),
      rol: "kullanici",
      status,
    });

    setYeniMesaj("");
  };

  if (!userEmail) {
    return (
      <div style={{ maxWidth: 400, margin: "40px auto", textAlign: "center" }}>
        <h2 style={{ marginBottom: 20, color: "#1648b0" }}>💬 Canlı Destek Başlat</h2>
        <input
          type="email"
          placeholder="E-posta adresiniz"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            marginBottom: 12,
          }}
        />
        <button
          onClick={baslatSohbet}
          style={{
            background: "#1648b0",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 16px",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Sohbeti Başlat
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "20px auto", padding: 16 }}>
      <h2 style={{ color: "#1648b0", marginBottom: 8 }}>💬 Canlı Destek</h2>
      <div
        ref={kutuRef}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          height: 420,
          overflowY: "auto",
          padding: 12,
          background: "#f9fafb",
          marginBottom: 12,
        }}
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
          style={{
            background: "#1648b0",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 16px",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Gönder
        </button>
      </div>
    </div>
  );
}
