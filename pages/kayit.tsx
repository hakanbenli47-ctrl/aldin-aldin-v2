import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Kayit() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firmaAdi, setFirmaAdi] = useState(""); // Yeni: firma adı için state
  const [userType, setUserType] = useState<"alici" | "satici" | "">("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    // Temel alan kontrolleri
    if (!email || !password || !userType) {
      setMessage("❌ Lütfen tüm alanları doldurun ve kullanıcı tipini seçin!");
      return;
    }
    // Satıcıysa firma adı kontrolü
    if (userType === "satici" && !firmaAdi) {
      setMessage("❌ Lütfen firma adını girin!");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setMessage("❌ Kayıt başarısız: " + error.message);
      return;
    }

    if (userType === "alici") {
      setMessage(
        "✅ Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın ve giriş yapın."
      );
      setLoading(false);
      setTimeout(() => {
        window.location.href = "/giris";
      }, 2000);
    }

    if (userType === "satici") {
      const firmaKodu =
        "FIRMA-" +
        Math.random().toString(36).substring(2, 8).toUpperCase();

      // Satıcı firmalar tablosuna ekleme (firma_adi de eklendi)
      await supabase.from("satici_firmalar").insert([
        {
          user_id: data.user?.id,
          firma_kodu: firmaKodu,
          email,
          firma_adi: firmaAdi,
        },
      ]);

      // Firma kodunu mail ile gönder
      await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "Satıcı Kaydı - Firma Kodunuz",
          text: `Tebrikler! Satıcı kaydınız başarıyla oluşturuldu.\n\nFirma Adı: ${firmaAdi}\nFirma Kodunuz: ${firmaKodu}\n\nBu kod ve ad ile satıcı giriş ekranından hesabınıza erişebilirsiniz.\n\nBol satışlar dileriz!\n\n80bir Ekibi`,
        }),
      });

      setMessage(
        `✅ Satıcı kaydı başarılı!\nFirma kodunuz e-posta adresinize iletildi.\nLütfen e-posta adresinizi doğrulayın ve giriş yapın.`
      );
      setLoading(false);
      setTimeout(() => {
        window.location.href = "/giris-satici";
      }, 3500);
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
          borderRadius: 16,
          boxShadow: "0 4px 18px #e1e3e8cc",
          padding: 40,
          minWidth: 350,
          maxWidth: 410,
        }}
      >
        {/* Toggle Butonlar */}
        <div style={{ marginBottom: 21, display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => setUserType("alici")}
            style={{
              background: userType === "alici" ? "#12b76a" : "#f4f6f6",
              color: userType === "alici" ? "#fff" : "#223555",
              padding: "13px 32px",
              borderRadius: "14px 0 0 14px",
              border: userType === "alici" ? "2.2px solid #12b76a" : "1.2px solid #eee",
              fontWeight: 700,
              fontSize: 17,
              boxShadow: userType === "alici" ? "0 3px 18px #12b76a15" : "0 0px 0px transparent",
              cursor: "pointer",
              outline: "none",
              transition: "all 0.13s",
            }}
            disabled={loading}
          >
            Alıcı
          </button>
          <button
            type="button"
            onClick={() => setUserType("satici")}
            style={{
              background: userType === "satici" ? "#2563eb" : "#f4f6f6",
              color: userType === "satici" ? "#fff" : "#223555",
              padding: "13px 32px",
              borderRadius: "0 14px 14px 0",
              border: userType === "satici" ? "2.2px solid #2563eb" : "1.2px solid #eee",
              fontWeight: 700,
              fontSize: 17,
              boxShadow: userType === "satici" ? "0 3px 18px #2563eb15" : "0 0px 0px transparent",
              cursor: "pointer",
              outline: "none",
              transition: "all 0.13s",
              marginLeft: -3,
            }}
            disabled={loading}
          >
            Satıcı
          </button>
        </div>

        <h2
          style={{
            fontSize: 27,
            fontWeight: 800,
            color: "#223555",
            textAlign: "center",
            marginBottom: 30,
            letterSpacing: ".03em",
          }}
        >
          Kayıt Ol
        </h2>

        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              marginBottom: 18,
              border: "1.3px solid #ccd3dc",
              borderRadius: 10,
              fontSize: 16,
              background: "#f8fafc",
              color: "#222",
              outline: "none",
              fontWeight: 500,
              transition: "border .17s",
            }}
            autoComplete="email"
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              marginBottom: 22,
              border: "1.3px solid #ccd3dc",
              borderRadius: 10,
              fontSize: 16,
              background: "#f8fafc",
              color: "#222",
              outline: "none",
              fontWeight: 500,
              transition: "border .17s",
            }}
            autoComplete="new-password"
            disabled={loading}
          />

          {userType === "satici" && (
            <input
              type="text"
              placeholder="Firma Adı"
              value={firmaAdi}
              onChange={(e) => setFirmaAdi(e.target.value)}
              style={{
                width: "100%",
                padding: 14,
                marginBottom: 22,
                border: "1.3px solid #ccd3dc",
                borderRadius: 10,
                fontSize: 16,
                background: "#f8fafc",
                color: "#222",
                outline: "none",
                fontWeight: 500,
                transition: "border .17s",
              }}
              disabled={loading}
            />
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              background: loading ? "#bbb" : "#12b76a",
              color: "#fff",
              padding: 14,
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 18,
              marginBottom: 12,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: ".01em",
              boxShadow: "0 2px 8px #12b76a18",
              transition: "background .16s",
            }}
            disabled={loading}
          >
            {loading ? "İşleniyor..." : "Kayıt Ol"}
          </button>
        </form>

        {message && (
          <div
            style={{
              color: message.includes("✅") ? "#12b76a" : "#e23c3c",
              textAlign: "center",
              marginTop: 12,
              whiteSpace: "pre-line",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
