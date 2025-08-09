import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const validatePassword = (s: string) => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(s);
};

// Benzersiz firma kodu üret
async function generateUniqueFirmaKodu() {
  let unique = false;
  let kod = "";

  while (!unique) {
    kod = "FIRMA-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("firmalar")
      .select("id")
      .eq("firma_kodu", kod)
      .maybeSingle();

    if (!error && !data) {
      unique = true;
    }
  }

  return kod;
}

export default function Kayit() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firmaAdi, setFirmaAdi] = useState("");
  const [message, setMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState<"alici" | "satici" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const r = localStorage.getItem("selectedRole");
    if (r === "alici" || r === "satici") {
      setSelectedRole(r);
    }
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!email || !password) {
      setMessage("❌ Lütfen tüm alanları doldurun!");
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

    // 1. Auth ile kullanıcı oluştur
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

    if (error) {
      setMessage("❌ Kayıt başarısız: " + error.message);
      setLoading(false);
      return;
    }

    // 2. Eğer satıcı ise firmalar tablosuna aktif: false ile ekle
    if (selectedRole === "satici" && data.user) {
      const firmaKodu = await generateUniqueFirmaKodu();

      const { error: insertError } = await supabase.from("firmalar").insert([
        {
          user_id: data.user.id,
          firma_kodu: firmaKodu,
          email: email,
          firma_adi: firmaAdi,
          puan: 0,
          aktif: false, // Onay bekliyor
        },
      ]);

      if (insertError) {
        console.error("Firma ekleme hatası:", insertError.message);
      }

      // Admin'e bilgilendirme maili gönder
      await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "80birinfo@gmail.com",
          subject: "Yeni Satıcı Kaydı Bekliyor",
          text: `Yeni bir satıcı kaydı yapıldı:\n\nE-posta: ${email}\nFirma Adı: ${firmaAdi}\nFirma Kodu: ${firmaKodu}\n\nSupabase panelinden onaylayabilirsiniz.`,
        }),
      });
    }

    // 3. Mesaj belirleme
    setMessage(
      selectedRole === "satici"
        ? "✅ Kayıt başarılı! Satıcı hesabınız onay bekliyor."
        : "✅ Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın."
    );

    setLoading(false);

    // 4. Rolüne göre yönlendir
    setTimeout(() => {
      if (selectedRole === "satici") {
        window.location.href = "/giris-satici";
      } else {
        window.location.href = "/giris";
      }
    }, 1800);
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
