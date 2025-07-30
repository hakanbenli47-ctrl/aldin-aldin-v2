import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  ilan: {
    id: number;
    title: string;
  };
  onClose: () => void;
  onSuccess: () => void;
};

export default function DopingModal({ ilan, onClose, onSuccess }: Props) {
  const [paket, setPaket] = useState<"gunluk" | "haftalik" | "aylik" | null>(null);
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvc: "" });

  const handleOdeVeOnaCikar = async () => {
    if (!paket) return alert("Lütfen bir paket seçin");

    const now = new Date();
    if (paket === "gunluk") now.setDate(now.getDate() + 1);
    if (paket === "haftalik") now.setDate(now.getDate() + 7);
    if (paket === "aylik") now.setMonth(now.getMonth() + 1);

    const { error } = await supabase
      .from("ilan")
      .update({
        doped: true,
        doped_expiration: now.toISOString(),
      })
      .eq("id", ilan.id);

    if (error) {
      alert("Bir hata oluştu: " + error.message);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "#00000088", display: "flex", justifyContent: "center",
      alignItems: "center", zIndex: 1000, fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 30, width: 400,
        boxShadow: "0 4px 18px rgba(0,0,0,0.15)", fontFamily: "inherit"
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", marginBottom: 24, textAlign: "center" }}>
          🚀 “{ilan.title}” ilanını öne çıkar
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <label style={{ padding: 12, background: "#f3f4f6", borderRadius: 8, fontSize: 17, color: "#1f2937", border: "1px solid #d1d5db", fontWeight: 600 }}>
            <input type="radio" checked={paket === "gunluk"} onChange={() => setPaket("gunluk")} style={{ marginRight: 10 }} /> 1 Günlük – 10₺
          </label>
          <label style={{ padding: 12, background: "#f3f4f6", borderRadius: 8, fontSize: 17, color: "#1f2937", border: "1px solid #d1d5db", fontWeight: 600 }}>
            <input type="radio" checked={paket === "haftalik"} onChange={() => setPaket("haftalik")} style={{ marginRight: 10 }} /> 1 Haftalık – 30₺
          </label>
          <label style={{ padding: 12, background: "#f3f4f6", borderRadius: 8, fontSize: 17, color: "#1f2937", border: "1px solid #d1d5db", fontWeight: 600 }}>
            <input type="radio" checked={paket === "aylik"} onChange={() => setPaket("aylik")} style={{ marginRight: 10 }} /> 1 Aylık – 75₺
          </label>
        </div>

        <input placeholder="Kart Sahibi" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} style={{ width: "100%", marginBottom: 12, padding: 12, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 16 }} />
        <input placeholder="Kart Numarası" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} style={{ width: "100%", marginBottom: 12, padding: 12, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 16 }} inputMode="numeric" pattern="[0-9]*" />
        <input placeholder="Son Kullanma (AA/YY)" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} style={{ width: "100%", marginBottom: 12, padding: 12, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 16 }} inputMode="numeric" pattern="[0-9/]*" />
        <input placeholder="CVC" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} style={{ width: "100%", marginBottom: 20, padding: 12, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 16 }} inputMode="numeric" pattern="[0-9]*" />

        <button onClick={handleOdeVeOnaCikar} style={{ width: "100%", background: "#13c09a", color: "#fff", padding: 14, fontWeight: 700, borderRadius: 8, fontSize: 17, border: "none", cursor: "pointer" }}>
          Öde ve Öne Çıkar
        </button>
        <button onClick={onClose} style={{ width: "100%", marginTop: 12, background: "#e5e7eb", padding: 12, borderRadius: 8, fontWeight: 600, fontSize: 16, border: "none", color: "#111827", cursor: "pointer" }}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}
