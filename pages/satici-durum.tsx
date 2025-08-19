import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

type Basvuru = {
  firma_adi: string;
  durum: string;
  created_at: string;
  red_nedeni?: string;
  belgeler?: { [key: string]: string };
};

export default function SaticiDurum() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [basvuru, setBasvuru] = useState<Basvuru | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/giris");
        return;
      }
      setUser(user);

      const { data } = await supabase
        .from("satici_basvuru")
        .select("firma_adi, durum, created_at, red_nedeni, belgeler")
        .eq("user_id", user.id)
        .single();

      if (data) setBasvuru(data);
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) return (
    <div style={{ padding: 20, textAlign: "center" }}>
      🔄 Başvuru bilgileri getiriliyor...
    </div>
  );

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 10 }}>
      <h2 style={{ marginBottom: 20, color: "#1648b0" }}>Satıcı Başvuru Durumu</h2>

      {!basvuru && (
        <div>
          <p>Henüz bir başvurunuz bulunmuyor.</p>
          <button
            onClick={() => router.push("/satici-basvuru")}
            style={{
              marginTop: 10,
              padding: "10px 16px",
              background: "#1648b0",
              color: "#fff",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
            }}
          >
            Başvuru Yap
          </button>
        </div>
      )}

      {basvuru && (
        <div>
          <p><b>Firma:</b> {basvuru.firma_adi}</p>
          <p><b>Başvuru Tarihi:</b> {new Date(basvuru.created_at).toLocaleDateString()}</p>
          <p>
            <b>Durum:</b>{" "}
            {basvuru.durum === "pending" && <span style={{ color: "orange" }}>⏳ İncelemede</span>}
            {basvuru.durum === "approved" && <span style={{ color: "green" }}>✅ Onaylandı</span>}
            {basvuru.durum === "rejected" && <span style={{ color: "red" }}>❌ Reddedildi</span>}
          </p>

          {basvuru.durum === "rejected" && basvuru.red_nedeni && (
            <p style={{ color: "red" }}>
              <b>Red Nedeni:</b> {basvuru.red_nedeni}
            </p>
          )}

          {basvuru.belgeler && (
            <div style={{ marginTop: 10 }}>
              <b>Yüklenen Belgeler:</b>
              <ul>
                {Object.entries(basvuru.belgeler).map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" style={{ color: "#1648b0" }}>
                      {key.toUpperCase()}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {basvuru.durum === "approved" && (
            <button
              onClick={() => router.push("/ilan-ver")}
              style={{
                marginTop: 15,
                padding: "10px 16px",
                background: "green",
                color: "#fff",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              Ürün Eklemeye Başla
            </button>
          )}
        </div>
      )}
    </div>
  );
}
