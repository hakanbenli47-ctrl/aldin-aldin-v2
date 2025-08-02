import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("❌ Giriş başarısız: " + error.message);
    } else if (data.user) {
      setMessage("✅ Giriş başarılı! Yönlendiriliyorsunuz...");

      // Kullanıcının seçtiği rolü localStorage'dan oku
      const rol = localStorage.getItem("selectedRole");

      setTimeout(() => {
        if (rol === "satici") {
          router.push("/");      // Satıcı için ana index sayfası
        } else if (rol === "alici") {
          router.push("/index2"); // Alıcı için index2 sayfası
        } else {
          // Rol seçilmemişse default anasayfa
          router.push("/");
        }
      }, 1000);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f4f4f6 0%, #e6e8ec 100%)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 4px 16px #e1e3e8",
          padding: 36,
          minWidth: 350,
        }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#223555",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Giriş Yap
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            name="email"
            type="email"
            placeholder="E-posta"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 18,
              border: "1px solid #bbb",
              borderRadius: 8,
              fontSize: 15,
              background: "#f8fafc",
              color: "#222",
            }}
          />
          <input
            name="password"
            type="password"
            placeholder="Şifre"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 18,
              border: "1px solid #bbb",
              borderRadius: 8,
              fontSize: 15,
              background: "#f8fafc",
              color: "#222",
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              background: "#2563eb",
              color: "#fff",
              padding: 12,
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 12,
              cursor: "pointer",
            }}
          >
            Giriş Yap
          </button>
        </form>

        {message && <p style={{ color: "black" }}>{message}</p>}

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a
            href="/kayit"
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Kaydol
          </a>
        </div>
      </div>
    </div>
  );
}
