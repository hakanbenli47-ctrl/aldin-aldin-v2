import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type Method = "password" | "otp";

export default function Giris() {
  const router = useRouter();
  const { method: qMethod, email: qEmail } = router.query as { method?: string; email?: string };

  const [method, setMethod] = useState<Method>(qMethod === "otp" ? "otp" : "password");
  const [email, setEmail] = useState<string>(qEmail ?? "");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const autoOtpTriggered = useRef(false);

  // bu e-posta için cihaz güvenilir mi?
  const isTrusted = typeof window !== "undefined"
    ? localStorage.getItem(`trustedDevice:${email}`) === "true"
    : false;

  // oturum varsa anasayfaya
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/");
    })();
  }, [router]);

  // Kayıttan geldiyse method=otp&email=... ise otomatik kod gönder (satıcı akışı)
  useEffect(() => {
    if (!router.isReady) return;
    if (method !== "otp" || !email || otpSent || autoOtpTriggered.current) return;

    (async () => {
      try {
        autoOtpTriggered.current = true;
        setLoading(true);
        setMessage("📧 Giriş kodu gönderiliyor…");
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
          },
        });
        if (error) throw error;
        setOtpSent(true);
        setMessage("✅ Kod gönderildi. E-postana gelen 6 haneli kodu gir.");
      } catch (err: any) {
        setMessage("❌ Kod gönderilemedi: " + (err?.message ?? ""));
        autoOtpTriggered.current = false;
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, method, email, otpSent]);

  function setTrustedForEmail(flag: boolean) {
    if (typeof window === "undefined") return;
    if (flag) localStorage.setItem(`trustedDevice:${email}`, "true");
    else localStorage.removeItem(`trustedDevice:${email}`);
  }

  // ŞİFREYLE GİRİŞ — 2 AŞAMA (ilk cihazda OTP zorunlu)
  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return setMessage("❌ E-posta ve şifre gerekli.");
    setLoading(true);
    setMessage("");

    // 1) Şifreyi doğrula
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return setMessage("❌ " + error.message);
    }

    // 2) Bu e-posta bu cihazda güvenilir ise OTP sormadan bitir
    if (isTrusted) {
      setLoading(false);
      setMessage("✅ Giriş başarılı, yönlendiriliyorsun…");
      router.replace("/index2");
      return;
    }

    // 3) Güvenilir değilse: OTP gönder, güvenlik için session'ı kapat, OTP ekranına geç
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
        },
      });
      if (otpErr) throw otpErr;

      await supabase.auth.signOut(); // OTP doğrulanana kadar erişim olmasın
      setMethod("otp");
      setOtpSent(true);
      setMessage("✅ Kod gönderildi. E-postana gelen 6 haneli kodu gir.");
    } catch (err: any) {
      setMessage("❌ OTP gönderilemedi: " + (err?.message ?? ""));
    } finally {
      setLoading(false);
    }
  }

  async function sendOtpManual() {
    if (!email) return setMessage("❌ E-posta gerekli.");
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
    if (error) return setMessage("❌ " + error.message);
    setOtpSent(true);
    setMessage("✅ Kod gönderildi. E-postana gelen 6 haneli kodu gir.");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !otpCode) return setMessage("❌ E-posta ve kod gerekli.");
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" });
    setLoading(false);
    if (error) return setMessage("❌ " + error.message);

    // OTP başarıyla doğrulandı → İsteğe bağlı cihazı hatırla
    if (rememberDevice) setTrustedForEmail(true);

    setMessage("✅ Giriş tamamlandı, yönlendiriliyorsun…");
    router.replace("/index2");
  }

  // UI
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#eef2ff,#e6fffa)" }}>
      <div style={{ width: 440, background: "#0b1220", borderRadius: 16, padding: 24, boxShadow: "0 10px 30px rgba(15,23,42,.25)", border: "1px solid #1f2a44" }}>
        <div style={{ color: "#e2e8f0", fontSize: 22, fontWeight: 800, marginBottom: 14, textAlign: "center" }}>
          Giriş — 80bir
        </div>

        {/* Sekmeler */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => { setMethod("password"); setMessage(""); setOtpSent(false); setOtpCode(""); }}
            style={{ padding: 10, borderRadius: 12, border: "1px solid #263145", background: method === "password" ? "#1f2a44" : "transparent", color: "#cbd5e1", fontWeight: 700, cursor: "pointer" }}
          >Şifreyle</button>
          <button
            onClick={() => { setMethod("otp"); setMessage(""); }}
            style={{ padding: 10, borderRadius: 12, border: "1px solid #263145", background: method === "otp" ? "#1f2a44" : "transparent", color: "#cbd5e1", fontWeight: 700, cursor: "pointer" }}
          >Kodla (OTP)</button>
        </div>

        {/* E-posta alanı */}
        <label style={{ color: "#94a3b8", fontSize: 13 }}>E-posta</label>
        <input
          type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ornek@mail.com"
          style={{ width: "100%", padding: 12, margin: "6px 0 12px", borderRadius: 12, border: "1px solid #263145", background: "#0b1220", color: "#e2e8f0" }}
        />

        {/* Şifre ile giriş */}
        {method === "password" && (
          <form onSubmit={loginWithPassword} style={{ display: "grid", gap: 10 }}>
            <label style={{ color: "#94a3b8", fontSize: 13 }}>Şifre</label>
            <input
              type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #263145", background: "#0b1220", color: "#e2e8f0" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
              <input type="checkbox" checked={rememberDevice} onChange={e=>setRememberDevice(e.target.checked)} />
              Bu cihazı hatırla (bu e-posta için bu cihazda OTP bir daha istenmesin)
            </label>
            <button
              disabled={loading}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#1d4ed8", color: "#fff", fontWeight: 800, cursor: "pointer" }}
            >
              {loading ? "İşleniyor…" : "Giriş Yap"}
            </button>
          </form>
        )}

        {/* OTP akışı */}
        {method === "otp" && (
          <form onSubmit={verifyOtp} style={{ display: "grid", gap: 10 }}>
            {!otpSent ? (
              <button
                type="button" onClick={sendOtpManual} disabled={loading}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#1d4ed8", color: "#fff", fontWeight: 800, cursor: "pointer" }}
              >
                {loading ? "İşleniyor…" : "Kodu Gönder"}
              </button>
            ) : (
              <>
                <label style={{ color: "#94a3b8", fontSize: 13 }}>E-postaya gelen 6 haneli kod</label>
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  value={otpCode}
                  onChange={e=>setOtpCode(e.target.value)}
                  placeholder="123456"
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #263145",
                    background: "#fff",
                    color: "#000",
                    textAlign: "center",
                    letterSpacing: 6,
                    fontSize: 18,
                    fontWeight: 800
                  }}
                />
                <button
                  disabled={loading}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#10b981", color: "#0b1220", fontWeight: 900, cursor: "pointer" }}
                >
                  {loading ? "İşleniyor…" : "Kodu Doğrula"}
                </button>
              </>
            )}
          </form>
        )}

        {message && <p style={{ marginTop: 12, color: "#c7d2fe", background: "#111827", border: "1px solid #1f2a44", padding: 10, borderRadius: 10 }}>{message}</p>}
      </div>
    </div>
  );
}
