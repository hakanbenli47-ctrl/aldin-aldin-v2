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
  gunluk:   { label: "1 Günlük",  price: 500,  days: 1 },
  haftalik: { label: "1 Haftalık", price: 800,  days: 7 },
  aylik:    { label: "1 Aylık",    price: 1250, days: 30 },
} as const;
type PaketKey = keyof typeof PAKETLER;

export default function DopingModal({ ilan, onClose, onSuccess }: Props) {
  const [paket, setPaket] = useState<PaketKey | null>(null);

  // sadece bilgi amaçlı state'ler
  const [submitting, setSubmitting] = useState(false);

  // ödeme için kullanıcı bilgisi
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId,    setUserId]    = useState<string>("");

  // promosyon kodu
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      setUserEmail((u?.email as string) || "");
      setUserId((u?.id as string) || "");
    });
  }, []);

  const amount = paket ? PAKETLER[paket].price : 0;

  async function handleOdeVeOnaCikar() {
    if (!paket) return alert("Lütfen bir paket seçin.");

    // ✅ Promosyon kodu: FREEWEEK → 7 gün ücretsiz
    if (promoCode.trim().toUpperCase() === "FREEWEEK") {
      const until = new Date();
      until.setDate(until.getDate() + 7);

      const { error } = await supabase
        .from("ilan")
        .update({ doped: true, doped_expiration: until.toISOString() })
        .eq("id", ilan.id);

      if (error) {
        alert("Ücretsiz öne çıkarma sırasında hata: " + error.message);
        return;
      }

      alert("✅ Promosyon kodu ile ilan 1 hafta ücretsiz öne çıkarıldı!");
      onSuccess();
      onClose();
      return; // ödeme yok
    }

    // ---- PayTR ile ödeme akışı ----
    setSubmitting(true);
    try {
      // PayTR sepeti (tek satır: seçilen paket)
      const itemName = `Öne Çıkar (${PAKETLER[paket].label}) - #${ilan.id}`;
      const paytrBasket: [string, number, number][] = [[itemName, amount, 1]];

      // (opsiyonel) raporlama için okunur format
      const basketItems = [{
        id: `feature-${ilan.id}`,
        name: itemName,
        category1: "Feature",
        unitPrice: amount,
        quantity: 1,
        price: amount,
      }];

      const res = await fetch("/api/paytr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          user_id: userId || `seller-${userEmail}`,
          email: userEmail || "seller@example.com",
          // PayTR zorunlu alanları için basit adres bilgisi
          address: {
            address: "Feature Purchase",
            city: "Istanbul",
            country: "Turkey",
            postal_code: "",
          },
          paytrBasket,   // PayTR'in beklediği format
          basketItems,   // sizin raporlamanız için
          // callback tarafında ilan/paket ayırt edebilmek için meta
          meta: {
            type: "feature",
            ilanId: ilan.id,
            paket: paket,
            days: PAKETLER[paket].days,
            title: ilan.title,
          },
        }),
      });

      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { /* ignore */ }

      if (!res.ok || !data?.success || !data?.token) {
        const msg = data?.message || text || "Ödeme başlatılırken beklenmeyen bir hata.";
        alert("💳 Ödeme başlatılamadı: " + msg);
        setSubmitting(false);
        return;
      }

      // ✅ PayTR güvenli ödeme sayfasına yönlendir
      window.location.href = `https://www.paytr.com/odeme/guvenli/${data.token}`;

      // Not: Ödeme başarılı olduğunda PayTR -> callback_url’inize bildirim gönderir.
      // O callback’te:
      //  - ilan.doped = true
      //  - ilan.doped_expiration = now + PAKETLER[paket].days
      //  - log/kayıt/fiş işlemleri
      // yapmanızı öneririz.
    } catch (e: any) {
      console.error(e);
      alert("Ödeme servisine ulaşılamadı: " + (e?.message || "Bilinmeyen hata"));
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

        {/* Promosyon kodu */}
        <input
          placeholder="Promosyon Kodu (opsiyonel)"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          style={inp}
        />

        {/* Bilgilendirme: Kart PayTR sayfasında girilecek */}
        <div style={{
          background: "#ecfeff",
          border: "1px solid #a5f3fc",
          color: "#0c4a6e",
          borderRadius: 8,
          padding: 10,
          fontSize: 14,
          marginBottom: 8
        }}>
          Kart bilgileri PayTR’in güvenli sayfasında girilecektir. Bu pencerede kart bilgisi istemiyoruz.
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
          {submitting ? "Yönlendiriliyor..." : "Öde ve Öne Çıkar"}
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
