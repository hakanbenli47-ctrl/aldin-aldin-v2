import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
import Image from "next/image"; // LOGO için

type Kategori = {
  id: number;
  ad: string;
};

export default function IlanVer() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stok, setStok] = useState<number>(1); // YENİ!
  const [kategoriId, setKategoriId] = useState<number>(1);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function fetchKategoriler() {
      const { data } = await supabase.from("kategori").select("*");
      if (data) setKategoriler(data);
    }
    fetchKategoriler();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // FOTOĞRAF SEÇİLDİĞİNDE
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setSelectedFiles(files);

    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  // FOTOĞRAF SİLME
  const handleRemoveImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previewUrls.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newPreviews);
  };

  const uploadImagesAndGetUrls = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("ilan-fotograflari")
        .upload(fileName, file, { upsert: false });

      if (error) {
        setMessage("Fotoğraf yüklenemedi: " + error.message);
        return [];
      }

      const { data } = supabase.storage
        .from("ilan-fotograflari")
        .getPublicUrl(fileName);
      if (data && data.publicUrl) {
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (selectedFiles.length === 0) {
      setMessage("En az bir fotoğraf eklemelisiniz.");
      setLoading(false);
      return;
    }

    if (!stok || stok < 1) {
      setMessage("Stok adedi en az 1 olmalı.");
      setLoading(false);
      return;
    }

    const photoUrls = await uploadImagesAndGetUrls();
    if (photoUrls.length === 0) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("ilan").insert([
      {
        title,
        desc,
        price,
        stok, // YENİ EKLENDİ!
        kategori_id: kategoriId,
        resim_url: photoUrls,
        user_email: user?.email,
        user_id: user?.id,
        created_at: new Date(),
      },
    ]);

    setLoading(false);
    if (error) {
      setMessage("İlan kaydedilemedi: " + error.message);
    } else {
      setMessage("✅ İlan başarıyla kaydedildi!");
      setTitle("");
      setDesc("");
      setPrice("");
      setStok(1);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setTimeout(() => {
        router.push("/profil");
      }, 1200);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%)",
      padding: 0,
      margin: 0
    }}>
      {/* LOGO BAR */}
      <div style={{
        width: "100%",
        background: "#fff",
        boxShadow: "0 2px 8px #e5e7eb22",
        padding: "16px 0 10px 0",
        display: "flex",
        alignItems: "center"
      }}>
        <div
          style={{
            marginLeft: 36,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
          onClick={() => { window.location.href = "/" }}
        >
          <Image src="/logo.png" alt="Aldın Aldın Logo" width={36} height={36} />
          <span style={{
            fontSize: 23, fontWeight: 900, color: "#1a1a1a", letterSpacing: "0.6px"
          }}>
            Aldın Aldın
          </span>
        </div>
      </div>

      <div style={{
        maxWidth: 390,
        margin: "60px auto 0 auto",
        background: "#fff",
        borderRadius: 11,
        border: "1px solid #ececec",
        padding: 25,
        boxShadow: "0 4px 28px #e7e7e71a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        <h2 style={{
          fontWeight: 700,
          fontSize: 22,
          margin: "10px 0 13px",
          color: "#1a1a1a",
          letterSpacing: "0.2px"
        }}>Yeni İlan Oluştur</h2>

        {/* Büyük resim kutusu */}
        <div style={{
          width: "100%",
          height: 170,
          marginBottom: 13,
          borderRadius: 8,
          background: "#f4f4f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative"
        }}>
          {previewUrls && previewUrls[0] ? (
            <>
              <img
                src={previewUrls[0]}
                alt="Önizleme"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(0)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "#fff",
                  color: "#e11d48",
                  border: "1px solid #eee",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 19,
                  boxShadow: "0 2px 6px #e5e5e5",
                  zIndex: 2
                }}
                title="Sil"
              >✕</button>
            </>
          ) : (
            <span style={{ fontSize: 38, color: "#bbb" }} role="img" aria-label="görsel yok">🖼️</span>
          )}
        </div>

        {/* Küçük diğer fotoğraf önizlemeleri */}
        <div style={{
          display: "flex",
          gap: 6,
          marginBottom: 10,
          width: "100%",
          justifyContent: "center",
        }}>
          {previewUrls.slice(1).map((url, i) => (
            <div key={i + 1} style={{
              border: "1px solid #ececec",
              borderRadius: 6,
              width: 44,
              height: 44,
              overflow: "hidden",
              background: "#f4f4f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative"
            }}>
              <img
                src={url}
                alt={`Seçilen görsel ${i + 2}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(i + 1)}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  background: "#fff",
                  color: "#e11d48",
                  border: "1px solid #eee",
                  borderRadius: "50%",
                  width: 22,
                  height: 22,
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 14,
                  boxShadow: "0 2px 6px #e5e5e5",
                  zIndex: 2,
                  padding: 0
                }}
                title="Sil"
              >✕</button>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <label style={{
            fontWeight: 600,
            color: "#23272f",
            marginBottom: 3,
            fontSize: 15
          }}>Başlık</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="İlan başlığı"
            style={{
              width: "100%", marginBottom: 10, padding: 8,
              borderRadius: 7, border: "1px solid #ececec", fontSize: 15,
              background: "#fafafa", color: "#1a1a1a",
              fontWeight: 500,
              letterSpacing: "0.1px"
            }}
          />

          <label style={{
            fontWeight: 600,
            color: "#23272f",
            marginBottom: 3,
            fontSize: 15
          }}>Açıklama</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
            rows={2}
            placeholder="İlan açıklaması"
            style={{
              width: "100%", marginBottom: 10, padding: 8,
              borderRadius: 7, border: "1px solid #ececec", fontSize: 15,
              background: "#fafafa", color: "#1a1a1a",
              fontWeight: 500
            }}
          />

          <label style={{
            fontWeight: 600,
            color: "#23272f",
            marginBottom: 3,
            fontSize: 15
          }}>Fiyat</label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="Fiyat"
            style={{
              width: "100%", marginBottom: 10, padding: 8,
              borderRadius: 7, border: "1px solid #ececec", fontSize: 15,
              background: "#fafafa", color: "#1a1a1a",
              fontWeight: 500
            }}
          />

          {/* STOK */}
          <label style={{
            fontWeight: 600,
            color: "#23272f",
            marginBottom: 3,
            fontSize: 15
          }}>Stok Adedi</label>
          <input
            type="number"
            value={stok}
            min={1}
            onChange={e => setStok(Number(e.target.value))}
            required
            placeholder="Stok"
            style={{
              width: "100%", marginBottom: 10, padding: 8,
              borderRadius: 7, border: "1px solid #ececec", fontSize: 15,
              background: "#fafafa", color: "#1a1a1a",
              fontWeight: 500
            }}
          />

          <label style={{
            fontWeight: 600,
            color: "#23272f",
            marginBottom: 3,
            fontSize: 15
          }}>Kategori</label>
          <select
            value={kategoriId}
            onChange={(e) => setKategoriId(Number(e.target.value))}
            required
            style={{
              width: "100%", marginBottom: 10, padding: 8,
              borderRadius: 7, border: "1px solid #ececec", fontSize: 15,
              background: "#fafafa", color: "#1a1a1a",
              fontWeight: 500
            }}
          >
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>{k.ad}</option>
            ))}
          </select>

          <label style={{
            fontWeight: 600,
            color: "#23272f",
            marginBottom: 3,
            fontSize: 15
          }}>Fotoğraf Ekle (Birden fazla seçebilirsin)</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            style={{
              marginBottom: 13, fontSize: 15, cursor: "pointer", background: "#fafafa", color: "#222"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "#23272f",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              borderRadius: 7,
              padding: 13,
              fontSize: 16,
              marginTop: 4,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
              letterSpacing: "0.2px"
            }}
          >
            {loading ? "Kaydediliyor..." : "İlanı Ekle"}
          </button>
          {message && (
            <div style={{
              marginTop: 12,
              color: message.startsWith("✅") ? "#22c55e" : "#e11d48",
              fontWeight: 600, fontSize: 14, textAlign: "center"
            }}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
