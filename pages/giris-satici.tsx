import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function GirisSatici() {
  const [firmaKodu, setFirmaKodu] = useState("");
  const [firmaAdi, setFirmaAdi] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Firma kodu değiştiğinde bilgileri otomatik çek
  useEffect(() => {
    if (!firmaKodu) {
      setFirmaAdi("");
      setEmail("");
      return;
    }
    const fetchFirma = async () => {
      const { data, error } = await supabase
        .from("satici_firmalar")
        .select("firma_adi, email")
        .eq("firma_kodu", firmaKodu)
        .single();
      if (data && !error) {
        setFirmaAdi(data.firma_adi);
        setEmail(data.email);
      } else {
        setFirmaAdi("");
        setEmail("");
      }
    };
    fetchFirma();
  }, [firmaKodu]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!firmaKodu || !firmaAdi || !email || !password) {
      setMessage("❌ Lütfen tüm alanları doldurun.");
      return;
    }

    setLoading(true);
    // Firma kodu, adı ve e-posta eşleşmesi kontrolü
    const { data: satici, error: saticiError } = await supabase
      .from("satici_firmalar")
      .select("user_id")
      .eq("firma_kodu", firmaKodu)
      .eq("firma_adi", firmaAdi)
      .eq("email", email)
      .single();

    if (saticiError || !satici) {
      setMessage("❌ Firma kodu, adı veya e-posta hatalı.");
      setLoading(false);
      return;
    }

    // E-posta + şifre ile giriş
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage("❌ Giriş başarısız: " + error.message);
      setLoading(false);
      return;
    }

    setMessage("✅ Giriş başarılı! Yönlendiriliyorsunuz...");
    setTimeout(() => {
      window.location.href = "/satici";
    }, 1500);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #e0f2fe 0%, #fff 100%)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 18px #e1e3e8bb",
          padding: 40,
          minWidth: 350,
          maxWidth: 410,
        }}
      >
        <h2
          style={{
            fontSize: 25,
            fontWeight: 800,
            color: "#223555",
            textAlign: "center",
            marginBottom: 28,
            letterSpacing: ".03em",
          }}
        >
          Satıcı Girişi
        </h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Firma Kodu"
            value={firmaKodu}
            onChange={(e) => setFirmaKodu(e.target.value)}
            style={{
              width: "100%",
              padding: 13,
              marginBottom: 15,
              border: "1.3px solid #cbd5e1",
              borderRadius: 9,
              fontSize: 16,
              background: "#f8fafc",
              color: "#222",
            }}
            autoComplete="off"
            disabled={loading}
          />
          <input
            type="text"
            placeholder="Firma Adı"
            value={firmaAdi}
            readOnly
            style={{
              width: "100%",
              padding: 13,
              marginBottom: 15,
              border: "1.3px solid #cbd5e1",
              borderRadius: 9,
              fontSize: 16,
              background: "#eef2f7",
              color: "#555",
            }}
          />
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            readOnly
            style={{
              width: "100%",
              padding: 13,
              marginBottom: 15,
              border: "1.3px solid #cbd5e1",
              borderRadius: 9,
              fontSize: 16,
              background: "#eef2f7",
              color: "#555",
            }}
          />
          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 13,
              marginBottom: 20,
              border: "1.3px solid #cbd5e1",
              borderRadius: 9,
              fontSize: 16,
              background: "#f8fafc",
              color: "#222",
            }}
            autoComplete="current-password"
            disabled={loading}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              background: loading ? "#bbb" : "#2563eb",
              color: "#fff",
              padding: 14,
              border: "none",
              borderRadius: 9,
              fontWeight: 800,
              fontSize: 18,
              marginBottom: 12,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: ".01em",
              boxShadow: "0 2px 8px #2563eb18",
            }}
            disabled={loading}
          >
            {loading ? "İşleniyor..." : "Giriş Yap"}
          </button>
        </form>
        {message && (
          <div
            style={{
              color: message.includes("✅") ? "#12b76a" : "#e11d48",
              textAlign: "center",
              marginTop: 13,
              fontWeight: 700,
              fontSize: 15.5,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
