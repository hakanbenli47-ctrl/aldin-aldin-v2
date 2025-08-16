import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Şifre: min 8, 1 büyük, 1 küçük, 1 rakam
const validatePassword = (s: string) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(s);

// DB'ye dokunmadan benzersiz firma_kodu üret (sonsuz döngü yok)
async function generateUniqueFirmaKodu() {
  const MAX_TRIES = 12;
  for (let i = 0; i < MAX_TRIES; i++) {
    const kod = "FIRMA-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await supabase
      .from("satici_firmalar")
      .select("id")
      .eq("firma_kodu", kod)
      .maybeSingle();
    if (error) throw new Error("firma_kodu kontrol hatası: " + error.message); 
    if (!data) return kod; // benzersiz
  }
  // son çare: zaman damgalı
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  return "FIRMA-" + ts;
}

export default function Kayit() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firmaAdi, setFirmaAdi] = useState("");
  const [message, setMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState<"alici" | "satici" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const r = typeof window !== "undefined" ? localStorage.getItem("selectedRole") : null;
    if (r === "alici" || r === "satici") setSelectedRole(r);
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!email || !password || !confirmPassword) {
      setMessage("❌ Lütfen tüm alanları doldurun!");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("❌ Şifreler eşleşmiyor!");
      return;
    }
    if (!validatePassword(password)) {
      setMessage("❌ Şifre en az 8 karakter, 1 büyük, 1 küçük harf ve 1 rakam içermeli.");
      return;
    }
    if (!selectedRole) {
      setMessage("❌ Lütfen önce rol seçin (Alıcı/Satıcı).");
      return;
    }
    if (selectedRole === "satici" && !firmaAdi) {
      setMessage("❌ Satıcı kaydı için firma adı zorunludur.");
      return;
    }

    setLoading(true);
    try {
      // 1) Auth kullanıcı oluştur
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: selectedRole === "satici" ? "pending_satici" : "alici",
            firmaAdi: selectedRole === "satici" ? firmaAdi : null,
          },
          emailRedirectTo: `${window.location.origin}/giris`,
        },
      });
      if (error) throw new Error(error.message);

      // 2) Satıcı ise firma kaydı + admin mail
      if (selectedRole === "satici" && data.user) {
        try {
          const firmaKodu = await generateUniqueFirmaKodu();

          const { error: insertError } = await supabase.from("satici_firmalar").insert([
            {
              user_id: data.user.id,
              firma_kodu: firmaKodu,
              email,
              firma_adi: firmaAdi,
              puan: 0,
              aktif: false, // onay bekliyor
            },
          ]);
          if (insertError) throw insertError;

          // Admin'e bilgi maili (başarısız olsa da kayıt tamam)
          try {
            await fetch("/api/send-mail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: "80birinfo@gmail.com",
                subject: "Yeni Satıcı Kaydı Bekliyor",
                text: `Yeni satıcı kaydı:\nE-posta: ${email}\nFirma: ${firmaAdi}\nFirma Kodu: ${firmaKodu}`,
              }),
            });
          } catch (mErr) {
            console.warn("Admin maili gönderilemedi:", mErr);
          }

          setMessage("✅ Kayıt başarılı! Satıcı hesabınız onay bekliyor.");
        } catch (e: any) {
          console.error("Satıcı ekleme hatası:", e?.message || e);
          setMessage("❌ Satıcı bilgisi kaydedilemedi: " + (e?.message || "bilinmeyen hata"));
          setLoading(false);
          return;
        }
      } else {
        setMessage("✅ Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.");
      }

      // 3) Yönlendirme
      setTimeout(() => {
        if (selectedRole === "satici") window.location.href = "/giris-satici";
        else window.location.href = "/giris";
      }, 1800);
    } catch (err: any) {
      setMessage("❌ Kayıt başarısız: " + (err?.message || "bilinmeyen hata"));
    } finally {
      setLoading(false);
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
          Kayıt Ol
        </h2>

        {/* Rol seçim */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => {
              setSelectedRole("alici");
              localStorage.setItem("selectedRole", "alici");
            }}
            style={{
              background: selectedRole === "alici" ? "#0d9488" : "#e2e8f0",
              color: selectedRole === "alici" ? "#fff" : "#333",
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Alıcı
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRole("satici");
              localStorage.setItem("selectedRole", "satici");
            }}
            style={{
              background: selectedRole === "satici" ? "#0d9488" : "#e2e8f0",
              color: selectedRole === "satici" ? "#fff" : "#333",
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Satıcı
          </button>
        </div>

        {!!selectedRole && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            Seçili Rol: <b>{selectedRole.toUpperCase()}</b>
          </div>
        )}

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
              color: "#222",
            }}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder="Şifre Tekrar"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            autoComplete="new-password"
            required
          />
          {selectedRole === "satici" && (
            <input
              type="text"
              placeholder="Firma Adı"
              value={firmaAdi}
              onChange={(e) => setFirmaAdi(e.target.value)}
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
          )}
          <button
            type="submit"
            disabled={loading}
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
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
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
