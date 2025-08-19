import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/router";

type Basvuru = {
  id: number;
  user_id: string;
  firma_adi: string;
  vergi_no?: string;
  telefon?: string;
  belgeler?: any;
  sozlesme_onay: boolean;
  durum: string;
  created_at: string;
};

export default function AdminSaticilar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [basvurular, setBasvurular] = useState<Basvuru[]>([]);
  const [message, setMessage] = useState("");

  // 👇 sadece bu mail admin olsun
  const ADMIN_EMAILS = ["80birinfo@gmail.com"];

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const currentUser = data?.user;
      setUser(currentUser);

      // eğer user yoksa → giriş sayfasına at
      if (!currentUser) {
        router.push("/giris");
        return;
      }

      // eğer admin değilse → anasayfaya at
      if (!currentUser.email || !ADMIN_EMAILS.includes(currentUser.email.toLowerCase())) {
        router.push("/");
        return;
      }

      // admin ise başvuruları yükle
      fetchBasvurular();
    });
  }, []);

  const fetchBasvurular = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("satici_basvuru")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Veri çekilemedi: " + error.message);
    } else {
      // 👉 belgeler text ise JSON'a çevir
      const parsed = (data || []).map((row: any) => ({
        ...row,
        belgeler: typeof row.belgeler === "string" ? JSON.parse(row.belgeler) : row.belgeler,
      }));
      setBasvurular(parsed);
    }
    setLoading(false);
  };

  const updateDurum = async (id: number, durum: "approved" | "rejected") => {
    const { error } = await supabase
      .from("satici_basvuru")
      .update({ durum })
      .eq("id", id);

    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setMessage("Başvuru güncellendi.");
      fetchBasvurular();
    }
  };

  if (loading) return <p style={{ padding: 30 }}>Yükleniyor...</p>;

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 20, color: "#1648b0" }}>Satıcı Başvuruları</h2>

      {message && <p style={{ color: "green", fontWeight: 600 }}>{message}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f4f7fa", textAlign: "left" }}>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Firma</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Vergi No</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Telefon</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Belgeler</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Durum</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {basvurular.map((b) => (
            <tr key={b.id}>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>{b.firma_adi}</td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>{b.vergi_no || "-"}</td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>{b.telefon || "-"}</td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>
                {b.belgeler ? (
                  Object.entries(b.belgeler).map(([k, v]) => (
                    <div key={k}>
                      <a href={String(v)} target="_blank" style={{ color: "#1648b0" }}>
                        {k}
                      </a>
                    </div>
                  ))
                ) : (
                  "-"
                )}
              </td>
              <td style={{ padding: 8, border: "1px solid #ddd", fontWeight: 600 }}>
                {b.durum === "pending" && <span style={{ color: "orange" }}>Beklemede</span>}
                {b.durum === "approved" && <span style={{ color: "green" }}>Onaylandı</span>}
                {b.durum === "rejected" && <span style={{ color: "red" }}>Reddedildi</span>}
              </td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>
                {b.durum === "pending" && (
                  <>
                    <button
                      onClick={() => updateDurum(b.id, "approved")}
                      style={{
                        marginRight: 6,
                        background: "green",
                        color: "#fff",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Onayla
                    </button>
                    <button
                      onClick={() => updateDurum(b.id, "rejected")}
                      style={{
                        background: "red",
                        color: "#fff",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Reddet
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
