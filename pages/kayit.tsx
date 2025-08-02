import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Kayit() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      setMessage("❌ Lütfen tüm alanları doldurun!");
      return;
    }

    // ✅ Supabase ile kullanıcı oluştur
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage("❌ Kayıt başarısız: " + error.message);
      return;
    }

    // ✅ Başarılı kayıt
    setMessage(
      "✅ Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın ve giriş yapın."
    );

    // 2 saniye sonra giriş sayfasına yönlendirelim
    setTimeout(() => {
      window.location.href = "/giris";
    }, 2000);
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
          Kayıt Ol
        </h2>

        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              background: "#12b76a",
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
            Kayıt Ol
          </button>
        </form>

        {message && (
          <div
            style={{
              color: message.includes("✅") ? "#12b76a" : "#e23c3c",
              textAlign: "center",
              marginTop: 10,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
