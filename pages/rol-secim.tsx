import { useRouter } from "next/router";

export default function RolSecim() {
  const router = useRouter();

  const handleSelect = (rol: "alici" | "satici") => {
    localStorage.setItem("selectedRole", rol);
    router.push("/giris");
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 24,
      background: "#f9fafb",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      padding: 20,
    }}>
      <h2 style={{
        fontSize: 28, fontWeight: "700", color: "#111111", marginBottom: 8,
      }}>
        Ne yapmak istediğinizi seçin
      </h2>
      <p style={{
        color: "#444444", fontSize: 16, marginBottom: 24, maxWidth: 360, textAlign: "center", lineHeight: 1.4,
      }}>
        Lütfen alıcı mı yoksa satıcı mı olduğunuzu seçiniz. Seçiminize göre yönlendirileceksiniz.
      </p>
      <button
        style={{
          padding: "14px 28px", fontSize: 18, borderRadius: 10, border: "2px solid #94a3b8",
          backgroundColor: "white", color: "#475569", cursor: "pointer", width: 240,
          transition: "all 0.25s ease", boxShadow: "0 2px 8px rgb(148 163 184 / 0.2)",
        }}
        onClick={() => handleSelect("alici")}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#e0e7ff";
          (e.currentTarget as HTMLButtonElement).style.color = "#3730a3";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#3730a3";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white";
          (e.currentTarget as HTMLButtonElement).style.color = "#475569";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8";
        }}
      >
        Alıcıyım
      </button>
      <button
        style={{
          padding: "14px 28px", fontSize: 18, borderRadius: 10, border: "2px solid #94a3b8",
          backgroundColor: "white", color: "#475569", cursor: "pointer", width: 240,
          transition: "all 0.25s ease", boxShadow: "0 2px 8px rgb(148 163 184 / 0.2)",
        }}
        onClick={() => handleSelect("satici")}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#e0f2fe";
          (e.currentTarget as HTMLButtonElement).style.color = "#0369a1";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#0369a1";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white";
          (e.currentTarget as HTMLButtonElement).style.color = "#475569";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8";
        }}
      >
        Satıcıyım
      </button>
    </div>
  );
}
