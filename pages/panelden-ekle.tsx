// pages/panelden-ekle.tsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

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
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const router = useRouter();

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

  // 📌 Kaydet: DB yerine localStorage → sonra ilan-ver'e yönlendir
  const handleSave = async () => {
    const final = rows.map((row) => ({
      title: row.title,
      desc: row.desc,
      price: row.price,
      stok: Number(row.stok || 1),
      kategori_id: Number(row.kategori_id),
      resim_url: row.resim_url || "",
      ozellikler: {
        beden: row.beden ? row.beden.split(",").map((b) => b.trim()) : [],
        renk: row.renk ? row.renk.split(",").map((r) => r.trim()) : [],
        agirlikMiktar: row.agirlikMiktar || null,
        agirlikBirim: row.agirlikBirim || null,
        sonTuketim: row.sonTuketim || null,
      },
    }));

    // Tarayıcı localStorage'a kaydet
    localStorage.setItem("panelProducts", JSON.stringify(final));

    // ilan-ver sayfasına yönlendir
    router.push("/ilan-ver");
  };

  const getKategoriAd = (id: string) => {
    const k = kategoriler.find((x) => x.id === Number(id));
    return k?.ad?.toLowerCase() || "";
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 15 }}>📦 Excel Tarzı Panelden Ürün Ekle</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 15 }}>
        <thead>
          <tr>
            <th style={thStyle}>title</th>
            <th style={thStyle}>desc</th>
            <th style={thStyle}>price</th>
            <th style={thStyle}>stok</th>
            <th style={thStyle}>kategori</th>
            <th style={thStyle}>resim_url</th>
            <th style={thStyle}>özellikler</th>
            <th style={thStyle}>sil</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const kategoriAd = getKategoriAd(row.kategori_id);
            const isGiyim = kategoriAd.includes("giyim");
            const isGida = kategoriAd.includes("gıda");

            return (
              <tr key={i}>
                <td><input value={row.title} onChange={(e) => handleChange(i, "title", e.target.value)} /></td>
                <td><input value={row.desc} onChange={(e) => handleChange(i, "desc", e.target.value)} /></td>
                <td><input value={row.price} onChange={(e) => handleChange(i, "price", e.target.value)} /></td>
                <td><input type="number" value={row.stok} onChange={(e) => handleChange(i, "stok", e.target.value)} /></td>
                <td>
                  <select value={row.kategori_id} onChange={(e) => handleChange(i, "kategori_id", e.target.value)}>
                    {kategoriler.map((k) => (
                      <option key={k.id} value={k.id}>{k.ad}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.resim_url || ""}
                    onChange={(e) => handleChange(i, "resim_url", e.target.value)}
                    placeholder="Resim URL"
                  />
                </td>
                <td>
                  {isGiyim && (
                    <>
                      <input
                        value={row.beden || ""}
                        onChange={(e) => handleChange(i, "beden", e.target.value)}
                        placeholder="Bedenler (S,M,L)"
                      />
                      <input
                        value={row.renk || ""}
                        onChange={(e) => handleChange(i, "renk", e.target.value)}
                        placeholder="Renkler (Kırmızı,Mavi)"
                      />
                    </>
                  )}
                  {isGida && (
                    <>
                      <input
                        value={row.agirlikMiktar || ""}
                        onChange={(e) => handleChange(i, "agirlikMiktar", e.target.value)}
                        placeholder="Ağırlık"
                      />
                      <input
                        value={row.agirlikBirim || ""}
                        onChange={(e) => handleChange(i, "agirlikBirim", e.target.value)}
                        placeholder="Birim (kg,g,lt,ml)"
                      />
                      <input
                        type="date"
                        value={row.sonTuketim || ""}
                        onChange={(e) => handleChange(i, "sonTuketim", e.target.value)}
                      />
                    </>
                  )}
                </td>
                <td>
                  <button type="button" onClick={() => removeRow(i)} style={{ color: "red" }}>
                    ❌
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button onClick={addRow} style={{ marginRight: 10 }}>+ Satır Ekle</button>
      <button onClick={handleSave}>Kaydet ve İlan Ver Sayfasına Dön</button>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: 6,
  background: "#f1f5f9",
};

