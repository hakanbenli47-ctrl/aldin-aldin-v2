import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Kayit() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firmaAdi, setFirmaAdi] = useState("");
  const [userType, setUserType] = useState<"alici" | "satici" | "">("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !userType) {
      setMessage("❌ Lütfen e-posta, şifre ve kullanıcı tipini girin.");
      return;
    }
    if (userType === "satici" && !firmaAdi) {
      setMessage("❌ Satıcılar için firma adı zorunludur.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${baseUrl}/auth/callback`,
          data: { userType, firmaAdi },
        },
      });
      if (error) throw error;

      if (userType === "satici") {
        const firmaKodu = "FIRMA-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        await supabase.from("satici_firmalar").insert([
          {
            user_id: data.user?.id,
            firma_kodu: firmaKodu,
            email,
            firma_adi: firmaAdi,
          },
        ]);

        // basit e-posta bildirimi (server route)
        fetch("/api/send-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Satıcı Kaydı - Firma Kodunuz",
            text: `Tebrikler! Satıcı kaydınız oluşturuldu.\n\nFirma: ${firmaAdi}\nFirma Kodu: ${firmaKodu}\n\n80bir`,
          }),
        }).catch(() => {});
      }

      // ✅ Kaydolduktan sonra doğrudan OTP girişine yönlendir
      window.location.href = `/giris?method=otp&email=${encodeURIComponent(email)}`;
    } catch (err: any) {
      setMessage("❌ Kayıt başarısız: " + (err?.message ?? "Bilinmeyen hata"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#f7fafc,#eef2f7)" }}>
      <div style={{ width: 420, background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(31,38,135,.1)", padding: 28, border: "1px solid #e6ebf2" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setUserType("alici")}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 12,
              border: userType === "alici" ? "2px solid #12b76a" : "1px solid #e5e7eb",
              background: userType === "alici" ? "#12b76a" : "#f8fafc",
              color: userType === "alici" ? "#fff" : "#223555", fontWeight: 700, cursor: "pointer"
            }}
            disabled={loading}
          >Alıcı</button>
          <button
            type="button"
            onClick={() => setUserType("satici")}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 12,
              border: userType === "satici" ? "2px solid #2563eb" : "1px solid #e5e7eb",
              background: userType === "satici" ? "#2563eb" : "#f8fafc",
              color: userType === "satici" ? "#fff" : "#223555", fontWeight: 700, cursor: "pointer"
            }}
            disabled={loading}
          >Satıcı</button>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#223555", marginBottom: 16, textAlign: "center" }}>Kayıt Ol</h2>

        <form onSubmit={handleSignup} style={{ display: "grid", gap: 12 }}>
          <input
            type="email" placeholder="E-posta" value={email} onChange={e=>setEmail(e.target.value)}
            autoComplete="email"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #d8dee9", background: "#fafcff" }} disabled={loading}
          />
          <input
            type="password" placeholder="Şifre (min 6)" value={password} onChange={e=>setPassword(e.target.value)}
            autoComplete="new-password"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #d8dee9", background: "#fafcff" }} disabled={loading}
          />
          {userType === "satici" && (
            <input
              type="text" placeholder="Firma Adı" value={firmaAdi} onChange={e=>setFirmaAdi(e.target.value)}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #d8dee9", background: "#fafcff" }} disabled={loading}
            />
          )}

          <button
            type="submit" disabled={loading}
            style={{ padding: 12, borderRadius: 12, border: "none", background: loading ? "#a5b4fc" : "#6366f1", color: "#fff", fontWeight: 800, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "İşleniyor…" : "Kayıt Ol"}
          </button>
        </form>

        {message && <p style={{ marginTop: 12, textAlign: "center", color: message.startsWith("✅") ? "#12b76a" : "#e23c3c", fontWeight: 700 }}>{message}</p>}
      </div>
    </div>
  );
}
