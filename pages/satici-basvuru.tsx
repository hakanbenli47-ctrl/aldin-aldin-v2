import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function SaticiBasvuru() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [firmaAdi, setFirmaAdi] = useState(""); // ✅ Otomatik dolacak
  const [vergiNo, setVergiNo] = useState("");
  const [telefon, setTelefon] = useState("");
  const [belgeler, setBelgeler] = useState<{ [key: string]: string }>({});
  const [sozlesmeOnay, setSozlesmeOnay] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/giris");
        return;
      }
      setUser(data.user);

      // ✅ Kullanıcının firmasını satıcı_firmalar tablosundan çek
      const { data: firma } = await supabase
        .from("satici_firmalar")
        .select("firma_adi")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (firma?.firma_adi) {
        setFirmaAdi(firma.firma_adi);
      }

      // Kullanıcının başvurusu var mı kontrol et
      const { data: existing } = await supabase
        .from("satici_basvuru")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (existing) {
        router.push("/satici-durum");
      }
    }
    checkUser();
  }, []);

  const sanitizeFileName = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    const safeName = sanitizeFileName(file.name);
    const fileName = `${user.id}/${key}-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("satici-belgeler")
      .upload(fileName, file, { upsert: true });

    if (error) {
      setMessage("Belge yüklenemedi: " + error.message);
      return;
    }

    // ✅ Public URL al
    const { data: publicData } = supabase.storage
      .from("satici-belgeler")
      .getPublicUrl(fileName);

    setBelgeler((prev) => ({
      ...prev,
      [key]: fileName, // ✅ artık tam URL kaydediyoruz
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sozlesmeOnay) {
      setMessage("Sözleşmeyi onaylamadan başvuru gönderemezsiniz.");
      return;
    }

    setLoading(true);
    setMessage("");

    // 🔥 Önceki başvuruyu sil
    await supabase.from("satici_basvuru").delete().eq("user_id", user?.id);

    // Yeni başvuruyu ekle
    const { error } = await supabase.from("satici_basvuru").insert([
      {
        user_id: user?.id,
        firma_adi: firmaAdi, // ✅ otomatik gelen firma adı
        vergi_no: vergiNo,
        telefon,
        belgeler,
        sozlesme_onay: sozlesmeOnay,
        durum: "pending",
      },
    ]);

    setLoading(false);

    if (error) {
      setMessage("Başvuru kaydedilemedi: " + error.message);
    } else {
      setMessage("✅ Başvurunuz başarıyla alındı. Onay sürecini bekleyin.");
      setVergiNo("");
      setTelefon("");
      setBelgeler({});
      setSozlesmeOnay(false);
      setTimeout(() => router.push("/satici-durum"), 2000);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 20, color: "#1648b0" }}>Satıcı Başvuru Formu</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>Firma Adı</label>
        <input type="text" value={firmaAdi} disabled /> {/* ✅ kullanıcı değiştiremiyor */}

        <label>Vergi No / TC</label>
        <input type="text" value={vergiNo} onChange={(e) => setVergiNo(e.target.value)} />

        <label>Telefon</label>
        <input type="text" value={telefon} onChange={(e) => setTelefon(e.target.value)} />

        <label>Vergi Levhası (PDF/JPG)</label>
        <input type="file" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, "vergi_levhasi")} />

        <label>Kimlik Belgesi (PDF/JPG)</label>
        <input type="file" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, "kimlik")} />

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
