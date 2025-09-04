// components/TopluPanelForm.tsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Kategori = { id: number; ad: string };

type PanelProduct = {
  title: string;
  desc?: string;
  price: string;
  stok: number;
  kategori_id: number;
  resim_url?: string;
  ozellikler?: Record<string, any>;
};

type Props = {
  kategoriler: Kategori[];
  onAddProduct: (p: PanelProduct) => void;
  onClose: () => void;
};

export default function TopluPanelForm({ kategoriler, onAddProduct, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stok, setStok] = useState(1);
  const [kategoriId, setKategoriId] = useState<number>(kategoriler[0]?.id || 1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    let photoUrl: string | undefined;

    if (file) {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("ilan-fotograflari")
        .upload(fileName, file);

      if (!error) {
        const { data } = supabase.storage.from("ilan-fotograflari").getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }
    }

    onAddProduct({
      title,
      desc,
      price,
      stok,
      kategori_id: kategoriId,
      resim_url: photoUrl,
    });

    setLoading(false);
    onClose();
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        marginTop: 10,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Panelden Ürün Ekle</h3>

      <input
        type="text"
        placeholder="Ürün Başlığı"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={inputStyle}
      />

      <textarea
        placeholder="Açıklama"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        style={inputStyle}
      />

      <input
        type="text"
        placeholder="Fiyat"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        style={inputStyle}
      />

      <input
        type="number"
        placeholder="Stok"
        value={stok}
        min={1}
        onChange={(e) => setStok(Number(e.target.value))}
        style={inputStyle}
      />

      <select
        value={kategoriId}
        onChange={(e) => setKategoriId(Number(e.target.value))}
        style={inputStyle}
      >
        {kategoriler.map((k) => (
          <option key={k.id} value={k.id}>
            {k.ad}
          </option>
        ))}
      </select>

      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          style={{
            flex: 1,
            background: "#199957",
            color: "#fff",
            padding: "10px",
            borderRadius: 8,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            background: "#e5e7eb",
            color: "#111",
            padding: "10px",
            borderRadius: 8,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 14,
  marginBottom: 8,
};
