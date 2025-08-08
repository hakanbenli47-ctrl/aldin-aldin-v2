import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // NEW: akış kontrolü
  const [requireOtp, setRequireOtp] = useState(false);       // kayıttan gelenler için
  const [otpGatePassed, setOtpGatePassed] = useState(false); // kod doğrulandı mı?

  // cooldown + loading + autosend
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Kaynaktan geldiyse yakala: ?src=kayit | register | role
  useEffect(() => {
    if (!router.isReady) return;
    const src = (router.query.src as string)?.toLowerCase() || "";
    // localStorage fallback (kayit.tsx'te localStorage.setItem('fromRegister','1') yapabilirsin)
    const fromRegisterLS = typeof window !== "undefined" ? localStorage.getItem("fromRegister") === "1" : false;

    if (src === "kayit" || src === "register" || fromRegisterLS) {
      setRequireOtp(true);
    } else {
      setRequireOtp(false); // role seçimden ya da direkt giriş
    }
  }, [router.isReady, router.query.src]);

  // cooldown sayacı
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const canSend = useMemo(() => cooldown === 0 && !loading, [cooldown, loading]);

  function getRedirectUrl() {
    if (typeof window !== "undefined") return `${window.location.origin}/auth/callback`;
    if (process.env.NEXT_PUBLIC_SITE_URL) return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
    return undefined;
  }

  async function handleSendOtp(e?: React.FormEvent, { fromAuto = false }: { fromAuto?: boolean } = {}) {
    if (e) e.preventDefault();
    if (!email) {
      setMessage("❗ Lütfen önce e-posta adresini gir.");
      return;
    }
    if (!canSend && !fromAuto) return;

    setLoading(true);
    setMessage("Kod gönderiliyor…");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getRedirectUrl(), shouldCreateUser: true },
    });

    if (error) {
      if (/security|request this after|rate|too many/i.test(error.message || "")) {
        setMessage("⏳ Çok hızlı denendi. 24–30 sn bekleyip yeniden deneyin.");
        setCooldown(30);
      } else {
        setMessage("❌ Kod gönderilemedi: " + error.message);
      }
      setLoading(false);
      return;
    }

    setOtpSent(true);
    setMessage("✅ 6 haneli kod e-postana gönderildi.");
    setCooldown(30);
    setLoading(false);
    if (fromAuto) setAutoTriggered(true);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("Kod doğrulanıyor…");

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "email",
    });

    if (error) {
      setLoading(false);
      return setMessage("❌ Kod hatalı/expired: " + error.message);
    }

    // Kayıttan gelindiyse: otomatik yönlendirme yok, önce butonu göster
    if (requireOtp) {
      setOtpGatePassed(true); // giriş butonu aktif olacak
      setMessage("✅ E-posta doğrulandı. Şimdi giriş yapabilirsiniz.");
      setLoading(false);
      return;
    }

    // Normal akış: doğrulandıysa direkt yönlendir
    setMessage("✅ Giriş başarılı! Yönlendiriliyor…");
    const rol = typeof window !== "undefined" ? localStorage.getItem("selectedRole") : null;
    setTimeout(() => {
      if (rol === "satici") router.push("/satici");
      else if (rol === "alici") router.push("/index2");
      else router.push("/");
    }, 800);
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();

    // Kayıttan gelenlerde, kod doğrulanmadan giriş butonu kullanılamaz
    if (requireOtp && !otpGatePassed) {
      setMessage("ℹ️ Önce e-postana gelen kodu doğrulaman gerekiyor.");
      return;
    }

    setLoading(true);
    setMessage("Giriş yapılıyor…");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (/invalid|not found|no user/i.test(error.message || "")) {
        // rol seçim akışı için OTP'yi önermeyelim; ama kullanıcı isterse manuel açar
        if (!requireOtp) {
          setMessage("ℹ️ Şifre hatalı ya da kullanıcı bulunamadı. İstersen e-posta kodu ile giriş yapabilirsin.");
          // OTP kısmını kullanıcı isterse görebilsin:
          setOtpSent(false);
        } else {
          // requireOtp modunda zaten OTP isteniyor
          setMessage("ℹ️ Lütfen önce e-postana gelen kodu doğrula.");
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      return setMessage("❌ Giriş başarısız: " + error.message);
    }

    if (data?.user) {
      setMessage("✅ Giriş başarılı! Yönlendiriliyor…");
      const rol = typeof window !== "undefined" ? localStorage.getItem("selectedRole") : null;
      setTimeout(() => {
        if (rol === "satici") router.push("/satici");
        else if (rol === "alici") router.push("/index2");
        else router.push("/");
      }, 800);
    }
  }

  // ---------- UI ----------
  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 12px 30px rgba(30,41,59,0.08)",
    padding: 28,
    width: "min(92vw, 420px)",
  };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#4b5673", marginBottom: 6, display: "block" };
  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", border: "1px solid #e5e8f0", borderRadius: 10, outline: "none", fontSize: 14,
  };
  const btn = (bg: string, disabled = false): React.CSSProperties => ({
    width: "100%", background: disabled ? "#dbe1ee" : bg, color: disabled ? "#7b869b" : "#fff",
    padding: 12, border: "none", borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background:
        "radial-gradient(1200px 600px at 10% -20%, #eef2ff 0, transparent 60%), radial-gradient(1000px 500px at 110% 120%, #ffeef5 0, transparent 60%)",
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    }}>
      <div style={card}>
        <h2 style={{ textAlign: "center", marginBottom: 8, color: "#223555", fontSize: 22, fontWeight: 800 }}>Giriş Yap</h2>
        <p style={{ textAlign: "center", marginTop: 0, color: "#60709a", fontSize: 14 }}>
          {requireOtp ? "Kaydı tamamlamak için e-postana gelen kodu doğrula." : "Şifreyle ya da istersen e-posta koduyla giriş yap."}
        </p>

        {/* E-posta */}
        <div style={{ marginTop: 16 }}>
          <label style={label}>E-posta</label>
          <input
            name="email"
            type="email"
            placeholder="ornek@eposta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
            autoComplete="email"
            required
          />
        </div>

        {/* Kayıttan gelinmişse: önce OTP zorunlu */}
        {requireOtp ? (
          <>
            {/* Kod gönderme + doğrulama */}
            {!otpSent ? (
              <form onSubmit={(e) => handleSendOtp(e)} style={{ marginTop: 12 }}>
                <button
                  type="submit"
                  style={{ ...btn("#16a34a", !canSend), display: "grid", placeItems: "center" }}
                  disabled={!canSend}
                  title={canSend ? "Kodu e-postana gönder" : "Biraz bekleyip tekrar dene"}
                >
                  {cooldown > 0 ? `Tekrar: ${cooldown}s` : "Kodu Gönder"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ marginTop: 14 }}>
                <label style={label}>6 Haneli Kod</label>
                <input
                  placeholder="______"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ ...input, letterSpacing: 2, textAlign: "center" }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10 }}>
                  <button type="submit" style={btn("#0ea5e9", loading)} disabled={loading}>
                    {loading ? "Doğrulanıyor…" : "Kodu Doğrula"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendOtp(undefined)}
                    style={btn("#6b7280", !canSend)}
                    disabled={!canSend}
                    title={canSend ? "Kodu tekrar gönder" : "Biraz bekleyip tekrar dene"}
                  >
                    {cooldown > 0 ? `${cooldown}s` : "Tekrar"}
                  </button>
                </div>
              </form>
            )}

            {/* Giriş butonu: kod doğrulanana kadar GİZLİ */}
            {otpGatePassed && (
              <button
                onClick={() => {
                  const rol = typeof window !== "undefined" ? localStorage.getItem("selectedRole") : null;
                  if (rol === "satici") router.push("/satici");
                  else if (rol === "alici") router.push("/index2");
                  else router.push("/");
                }}
                style={{ ...btn("#2563eb"), marginTop: 14 }}
              >
                Giriş Yap
              </button>
            )}

            {/* Şifre formu kayıttan gelince gizli (kod doğrulanana kadar hiç göstermiyoruz) */}
          </>
        ) : (
          <>
            {/* Rol seçimden gelindiyse: şifreyle normal giriş */}
            <form onSubmit={handlePasswordLogin} style={{ marginTop: 14 }}>
              <label style={label}>Şifre</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
                autoComplete="current-password"
              />
              <button type="submit" style={{ ...btn("#2563eb", loading), marginTop: 12 }} disabled={loading}>
                {loading ? "Giriş yapılıyor…" : "Şifre ile Giriş"}
              </button>
            </form>

            {/* İstersen kullanıcıya opsiyonel OTP de sunabilirsin — istersen bu bloğu tamamen silebilirsin */}
            {!otpSent ? (
              <form onSubmit={(e) => handleSendOtp(e)} style={{ marginTop: 12 }}>
                <button
                  type="submit"
                  style={{ ...btn("#16a34a", !canSend), display: "grid", placeItems: "center" }}
                  disabled={!canSend}
                  title={canSend ? "Kodu e-postana gönder" : "Biraz bekleyip tekrar dene"}
                >
                  {cooldown > 0 ? `Tekrar: ${cooldown}s` : "Kodu Gönder"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ marginTop: 14 }}>
                <label style={label}>6 Haneli Kod</label>
                <input
                  placeholder="______"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ ...input, letterSpacing: 2, textAlign: "center" }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10 }}>
                  <button type="submit" style={btn("#0ea5e9", loading)} disabled={loading}>
                    {loading ? "Doğrulanıyor…" : "Kodu Doğrula"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendOtp(undefined)}
                    style={btn("#6b7280", !canSend)}
                    disabled={!canSend}
                    title={canSend ? "Kodu tekrar gönder" : "Biraz bekleyip tekrar dene"}
                  >
                    {cooldown > 0 ? `${cooldown}s` : "Tekrar"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {message && (
          <p
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: /❌|hata|error|invalid|çok hızlı|expired/i.test(message) ? "#ffe8ea" : "#eef4ff",
              color: /❌|hata|error|invalid|çok hızlı|expired/i.test(message) ? "#a1313d" : "#2a3f90",
              border: `1px solid ${/❌|hata|error|invalid|çok hızlı|expired/i.test(message) ? "#ffd0d6" : "#dce6ff"}`,
            }}
          >
            {message}
          </p>
        )}

        {!requireOtp && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <a href="/kayit" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "underline" }}>
              Kaydol
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
