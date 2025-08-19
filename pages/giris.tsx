// pages/giris.tsx
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

const ADMIN_EMAILS = ["80birinfo@gmail.com"]; // buraya admin mailleri ekle

export default function Giris() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ---- Android odak/merkez ref'leri
  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const [isAndroid, setIsAndroid] = useState(false);

  // SADECE Android tespiti + sayfaya sınıf ekle
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const android = /Android/i.test(ua);
    setIsAndroid(android);
    if (android) document.documentElement.classList.add("login-android");
    return () => document.documentElement.classList.remove("login-android");
  }, []);

  // Açılışta ve OTP'ye geçince: karta kaydır + ilgili inputa fokus
  useEffect(() => {
    if (!isAndroid) return;
    const t = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const target = otpStep ? otpRef.current : emailRef.current;
      try {
        target?.focus({ preventScroll: true });
        // caret sonda kalsın
        const v = target?.value ?? "";
        target?.setSelectionRange?.(v.length, v.length);
      } catch {}
    }, 120);
    return () => clearTimeout(t);
  }, [isAndroid, otpStep]);

  // 1) Parola kontrolü → check-trust → gerekirse OTP gönder
  async function handlePasswordCheck(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    const em = email.trim();
    const pw = password;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) {
        setMessage("❌ Giriş başarısız: " + error.message);
        return;
      }

      const confirmed = (data.user as any)?.email_confirmed_at ?? (data.user as any)?.confirmed_at ?? null;
      if (!confirmed) {
        setMessage("❗ Lütfen e-posta adresinizi doğrulayın.");
        await supabase.auth.signOut();
        return;
      }

      // ✅ Admin kontrolü: eğer admin ise OTP'yi atla ve admin paneline git
      if (data.user && ADMIN_EMAILS.includes(data.user.email?.toLowerCase() || "")) {
        setMessage("👑 Admin girişi başarılı, yönlendiriliyorsunuz...");
        setTimeout(() => {
          router.push("/admin/saticilar");
        }, 500);
        return;
      }

      try {
        const c = await fetch("/api/auth/check-trust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: em }),
        });
        if (c.ok) {
          const { trusted } = await c.json();
          if (trusted) {
            setMessage("🔓 Güvenilir IP - OTP istenmedi.");
            const role = (data.user?.user_metadata?.role as "alici" | "satici" | undefined) ?? undefined;
            setTimeout(() => {
              if (role === "satici") router.push("/");
              else router.push("/index2");
            }, 500);
            return;
          }
        }
      } catch {}

      await supabase.auth.signOut();

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
    } catch (err: any) {
      console.error("OTP gönderim hatası:", err);
      const msg = typeof err?.message === "string" ? err.message : "Kod gönderilemedi.";
      setMessage("❌ " + msg);
    } finally {
      setLoading(false);
    }
  }

  // 2) OTP kontrolü
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
        v = await fetch(`${base}?email=${encodeURIComponent(em)}&code=${encodeURIComponent(otpCode)}`, { method: "GET" });
      }
      if (!v.ok) {
        const t = await v.text();
        setMessage("❌ Kod doğrulanamadı: " + t);
        return;
      }

      setMessage("✅ Kod doğru, giriş yapılıyor...");
      await finalLogin(em, password);
    } catch (err: any) {
      console.error("OTP doğrulama hatası:", err);
      const msg = typeof err?.message === "string" ? err.message : "Doğrulama sırasında hata oluştu.";
      setMessage("❌ " + msg);
    } finally {
      setLoading(false);
    }
  }

  // 3) Final login
  async function finalLogin(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage("❌ Giriş başarısız: " + error.message);
      return;
    }

    // ✅ Admin kontrolü
    if (data.user && ADMIN_EMAILS.includes(data.user.email?.toLowerCase() || "")) {
      setMessage("👑 Admin girişi başarılı, yönlendiriliyorsunuz...");
      setTimeout(() => {
        router.push("/admin/saticilar");
      }, 900);
      return;
    }

    const role = (data.user?.user_metadata?.role as "alici" | "satici" | undefined) ?? undefined;
    setTimeout(() => {
      if (role === "satici") router.push("/");
      else router.push("/index2");
    }, 900);
  }

  return (
    <div
      className="login-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f4f4f6 0%, #e6e8ec 100%)",
      }}
    >
      <div
        ref={cardRef}
        className="login-card"
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

        {!otpStep ? (
          <form onSubmit={handlePasswordCheck}>
            <input
              ref={emailRef}
              type="email"
              name="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"   // ← email yerine username kullan
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
              required
            />
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Lütfen bekleyin..." : "Giriş Yap"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpCheck}>
            <input
              ref={otpRef}
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
                color: "#222",
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
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Doğrulanıyor..." : "Kodu Doğrula"}
            </button>
          </form>
        )}

        {message && (
          <p style={{ marginTop: 10, color: message.startsWith("✅") || message.startsWith("👑") ? "#16a34a" : "#111" }}>
            {message}
          </p>
        )}

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a href="/kayit" style={{ color: "#2563eb", textDecoration: "underline" }}>
            Hesabın yok mu? Kayıt ol
          </a>
        </div>
      </div>

      {/* Android'e özel görünümler */}
      <style jsx global>{`
        /* Üstteki site header/pwa header varsa gizle */
        .login-android .pwa-header,
        .login-android header,
        .login-android .site-header {
          display: none !important;
        }

        /* Android: ilk anda tam ortada olsun, klavye/dinamik bar oynamasın */
        .login-android .login-shell {
          min-height: 100dvh !important;     /* adres çubuğu yüksekliğini hesaba katar */
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: #fff !important;
          padding: env(safe-area-inset-top) env(safe-area-inset-right)
            env(safe-area-inset-bottom) env(safe-area-inset-left);
        }

        .login-android .login-card {
          width: 100vw !important;
          max-width: 480px !important;
          border-radius: 0 !important;       /* mobilde düz kenar – istersen kaldır */
          box-shadow: none !important;
          padding: 24px 16px !important;
          min-width: auto !important;
        }

        .login-android input {
          height: 52px !important;
          font-size: 16px !important;
          border-radius: 12px !important;
        }
        .login-android button {
          height: 52px !important;
          font-size: 16px !important;
          border-radius: 12px !important;
        }
      `}</style>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
