// /pages/odeme-basarili.tsx
import Link from "next/link";

export default function OdemeBasarili() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "#f0fff4"
    }}>
      <h1 style={{ color: "#16a34a", fontSize: "28px", fontWeight: "bold" }}>
        ✅ Ödemeniz Başarıyla Tamamlandı!
      </h1>
      <p style={{ marginTop: 12, fontSize: "18px", color: "#334155" }}>
        Siparişiniz hazırlanıyor. Teşekkür ederiz 🙏
      </p>
      <Link href="/profil">
        <button style={{
          marginTop: 24,
          padding: "10px 20px",
          background: "#16a34a",
          color: "#fff",
          borderRadius: "6px",
          fontSize: "16px",
          cursor: "pointer",
          border: "none"
        }}>
          Profilime Git
        </button>
      </Link>
    </div>
  );
}
