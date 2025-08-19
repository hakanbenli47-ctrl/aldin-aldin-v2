import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function SaticiBasvuru() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [firmaAdi, setFirmaAdi] = useState("");
  const [vergiNo, setVergiNo] = useState("");
  const [telefon, setTelefon] = useState("");
  const [belgeler, setBelgeler] = useState<{[key:string]: string}>({});
  const [sozlesmeOnay, setSozlesmeOnay] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Belge yükleme (ör: vergi levhası, kimlik vs.)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const fileName = `${user.id}/${key}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("satici-belgeleri") // 🔹 önce supabase’de bu bucket’ı oluştur
      .upload(fileName, file, { upsert: true });

    if (error) {
      setMessage("Belge yüklenemedi: " + error.message);
      return;
    }

    const { data } = supabase.storage.from("satici-belgeleri").getPublicUrl(fileName);
    if (data?.publicUrl) {
      setBelgeler(prev => ({ ...prev, [key]: data.publicUrl }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sozlesmeOnay) {
      setMessage("Sözleşmeyi onaylamadan başvuru gönderemezsiniz.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("satici_basvuru").insert([
      {
        user_id: user?.id,
        firma_adi: firmaAdi,
        vergi_no: vergiNo,
        telefon,
        belgeler,
        sozlesme_onay: sozlesmeOnay,
        durum: "pending"
      }
    ]);

    setLoading(false);

    if (error) {
      setMessage("Başvuru kaydedilemedi: " + error.message);
    } else {
      setMessage("✅ Başvurunuz başarıyla alındı. Onay sürecini bekleyin.");
      setFirmaAdi("");
      setVergiNo("");
      setTelefon("");
      setBelgeler({});
      setSozlesmeOnay(false);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 20, color: "#1648b0" }}>Satıcı Başvuru Formu</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>Firma Adı</label>
        <input
          type="text"
          value={firmaAdi}
          onChange={(e) => setFirmaAdi(e.target.value)}
          required
        />

        <label>Vergi No / TC</label>
        <input
          type="text"
          value={vergiNo}
          onChange={(e) => setVergiNo(e.target.value)}
        />

        <label>Telefon</label>
        <input
          type="text"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
        />

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
            marginTop: 10
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
