import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Kategori = { id: number; ad: string };

export type PanelProduct = {
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
  onAddProducts: (p: PanelProduct[]) => void;
  onClose: () => void;
};

export default function TopluPanelForm({ kategoriler, onAddProducts, onClose }: Props) {
  const [products, setProducts] = useState<any[]>([
    {
      title: "",
      desc: "",
      price: "",
      stok: 1,
      kategori_id: kategoriler[0]?.id || 1,
      file: null,
      beden: [] as string[],
      renk: [] as string[],
      renkInput: "",
      agirlikMiktar: "",
      agirlikBirim: "kg",
      sonTuketim: "",
    },
  ]);

  const [loading, setLoading] = useState(false);

  const handleChange = (index: number, key: string, value: any) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [key]: value } : p))
    );
  };

  const addRow = () => {
    setProducts((prev) => [
      ...prev,
      {
        title: "",
        desc: "",
        price: "",
        stok: 1,
        kategori_id: kategoriler[0]?.id || 1,
        file: null,
        beden: [],
        renk: [],
        renkInput: "",
        agirlikMiktar: "",
        agirlikBirim: "kg",
        sonTuketim: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);
    const result: PanelProduct[] = [];

    for (const p of products) {
      let photoUrl: string | undefined;
      if (p.file) {
        const ext = p.file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("ilan-fotograflari")
          .upload(fileName, p.file);

        if (!error) {
          const { data } = supabase.storage
            .from("ilan-fotograflari")
            .getPublicUrl(fileName);
          photoUrl = data.publicUrl;
        }
      }

      result.push({
        title: p.title,
        desc: p.desc,
        price: p.price,
        stok: p.stok,
        kategori_id: p.kategori_id,
        resim_url: photoUrl,
        ozellikler: {
          beden: p.beden || [],
          renk: p.renk || [],
          agirlikMiktar: p.agirlikMiktar || null,
          agirlikBirim: p.agirlikBirim || null,
          sonTuketim: p.sonTuketim || null,
        },
      });
    }

    onAddProducts(result);
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
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Panelden Ürün Ekle
      </h3>

      {products.map((p, i) => {
        const catName =
          (
            kategoriler.find((k) => k.id === p.kategori_id)?.ad || ""
          ).toLowerCase();

        return (
          <div
            key={i}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <input
              type="text"
              placeholder="Ürün Başlığı"
              value={p.title}
              onChange={(e) => handleChange(i, "title", e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="Açıklama"
              value={p.desc}
              onChange={(e) => handleChange(i, "desc", e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Fiyat"
              value={p.price}
              onChange={(e) => handleChange(i, "price", e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="Stok"
              value={p.stok}
              min={1}
              onChange={(e) => handleChange(i, "stok", Number(e.target.value))}
              style={inputStyle}
            />
            <select
              value={p.kategori_id}
              onChange={(e) =>
                handleChange(i, "kategori_id", Number(e.target.value))
              }
              style={inputStyle}
            >
              {kategoriler.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>

            {/* 📸 Resim */}
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleChange(i, "file", e.target.files?.[0] || null)
              }
            />

            {/* 🔽 Kategoriye göre ek alanlar */}
            {catName.includes("gıda") && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  border: "1px dashed #ddd",
                  borderRadius: 6,
                }}
              >
                <label>Ağırlık</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="number"
                    placeholder="Miktar"
                    value={p.agirlikMiktar}
                    onChange={(e) =>
                      handleChange(i, "agirlikMiktar", e.target.value)
                    }
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <select
                    value={p.agirlikBirim}
                    onChange={(e) =>
                      handleChange(i, "agirlikBirim", e.target.value)
                    }
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="lt">lt</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                <label>Son Tüketim Tarihi</label>
                <input
                  type="date"
                  value={p.sonTuketim}
                  onChange={(e) =>
                    handleChange(i, "sonTuketim", e.target.value)
                  }
                  style={inputStyle}
                />
              </div>
            )}

            {catName.includes("giyim") && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  border: "1px dashed #ddd",
                  borderRadius: 6,
                }}
              >
                <label>Beden</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["S", "M", "L", "XL"].map((b) => (
                    <label key={b}>
                      <input
                        type="checkbox"
                        checked={Array.isArray(p.beden) && p.beden.includes(b)}
                        onChange={() => {
                          const arr = Array.isArray(p.beden) ? [...p.beden] : [];
                          if (arr.includes(b)) {
                            arr.splice(arr.indexOf(b), 1);
                          } else {
                            arr.push(b);
                          }
                          handleChange(i, "beden", arr);
                        }}
                      />
                      {b}
                    </label>
                  ))}
                </div>

                <label>Renkler</label>
                <input
                  type="text"
                  placeholder="Örn: Siyah, Beyaz"
                  value={p.renkInput}
                  onChange={(e) => handleChange(i, "renkInput", e.target.value)}
                  onBlur={() => {
                    const tokens = (p.renkInput || "")
                      .split(/[,;.]+/)
                      .map((s: string) => s.trim()) // ✅ string olarak belirtildi
                      .filter(Boolean);
                    if (tokens.length) handleChange(i, "renk", tokens);
                    handleChange(i, "renkInput", "");
                  }}
                  style={inputStyle}
                />
              </div>
            )}

            {products.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                style={{ color: "red", marginTop: 5 }}
              >
                Satırı Sil
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        style={{
          marginBottom: 12,
          background: "#e5e7eb",
          padding: 8,
          borderRadius: 6,
        }}
      >
        + Yeni Satır Ekle
      </button>

      <div style={{ display: "flex", gap: 8 }}>
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
            padding: "10px",
            borderRadius: 8,
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
