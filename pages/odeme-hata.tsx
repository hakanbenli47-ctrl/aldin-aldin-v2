// /pages/odeme-hata.tsx
import Link from "next/link";

export default function OdemeHata() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "#fff5f5"
    }}>
      <h1 style={{ color: "#dc2626", fontSize: "28px", fontWeight: "bold" }}>
        ❌ Ödemeniz Başarısız Oldu
      </h1>
      <p style={{ marginTop: 12, fontSize: "18px", color: "#334155" }}>
        İşlem sırasında bir hata oluştu. Lütfen tekrar deneyiniz.
      </p>
      <Link href="/sepet2">
        <button style={{
          marginTop: 24,
          padding: "10px 20px",
          background: "#dc2626",
          color: "#fff",
          borderRadius: "6px",
          fontSize: "16px",
          cursor: "pointer",
          border: "none"
        }}>
          Tekrar Dene
        </button>
      </Link>
    </div>
  );
}
