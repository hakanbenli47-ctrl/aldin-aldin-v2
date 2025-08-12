// pages/giris.tsx
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const router = useRouter();

  // UI state
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // Refs – mobilde direkt giriş alanına odaklanıyoruz
  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  // 🔎 Mobil tespiti + sayfayı sadeleştir (header gizle, tam ekran karta odaklan)
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (typeof window !== "undefined" && window.innerWidth <= 480);

    // html elementine class ekle (global stiller buradan tetiklenecek)
    document.documentElement.classList.toggle("login-mobile", !!isMobile);

    // kartı merkeze getir, giriş alanına fokusla
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
      if (!otpStep) {
        (email ? passRef.current : emailRef.current)?.focus();
      } else {
        otpRef.current?.focus();
      }
    }, 50);

    // iOS/Android klavye açılınca alan taşmasın
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const onResize = () => {
      if (!vv || !cardRef.current) return;
      cardRef.current.style.paddingBottom = vv.height < window.innerHeight ? "40px" : "24px";
    };
    vv?.addEventListener?.("resize", onResize);
    return () => {
      document.documentElement.classList.remove("login-mobile");
      vv?.removeEventListener?.("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpStep, email]);

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

      // IP güvenilir mi?
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
      } catch {
        // sessiz geç
      }

      // Güvenilir değil: session kapat, OTP başlat
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
      if (!resp.ok) throw new Error((await resp.text()) || `Mail API hatası: ${resp.status}`);

      setMessage("📩 Doğrulama kodu e-posta adresinize gönderildi.");
      setOtpStep(true);
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch (err: any) {
      console.error("OTP gönderim hatası:", err);
      setMessage("❌ " + (err?.message || "Kod gönderilemedi."));
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
        setMessage("❌ Kod doğrulanamadı: " + (await v.text()));
        return;
      }

      setMessage("✅ Kod doğru, giriş yapılıyor...");
      await finalLogin(em, password);
    } catch (err: any) {
      console.error("OTP doğrulama hatası:", err);
      setMessage("❌ " + (err?.message || "Doğrulama sırasında hata oluştu."));
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
    const role = (data.user?.user_metadata?.role as "alici" | "satici" | undefined) ?? undefined;
    setTimeout(() => {
      if (role === "satici") router.push("/");
      else router.push("/index2");
    }, 700);
  }

  return (
    <>
      <Head>
        <title>Giriş Yap</title>
        {/* iOS/Android klavye için güvenli alan */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* Arkaplan */}
      <div className="login-page">
        {/* Kart */}
        <div ref={cardRef} className="login-card">
          <h2 className="login-title">Giriş Yap</h2>

          {!otpStep ? (
            <form onSubmit={handlePasswordCheck} className="login-form">
              <input
                ref={emailRef}
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
                className="login-input"
              />
              <input
                ref={passRef}
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="login-input"
              />
              <button type="submit" disabled={loading} className="login-btn primary">
                {loading ? "Lütfen bekleyin..." : "Giriş Yap"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpCheck} className="login-form">
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Doğrulama Kodu"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                className="login-input"
              />
              <button type="submit" disabled={loading} className="login-btn success">
                {loading ? "Doğrulanıyor..." : "Kodu Doğrula"}
              </button>
            </form>
          )}

          {message && <p className={`login-msg ${message.startsWith("✅") ? "ok" : ""}`}>{message}</p>}

          <div className="login-alt">
            <a href="/kayit">Hesabın yok mu? <u>Kayıt ol</u></a>
          </div>
        </div>
      </div>

      {/* Sayfa içi GLOBAL stiller – login-mobile sınıfı ile mobilde “sadece giriş” görünümü */}
      <style jsx global>{`
        /* Arkaplan (masaüstü) */
        .login-page{
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          background: linear-gradient(135deg, #f4f4f6 0%, #e6e8ec 100%);
          padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        }
        .login-card{
          background:#fff;
          border-radius:14px;
          box-shadow:0 4px 16px #e1e3e8;
          padding:36px;
          min-width:350px;
          max-width:420px;
          width:100%;
        }
        .login-title{
          font-size:24px;
          font-weight:800;
          color:#223555;
          text-align:center;
          margin-bottom:24px;
        }
        .login-form{ display:flex; flex-direction:column; gap:14px; }
        .login-input{
          width:100%;
          padding:12px 14px;
          border:1px solid #cfd4dc;
          border-radius:10px;
          font-size:15px;
          background:#f8fafc;
          color:#111;
          outline:none;
        }
        .login-input:focus{ border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
        .login-btn{
          width:100%;
          padding:12px 14px;
          border:none;
          border-radius:10px;
          font-weight:800;
          font-size:16px;
          cursor:pointer;
          color:#fff;
        }
        .login-btn.primary{ background:#2563eb; }
        .login-btn.primary:disabled{ background:#93c5fd; cursor:not-allowed; }
        .login-btn.success{ background:#16a34a; }
        .login-btn.success:disabled{ background:#86efac; cursor:not-allowed; }
        .login-msg{ margin-top:10px; color:#111; }
        .login-msg.ok{ color:#16a34a; }
        .login-alt{ text-align:center; margin-top:8px; }
        .login-alt a{ color:#2563eb; }

        /* ====== MOBİL MOD (login-mobile) ======
           – header vs. tüm dikkat dağıtan öğeleri sakla
           – kartı tam ekran yap, yazıları/butonları büyüt
        */
        .login-mobile .pwa-header,
        .login-mobile header,            /* olası genel header */
        .login-mobile .site-header{      /* başka tema isimleri için */
          display:none !important;
        }
        .login-mobile body{
          background:#fff !important;
        }
        .login-mobile .login-page{
          min-height:100dvh;     /* klavye açılınca da tam ekran */
          background:#fff;       /* düz beyaz, temiz görünüm */
          padding:0;
        }
        .login-mobile .login-card{
          width:100vw !important;
          max-width:100vw !important;
          min-height:100dvh !important;
          border-radius:0 !important;
          box-shadow:none !important;
          padding:24px 16px !important;
          display:flex !important;
          flex-direction:column !important;
          justify-content:center !important;
          gap:14px;
        }
        .login-mobile .login-title{
          font-size:22px; margin-bottom:12px;
        }
        .login-mobile .login-input{
          height:52px; font-size:16px; border-radius:12px;
        }
        .login-mobile .login-btn{
          height:52px; font-size:16px; border-radius:12px;
        }
        .login-mobile .login-alt{ margin-top:6px; }
      `}</style>
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
