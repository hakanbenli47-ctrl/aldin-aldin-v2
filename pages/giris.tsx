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

  const isTrusted =
    typeof window !== "undefined" && localStorage.getItem("trustedDevice") === "true";

  // İlk adım: Şifre kontrolü
  async function handlePasswordCheck(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const em = email.trim();
    const pw = password;

    // Güvenilir cihaz: boş değerleri engelle
    if (isTrusted) {
      if (!em || !pw) {
        setMessage("❌ E-posta ve şifre gerekli.");
        return;
      }
      return finalLogin(em, pw);
    }

    // Parolayı doğrula (session açılır, sonra hemen kapatacağız)
    const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    if (error) {
      setMessage("❌ Giriş başarısız: " + error.message);
      return;
    }

    // farklı supabase versiyonlarında alan adı değişebiliyor → ikisini de kontrol et
    const confirmed =
      (data.user as any)?.email_confirmed_at ??
      (data.user as any)?.confirmed_at ?? null;

    if (!confirmed) {
      setMessage("❗ Lütfen e-posta adresinizi doğrulayın.");
      await supabase.auth.signOut();
      return;
    }

    // Oturumu hemen kapat (OTP doğrulanmadan açık kalmasın)
    await supabase.auth.signOut();

    // Güvenli OTP sürecini sunucudan başlat (mutlak origin kullan)
    try {
      const resp = await fetch(`${window.location.origin}/api/auth/start-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });

      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `Mail API hatası: ${resp.status}`);
      }

      setMessage("📩 Doğrulama kodu e-posta adresinize gönderildi.");
      setOtpStep(true);
    } catch (err) {
      console.error("OTP gönderim hatası:", err);
      setMessage("❌ Kod gönderilemedi, lütfen tekrar deneyin.");
    }
  }

  // OTP kontrolü (sunucuda doğrulat)
  async function handleOtpCheck(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();

    try {
      if (!otpCode) {
        setMessage("❌ Lütfen doğrulama kodunu girin.");
        return;
      }

      const v = await fetch(`${window.location.origin}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, code: otpCode }),
      });

      if (!v.ok) {
        const t = await v.text();
        setMessage("❌ Kod doğrulanamadı: " + t);
        return;
      }

      // Kullanıcıya cihazı güvenilir olarak işaretleme seçeneği
      const trust = confirm(
        "Bu cihazı güvenilir olarak işaretlemek ister misiniz? Bundan sonraki girişlerde kod istenmez."
      );
      if (trust) {
        localStorage.setItem("trustedDevice", "true");
      }

      setMessage("✅ Kod doğru, giriş yapılıyor...");
      await finalLogin(em, password);
    } catch (err) {
      console.error("OTP doğrulama hatası:", err);
      setMessage("❌ Doğrulama sırasında hata oluştu.");
    }
  }

  async function finalLogin(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("❌ Giriş başarısız: " + error.message);
      return;
    }

    const role = (data.user?.user_metadata?.role as "alici" | "satici" | undefined) ?? undefined;
    setTimeout(() => {
      if (role === "satici") router.push("/");
      else router.push("/index2");
    }, 900);
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
          <form onSubmit={handlePasswordCheck}>
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
                color: "#222"
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
              inputMode="numeric"
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

export async function getServerSideProps() {
  return { props: {} };
}
