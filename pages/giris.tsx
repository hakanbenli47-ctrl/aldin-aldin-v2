// pages/giris.tsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const router = useRouter();
  const { email: qEmail } = (router.query as { email?: string }) || {};

  const [email, setEmail] = useState<string>(qEmail ?? "");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const autoOtpTriggered = useRef(false);

  // Oturum varsa ana sayfaya
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/");
    })();
  }, [router]);

  // URL'de email varsa ve daha önce tetiklenmediyse otomatik kod gönder
  useEffect(() => {
    if (!router.isReady) return;
    if (!email || otpSent || autoOtpTriggered.current) return;

    (async () => {
      try {
        autoOtpTriggered.current = true;
        setLoading(true);
        setMessage("Giriş kodu gönderiliyor…");
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
          },
        });
        if (error) throw error;
        setOtpSent(true);
        setMessage("Kod gönderildi. E-postana gelen 6 haneli kodu gir.");
      } catch (err: any) {
        setMessage("Kod gönderilemedi: " + (err?.message ?? ""));
        autoOtpTriggered.current = false;
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, email, otpSent]);

  async function sendOtp() {
    if (!email) return setMessage("Lütfen e‑posta adresini gir.");
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) return setMessage("Kod gönderilemedi: " + error.message);
    setOtpSent(true);
    setMessage("Kod gönderildi. E-postana gelen 6 haneli kodu gir.");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !otpCode) return setMessage("E‑posta ve kod gerekli.");
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "email", // Email OTP
    });
    setLoading(false);
    if (error) return setMessage("Doğrulama başarısız: " + error.message);

    setMessage("Giriş tamamlandı (oturum korunuyor), yönlendiriliyorsun…");
    router.replace("/index2");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#fff",
        color: "#111",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          background: "#fff",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>
          Giriş (E‑posta Kodu)
        </h1>

        <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
          E‑posta
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@mail.com"
          autoComplete="email"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#111",
            marginBottom: 10,
            outlineColor: "#111",
          }}
        />

        {!otpSent ? (
          <button
            onClick={sendOtp}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #111",
              background: loading ? "#f3f4f6" : "#111",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Gönderiliyor…" : "Kodu Gönder"}
          </button>
        ) : (
          <form onSubmit={verifyOtp} style={{ marginTop: 8 }}>
            <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
              E‑postaya gelen 6 haneli kod
            </label>
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111",
                textAlign: "center",
                letterSpacing: 6,
                fontWeight: 700,
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={sendOtp}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#111",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "…" : "Kodu Tekrar Gönder"}
              </button>
              <button
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: loading ? "#f3f4f6" : "#111",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Doğrulanıyor…" : "Kodu Doğrula"}
              </button>
            </div>
          </form>
        )}

        {message && (
          <p
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              color: "#111",
              fontSize: 13,
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
