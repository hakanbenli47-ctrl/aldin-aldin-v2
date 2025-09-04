// pages/panelden-ekle.tsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Kategori = { id: number; ad: string };

type Row = {
  title: string;
  desc: string;
  price: string;
  stok: string;
  kategori_id: string;
  resim_file?: File | null;
  resim_url?: string;
  beden?: string;
  renk?: string;
  agirlikMiktar?: string;
  agirlikBirim?: string;
  sonTuketim?: string;
};

export default function PaneldenEkle() {
  const [rows, setRows] = useState<Row[]>([
    { title: "", desc: "", price: "", stok: "1", kategori_id: "1" },
  ]);
  const [loading, setLoading] = useState(false);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);

  // Kategorileri yükle
  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from("kategori").select("*");
      if (data) setKategoriler(data);
    };
    fetchCategories();
  }, []);

  const handleChange = (i: number, key: keyof Row, value: any) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r))
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { title: "", desc: "", price: "", stok: "1", kategori_id: "1" },
    ]);
  };

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setLoading(true);
    const final: any[] = [];

    for (const row of rows) {
      let photoUrl = row.resim_url;

      // Dosya varsa supabase'e yükle
      if (row.resim_file) {
        const ext = row.resim_file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("ilan-fotograflari")
          .upload(fileName, row.resim_file);

        if (!error) {
          const { data } = supabase.storage
            .from("ilan-fotograflari")
            .getPublicUrl(fileName);
          photoUrl = data.publicUrl;
        }
      }

      final.push({
        title: row.title,
        desc: row.desc,
        price: row.price,
        stok: Number(row.stok || 1),
        kategori_id: Number(row.kategori_id),
        resim_url: photoUrl,
        ozellikler: {
          beden: row.beden
            ? row.beden.split(",").map((b) => b.trim())
            : [],
          renk: row.renk
            ? row.renk.split(",").map((r) => r.trim())
            : [],
          agirlikMiktar: row.agirlikMiktar || null,
          agirlikBirim: row.agirlikBirim || null,
          sonTuketim: row.sonTuketim || null,
        },
        created_at: new Date(),
      });
    }

    const { error } = await supabase.from("ilan").insert(final);
    setLoading(false);

    if (error) {
      alert("❌ Hata: " + error.message);
    } else {
      alert("✅ Ürünler kaydedildi!");
      setRows([{ title: "", desc: "", price: "", stok: "1", kategori_id: "1" }]);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 15 }}>📦 Excel Tarzı Panelden Ürün Ekle</h2>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          marginBottom: 15,
        }}
      >
        <thead>
          <tr>
            {[
              "title",
              "desc",
              "price",
              "stok",
              "kategori",
              "resim_url / dosya",
              "beden",
              "renk",
              "agirlikMiktar",
              "agirlikBirim",
              "sonTuketim",
              "sil",
            ].map((h) => (
              <th
                key={h}
                style={{
                  border: "1px solid #ddd",
                  padding: 6,
                  background: "#f1f5f9",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <input
                  value={row.title}
                  onChange={(e) => handleChange(i, "title", e.target.value)}
                />
              </td>
              <td>
                <input
                  value={row.desc}
                  onChange={(e) => handleChange(i, "desc", e.target.value)}
                />
              </td>
              <td>
                <input
                  value={row.price}
                  onChange={(e) => handleChange(i, "price", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={row.stok}
                  onChange={(e) => handleChange(i, "stok", e.target.value)}
                />
              </td>
              <td>
                <select
                  value={row.kategori_id}
                  onChange={(e) =>
                    handleChange(i, "kategori_id", e.target.value)
                  }
                >
                  {kategoriler.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ad}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="text"
                  value={row.resim_url || ""}
                  onChange={(e) =>
                    handleChange(i, "resim_url", e.target.value)
                  }
                  placeholder="Resim URL"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleChange(i, "resim_file", e.target.files?.[0] || null)
                  }
                />
              </td>
              <td>
                <input
                  value={row.beden || ""}
                  onChange={(e) => handleChange(i, "beden", e.target.value)}
                  placeholder="S,M,L"
                />
              </td>
              <td>
                <input
                  value={row.renk || ""}
                  onChange={(e) => handleChange(i, "renk", e.target.value)}
                  placeholder="Kırmızı,Mavi"
                />
              </td>
              <td>
                <input
                  value={row.agirlikMiktar || ""}
                  onChange={(e) =>
                    handleChange(i, "agirlikMiktar", e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  value={row.agirlikBirim || ""}
                  onChange={(e) =>
                    handleChange(i, "agirlikBirim", e.target.value)
                  }
                  placeholder="kg,g,lt,ml"
                />
              </td>
              <td>
                <input
                  type="date"
                  value={row.sonTuketim || ""}
                  onChange={(e) =>
                    handleChange(i, "sonTuketim", e.target.value)
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  style={{ color: "red" }}
                >
                  ❌
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={addRow} style={{ marginRight: 10 }}>
        + Satır Ekle
      </button>
      <button onClick={handleSave} disabled={loading}>
        {loading ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </div>
  );
}
