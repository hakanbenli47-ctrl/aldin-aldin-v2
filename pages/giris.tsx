import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isTrusted =
    typeof window !== "undefined" && localStorage.getItem("trustedDevice") === "true";

  async function handlePasswordCheck(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    const em = email.trim();
    const pw = password;

    try {
      if (isTrusted) {
        if (!em || !pw) {
          setMessage("❌ E-posta ve şifre gerekli.");
          return;
        }
        return await finalLogin(em, pw);
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) {
        setMessage("❌ Giriş başarısız: " + error.message);
        return;
      }

      const confirmed =
        (data.user as any)?.email_confirmed_at ??
        (data.user as any)?.confirmed_at ??
        null;

      if (!confirmed) {
        setMessage("❗ Lütfen e-posta adresinizi doğrulayın.");
        await supabase.auth.signOut();
        return;
      }

      // Oturumu kapat (OTP doğrulanmadan session açık kalmasın)
      await supabase.auth.signOut();

      // OTP başlat
      const base = `${window.location.origin}/api/auth/start-otp`;
      let resp = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      if (resp.status === 405 || resp.status === 404) {
        resp = await fetch(`${base}?email=${encodeURIComponent(em)}`, { method: "GET" });
      }
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `Mail API hatası: ${resp.status}`);
      }

      setMessage("📩 Doğrulama kodu e-posta adresinize gönderildi.");
      setOtpStep(true);
    } catch (err) {
      console.error("OTP gönderim hatası:", err);
      setMessage("❌ Kod gönderilemedi, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpCheck(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const em = email.trim();
    try {
      if (!otpCode) {
        setMessage("❌ Lütfen doğrulama kodunu girin.");
        return;
      }

      const base = `${window.location.origin}/api/auth/verify-otp`;
      let v = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, code: otpCode }),
      });
      if (v.status === 405 || v.status === 404) {
        v = await fetch(
          `${base}?email=${encodeURIComponent(em)}&code=${encodeURIComponent(otpCode)}`,
          { method: "GET" }
        );
      }
      if (!v.ok) {
        const t = await v.text();
        setMessage("❌ Kod doğrulanamadı: " + t);
        return;
      }

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
    } finally {
      setLoading(false);
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
              autoComplete="email"
              required
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
              autoComplete="current-password"
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "#fff",
                padding: 12,
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 12,
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Lütfen bekleyin..." : "Giriş Yap"}
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
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#86efac" : "#16a34a",
                color: "#fff",
                padding: 12,
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 16,
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Doğrulanıyor..." : "Kodu Doğrula"}
            </button>
          </form>
        )}

        {message && (
          <p style={{ marginTop: 10, color: message.startsWith("✅") ? "#16a34a" : "#111" }}>
            {message}
          </p>
        )}

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a href="/kayit" style={{ color: "#2563eb", textDecoration: "underline" }}>
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
