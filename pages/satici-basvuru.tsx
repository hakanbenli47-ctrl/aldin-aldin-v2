// pages/satici-basvuru.tsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function SaticiBasvuru() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [firmaAdi, setFirmaAdi] = useState("");
  const [vergiNo, setVergiNo] = useState("");
  const [telefon, setTelefon] = useState("");
  const [belgeler, setBelgeler] = useState<{ [key: string]: string }>({});
  const [sozlesmeOnay, setSozlesmeOnay] = useState(false);

  // IBAN alanı: TR ile başlat
  const [iban, setIban] = useState("TR");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const ADMIN_EMAILS = ["80birinfo@gmail.com"];

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/giris");
        return;
      }
      setUser(data.user);

      const { data: firma } = await supabase
        .from("satici_firmalar")
        .select("firma_adi")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (firma?.firma_adi) setFirmaAdi(firma.firma_adi);

      const { data: existing } = await supabase
        .from("satici_basvuru")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (existing) router.push("/satici-durum");
    }
    checkUser();
  }, []);

  const sanitizeFileName = (name: string) =>
    name.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: string
  ) => {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    const safeName = sanitizeFileName(file.name);
    const fileName = `${key}-${user.id}-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("satici-belgeler")
      .upload(fileName, file, { upsert: true });

    if (error) {
      setMessage("Belge yüklenemedi: " + error.message);
      return;
    }

    const { data } = supabase
      .storage
      .from("satici-belgeler")
      .getPublicUrl(fileName);

    setBelgeler((prev) => ({
      ...prev,
      [key]: data.publicUrl,
    }));
  };

  async function sendMail(to: string, subject: string, text: string, html: string) {
    try {
      await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, html }),
      });
    } catch (err) {
      console.error("Mail gönderilemedi:", err);
    }
  }

  // --- IBAN yardımcıları ---
  const normalizeIban = (v: string) => v.replace(/[^\dA-Za-z]/g, "").toUpperCase();

  const isValidTrIban = (v: string) => {
    const s = normalizeIban(v);
    if (!/^TR\d{24}$/.test(s)) return false; // TR + 24 rakam
    // mod-97
    const rearranged = s.slice(4) + s.slice(0, 4);
    const expanded = rearranged.replace(/[A-Z]/g, (c) => (c.charCodeAt(0) - 55).toString());
    let rem = 0;
    for (const ch of expanded) rem = (rem * 10 + Number(ch)) % 97;
    return rem === 1;
  };

  // Yazarken otomatik TR + 4'lü gruplama + en fazla 24 rakam
  const formatTrIbanInput = (raw: string) => {
    const upper = raw.toUpperCase().replace(/\s+/g, "");
    // Başta TR varsa ayıkla, yoksa da dijitleri al
    let digits = upper.startsWith("TR") ? upper.slice(2) : upper.replace(/^TR/i, "");
    digits = digits.replace(/\D/g, "").slice(0, 24); // sadece rakam ve max 24
    const full = "TR" + digits;
    // 4'erli gruplandır
    return full.match(/.{1,4}/g)?.join(" ") ?? full;
  };

  const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIban(formatTrIbanInput(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vergiNo || !telefon || !belgeler.vergi_levhasi || !belgeler.kimlik) {
      setMessage("Lütfen tüm alanları doldurun ve gerekli belgeleri yükleyin.");
      return;
    }

    if (!sozlesmeOnay) {
      setMessage("Sözleşmeyi onaylamadan başvuru gönderemezsiniz.");
      return;
    }

    const cleanIban = normalizeIban(iban);
    if (!isValidTrIban(cleanIban)) {
      setMessage("Lütfen geçerli bir TR IBAN girin (TR + 24 rakam, ör. TR12 3456 7890 1234 5678 9012 34).");
      return;
    }

    setLoading(true);
    setMessage("");

    await supabase.from("satici_basvuru").delete().eq("user_id", user?.id);

    const { error } = await supabase.from("satici_basvuru").insert([{
      user_id: user?.id,
      firma_adi: firmaAdi,
      vergi_no: vergiNo,
      telefon,
      belgeler,
      sozlesme_onay: sozlesmeOnay,
      sozlesme_onay_tarih: new Date().toISOString(),
      durum: "pending",
      iban: cleanIban,
    }]);

    setLoading(false);

    if (error) {
      setMessage("Başvuru kaydedilemedi: " + error.message);
    } else {
      setMessage("✅ Başvurunuz başarıyla alındı. Onay sürecini bekleyin.");

      for (const admin of ADMIN_EMAILS) {
        sendMail(
          admin,
          "Yeni Satıcı Başvurusu",
          `${firmaAdi} firmasından yeni satıcı başvurusu yapıldı.`,
          `<p><b>${firmaAdi}</b> firmasından yeni satıcı başvurusu yapıldı.</p>
           <p>Vergi No: ${vergiNo || "-"}</p>
           <p>Telefon: ${telefon || "-"}</p>`
        );
      }

      setVergiNo("");
      setTelefon("");
      setBelgeler({});
      setSozlesmeOnay(false);
      setIban("TR");

      setTimeout(() => router.push("/satici-durum"), 2000);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 10, color: "#1648b0" }}>Satıcı Başvuru Formu</h2>
      <p style={{ color: "#555", fontSize: 14, marginBottom: 20 }}>
        Lütfen tüm alanları eksiksiz doldurun ve belgeleri yükleyin. Eksik başvurular değerlendirmeye alınmaz.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>Firma Adı</label>
        <input type="text" value={firmaAdi} disabled />

        <label>Vergi No / TC</label>
        <input type="text" required value={vergiNo} onChange={(e) => setVergiNo(e.target.value)} />

        <label>Telefon</label>
        <input type="text" required value={telefon} onChange={(e) => setTelefon(e.target.value)} />

        {/* --- IBAN --- */}
        <label>IBAN</label>
        <input
          type="text"
          required
          placeholder="TR__ ____ ____ ____ ____ ____ __"
          value={iban}
          onChange={handleIbanChange}
          onFocus={() => { if (!iban || !iban.startsWith("TR")) setIban("TR"); }}
          style={{ textTransform: "uppercase" }}
        />

        <label>Vergi Levhası (PDF/JPG)</label>
        <input
          type="file"
          required
          accept=".pdf,image/*"
          onChange={(e) => handleFileUpload(e, "vergi_levhasi")}
        />

        <label>Kimlik Belgesi (PDF/JPG)</label>
        <input
          type="file"
          required
          accept=".pdf,image/*"
          onChange={(e) => handleFileUpload(e, "kimlik")}
        />

        <label style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={sozlesmeOnay}
            onChange={(e) => setSozlesmeOnay(e.target.checked)}
            required
          />{" "}
          <a href="/sozlesme.pdf" target="_blank" style={{ color: "#1648b0", textDecoration: "underline" }}>
            Sözleşmeyi
          </a>{" "}
          okudum, onaylıyorum
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "linear-gradient(90deg,#199957 0%,#1648b0 90%)",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            borderRadius: 8,
            padding: "12px",
            cursor: "pointer",
            marginTop: 10,
          }}
        >
          {loading ? "Gönderiliyor..." : "Başvuruyu Gönder"}
        </button>
      </form>

      {message && (
        <div style={{ marginTop: 15, fontWeight: 600, color: message.startsWith("✅") ? "green" : "red" }}>
          {message}
        </div>
      )}
    </div>
  );
}
