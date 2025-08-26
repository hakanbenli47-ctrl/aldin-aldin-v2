// /components/DopingModal.tsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  ilan: { id: number; title: string };
  onClose: () => void;
  onSuccess: () => void;
};

// Paket tanımları (fiyat / gün)
const PAKETLER = {
  gunluk:   { label: "1 Günlük",  price: 10, days: 1 },
  haftalik: { label: "1 Haftalık", price: 30, days: 7 },
  aylik:    { label: "1 Aylık",    price: 75, days: 30 },
} as const;
type PaketKey = keyof typeof PAKETLER;

export default function DopingModal({ ilan, onClose, onSuccess }: Props) {
  const [paket, setPaket] = useState<PaketKey | null>(null);

  // kart bilgileri
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvc: "" });
  const [submitting, setSubmitting] = useState(false);

  // ödeme için kullanıcı bilgisi
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      setUserEmail((u?.email as string) || "");
      setUserId((u?.id as string) || "");
    });
  }, []);

  const amount = paket ? PAKETLER[paket].price : 0;

  // basit format yardımcıları
  const fmtNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const fmtExpiry = (v: string) => {
    const raw = v.replace(/\D/g, "").slice(0, 4);
    if (raw.length <= 2) return raw;
    return `${raw.slice(0, 2)}/${raw.slice(2)}`;
  };

  async function handleOdeVeOnaCikar() {
    if (!paket) return alert("Lütfen bir paket seçin.");
    const numRaw = card.number.replace(/\s/g, "");
    if (!card.name || numRaw.length !== 16 || !/^\d{2}\/\d{2}$/.test(card.expiry) || card.cvc.length < 3) {
      alert("Kart bilgilerini eksiksiz girin.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Ödeme isteği
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payRaw",
          amount,
          card: {
            name_on_card: card.name,
            card_number: numRaw,
            expiry: card.expiry, // MM/YY
            cvv: card.cvc,
          },
          buyer: {
            id: userId || `seller-${userEmail}`,
            name: userEmail?.split("@")[0] || "Seller",
            surname: "Seller",
            email: userEmail || "test@example.com",
            gsmNumber: "+905555555555",
          },
          address: {
            address: "Feature",
            city: "Istanbul",
            country: "Turkey",
            postal_code: "",
          },
          basketItems: [
            {
              id: `feature-${ilan.id}`,
              name: `Öne Çıkar (${PAKETLER[paket].label}) - #${ilan.id}`,
              category1: "Feature",
              price: amount,
            },
          ],
        }),
      });

      // 2) Response'u güvenli çöz (boş/HTML gelirse JSON hatası vermesin)
      const text = await res.text();
      let payJson: any = null;
      try { payJson = JSON.parse(text); } catch { /* no-op */ }

      if (!res.ok || !payJson || payJson.success !== true) {
        const msg = payJson?.message || text || "Ödeme sırasında beklenmeyen bir hata.";
        alert("💳 Ödeme başarısız: " + msg);
        setSubmitting(false);
        return;
      }

      // 3) Supabase: doped + doped_expiration
      const until = new Date();
      until.setDate(until.getDate() + PAKETLER[paket].days);

      const { error } = await supabase
        .from("ilan")
        .update({
          doped: true,
          doped_expiration: until.toISOString(),
        })
        .eq("id", ilan.id);

      if (error) {
        alert("Ödeme alındı fakat ilan işaretlenemedi: " + error.message);
        setSubmitting(false);
        return;
      }

      alert("✅ Ödeme alındı ve ilan öne çıkarıldı.");
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert("Ödeme sırasında hata: " + (e?.message || "Bilinmeyen hata"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0008",
      display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 24, width: 420,
        boxShadow: "0 12px 28px rgba(0,0,0,0.18)"
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 16, textAlign: "center" }}>
          🚀 “{ilan.title}” ilanını öne çıkar
        </h2>

        {/* Paketler */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {(["gunluk","haftalik","aylik"] as PaketKey[]).map((k) => (
            <label key={k} style={{
              padding: 10, background: "#f3f4f6", borderRadius: 8,
              border: "1px solid #d1d5db", display: "flex", justifyContent: "space-between",
              alignItems: "center", fontWeight: 700
            }}>
              <span>
                <input
                  type="radio"
                  checked={paket === k}
                  onChange={() => setPaket(k)}
                  style={{ marginRight: 10 }}
                />
                {PAKETLER[k].label}
              </span>
              <span>{PAKETLER[k].price} ₺</span>
            </label>
          ))}
        </div>

        {/* Kart bilgileri */}
        <input
          placeholder="Kart Sahibi"
          value={card.name}
          onChange={(e) => setCard({ ...card, name: e.target.value })}
          style={inp}
        />
        <input
          placeholder="Kart Numarası (16 hane)"
          value={card.number}
          onChange={(e) => setCard({ ...card, number: fmtNumber(e.target.value) })}
          style={inp}
          inputMode="numeric"
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="SKT (AA/YY)"
            value={card.expiry}
            onChange={(e) => setCard({ ...card, expiry: fmtExpiry(e.target.value) })}
            style={{ ...inp, flex: 1 }}
            inputMode="numeric"
          />
          <input
            placeholder="CVC"
            value={card.cvc}
            onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            style={{ ...inp, flex: 1 }}
            inputMode="numeric"
          />
        </div>

        {/* Özet */}
        <div style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
          Seçilen paket: <b>{paket ? PAKETLER[paket].label : "-"}</b>{" "}
          — Tutar: <b>{paket ? `${PAKETLER[paket].price} ₺` : "-"}</b>
        </div>

        <button
          onClick={handleOdeVeOnaCikar}
          disabled={!paket || submitting}
          style={{
            width: "100%", background: "#13c09a", color: "#fff", padding: 12,
            fontWeight: 800, borderRadius: 8, fontSize: 16, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", marginTop: 14, opacity: submitting ? 0.8 : 1
          }}
        >
          {submitting ? "Ödeniyor..." : "Öde ve Öne Çıkar"}
        </button>

        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            width: "100%", marginTop: 10, background: "#e5e7eb", padding: 11,
            borderRadius: 8, fontWeight: 700, fontSize: 15, border: "none",
            color: "#111827", cursor: submitting ? "not-allowed" : "pointer"
          }}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  marginBottom: 10,
  padding: 11,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 15,
};
