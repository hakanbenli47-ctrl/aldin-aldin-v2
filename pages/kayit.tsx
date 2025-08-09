// pages/kayit.tsx
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
      setMessage("Lütfen e‑posta, şifre ve kullanıcı tipini girin.");
      return;
    }
    if (userType === "satici" && !firmaAdi) {
      setMessage("Satıcılar için firma adı zorunludur.");
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

      // ⬇️ DEĞİŞİKLİK: "User already registered" ise direkt girişe
      if (error) {
        if (String(error.message).toLowerCase().includes("user already registered")) {
          window.location.href = `/giris?email=${encodeURIComponent(email)}`;
          return;
        }
        throw error;
      }

      if (userType === "satici") {
        // Satıcı akışı (dokunmadım, sadece yönlendirme)
        const firmaKodu = "FIRMA-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        await supabase.from("satici_firmalar").insert([
          { user_id: data.user?.id, firma_kodu: firmaKodu, email, firma_adi: firmaAdi },
        ]);

        fetch("/api/send-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Satıcı Kaydı - Firma Kodunuz",
            text: `Tebrikler! Satıcı kaydınız oluşturuldu.\n\nFirma: ${firmaAdi}\nFirma Kodu: ${firmaKodu}\n\n80bir`,
          }),
        }).catch(() => {});

        // ⬇️ DEĞİŞİKLİK: email parametresiyle girişe
        window.location.href = `/giris?email=${encodeURIComponent(email)}`;
        return;
      }

      // ⬇️ DEĞİŞİKLİK: Alıcı da email parametresiyle girişe
      window.location.href = `/giris?email=${encodeURIComponent(email)}`;
    } catch (err: any) {
      setMessage("Kayıt başarısız: " + (err?.message ?? "Bilinmeyen hata"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#fff",
        color: "#111",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial",
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
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>Kayıt Ol</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setUserType("alici")}
            disabled={loading}
            style={{
              flex: 1, padding: "8px 10px", borderRadius: 8,
              border: userType === "alici" ? "1px solid #111" : "1px solid #d1d5db",
              background: userType === "alici" ? "#111" : "#fff",
              color: userType === "alici" ? "#fff" : "#111", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >Alıcı</button>
          <button
            type="button"
            onClick={() => setUserType("satici")}
            disabled={loading}
            style={{
              flex: 1, padding: "8px 10px", borderRadius: 8,
              border: userType === "satici" ? "1px solid #111" : "1px solid #d1d5db",
              background: userType === "satici" ? "#111" : "#fff",
              color: userType === "satici" ? "#fff" : "#111", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >Satıcı</button>
        </div>

        <form onSubmit={handleSignup} style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 13 }}>E‑posta</label>
          <input
            type="email" placeholder="ornek@mail.com" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={loading}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111" }}
          />

          <label style={{ fontSize: 13 }}>Şifre (min 6)</label>
          <input
            type="password" placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" disabled={loading}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111" }}
          />

          {userType === "satici" && (
            <>
              <label style={{ fontSize: 13 }}>Firma Adı</label>
              <input
                type="text" placeholder="Firma Adı" value={firmaAdi}
                onChange={(e) => setFirmaAdi(e.target.value)} disabled={loading}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111" }}
              />
            </>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, padding: "10px 12px", borderRadius: 8,
              border: "1px solid #111", background: loading ? "#f3f4f6" : "#111",
              color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "İşleniyor…" : "Kayıt Ol"}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", color: "#111", fontSize: 13 }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
