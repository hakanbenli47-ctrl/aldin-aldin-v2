import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const router = useRouter();

  // İlk adım: Şifre kontrolü
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("❌ Giriş başarısız: " + error.message);
      return;
    }

    const user = data.user;
    const confirmed = (user as any)?.confirmed_at ?? null;
    if (!confirmed) {
      setMessage("❗ Lütfen e-posta adresinizi doğrulayın (mailinizi kontrol edin).");
      return;
    }

    // Şifre doğru → OTP üret ve sakla
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem("login_otp", otp);

    // OTP'yi e-posta ile gönder
    try {
      const resp = await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "Giriş Doğrulama Kodu",
          text: `Giriş doğrulama kodunuz: ${otp}`,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Mail API hatası: ${resp.status}`);
      }

      setMessage("📩 Doğrulama kodu e-posta adresinize gönderildi.");
      setOtpStep(true);
    } catch (err: any) {
      console.error("OTP mail gönderme hatası:", err);
      setMessage("❌ Kod gönderilemedi, lütfen tekrar deneyin.");
    }
  }

  // İkinci adım: OTP doğrulama
  function handleOtpCheck(e: React.FormEvent) {
    e.preventDefault();
    const savedOtp = localStorage.getItem("login_otp");
    if (otpCode === savedOtp) {
      localStorage.removeItem("login_otp");
      setMessage("✅ Giriş başarılı! Yönlendiriliyorsunuz...");

      supabase.auth.getUser().then(({ data }) => {
        const role = (data.user?.user_metadata?.role as "alici" | "satici" | undefined) ?? undefined;
        setTimeout(() => {
          if (role === "satici") router.push("/");
          else router.push("/index2");
        }, 900);
      });
    } else {
      setMessage("❌ Kod yanlış!");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #f4f4f6 0%, #e6e8ec 100%)"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 4px 16px #e1e3e8",
        padding: 36,
        minWidth: 350
      }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#223555",
          textAlign: "center",
          marginBottom: 24
        }}>Giriş Yap</h2>

        {!otpStep ? (
          <form onSubmit={handlePasswordLogin}>
            <input
              name="email"
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
                color: "#222"
              }}
            />
            <input
              name="password"
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
                color: "#222"
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
                cursor: "pointer"
              }}
            >
              Giriş Yap
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpCheck}>
            <input
              type="text"
              placeholder="Doğrulama Kodu"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 18,
                border: "1px solid #bbb",
                borderRadius: 8,
                fontSize: 15,
                background: "#f8fafc",
                color: "#222"
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                background: "#16a34a",
                color: "#fff",
                padding: 12,
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer"
              }}
            >
              Kodu Doğrula
            </button>
          </form>
        )}

        {message && (
          <p style={{
            color: message.startsWith("✅") ? "#16a34a" : "#000"
          }}>{message}</p>
        )}

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a href="/kayit" style={{
            color: "#2563eb",
            textDecoration: "underline"
          }}>
            Hesabın yok mu? Kayıt ol
          </a>
        </div>
      </div>
    </div>
  );
}
