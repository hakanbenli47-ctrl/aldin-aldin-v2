import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function KargoAyarlar({ user }: { user: any }) {
  const [firma, setFirma] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("satici_firmalar")
      .select("id, shipping_fee, free_shipping_enabled, free_shipping_threshold")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setFirma(data);
        setLoading(false);
      });
  }, [user]);

  async function handleSave() {
    if (!firma) return;
    const { error } = await supabase
      .from("satici_firmalar")
      .update({
        shipping_fee: Number(firma.shipping_fee || 0),
        free_shipping_enabled: !!firma.free_shipping_enabled,
        free_shipping_threshold: firma.free_shipping_enabled
          ? Number(firma.free_shipping_threshold || 0)
          : null,
      })
      .eq("id", firma.id);

    setMsg(error ? "Kaydedilemedi ❌" : "Kayıt güncellendi ✅");
  }

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Kargo Ayarları</h2>

      <div style={{ marginTop: 14 }}>
        <label>Standart Kargo Ücreti (₺)</label>
        <input
          type="number"
          value={firma?.shipping_fee || 0}
          onChange={(e) =>
            setFirma({ ...firma, shipping_fee: e.target.value })
          }
          style={{ width: "100%", padding: 8, marginTop: 5 }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label>
          <input
            type="checkbox"
            checked={firma?.free_shipping_enabled || false}
            onChange={(e) =>
              setFirma({ ...firma, free_shipping_enabled: e.target.checked })
            }
          />
          {" "}Şu fiyat üzeri kargo ücretsiz
        </label>
      </div>

      {firma?.free_shipping_enabled && (
        <div style={{ marginTop: 10 }}>
          <label>Eşik Tutarı (₺)</label>
          <input
            type="number"
            value={firma?.free_shipping_threshold || ""}
            onChange={(e) =>
              setFirma({ ...firma, free_shipping_threshold: e.target.value })
            }
            style={{ width: "100%", padding: 8, marginTop: 5 }}
          />
        </div>
      )}

      <button
        onClick={handleSave}
        style={{
          marginTop: 16,
          padding: "8px 20px",
          background: "#2563eb",
          color: "#fff",
          borderRadius: 6,
          fontWeight: 700,
          border: "none",
        }}
      >
        Kaydet
      </button>

      {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
