// pages/admin/saticilar.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/router";

type Basvuru = {
  id: number;
  user_id: string;
  firma_adi: string;
  vergi_no?: string;
  telefon?: string;
  belgeler?: Record<string, string>;
  sozlesme_onay: boolean;
  durum: "pending" | "approved" | "rejected";
  created_at: string;
  red_nedeni?: string;
  user_email?: string;
  iban?: string;
};

type OdemeSatiri = {
  firma_adi: string;
  toplam_satis: number;
  komisyon: number;
  net_odeme: number;
};

type HeroSlide = {
  id: number;
  title: string;
  sub: string;
  cta: string;
  href: string;
  img: string;
  order: number;
  aktif: boolean;
};


export default function AdminSaticilar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [basvurular, setBasvurular] = useState<Basvuru[]>([]);
  const [message, setMessage] = useState("");
  const [redAciklama, setRedAciklama] = useState<Record<number, string>>({});
  const [odemeler, setOdemeler] = useState<OdemeSatiri[]>([]);
  const KOMISYON_ORANI = 0.1; // %10 komisyon

  const ADMIN_EMAILS = ["80birinfo@gmail.com"];

  // HeroSlides
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [newSlide, setNewSlide] = useState<Partial<HeroSlide>>({});

  const formatIban = (v?: string) =>
    v ? v.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim() : "—";

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const currentUser = data?.user;
      setUser(currentUser);

      if (!currentUser) {
        router.push("/giris");
        return;
      }
      if (
        !currentUser.email ||
        !ADMIN_EMAILS.includes(currentUser.email.toLowerCase())
      ) {
        router.push("/");
        return;
      }
      fetchBasvurular();
      fetchOdemeler();
      fetchHeroSlides();
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
      setLoading(false);
      return;
    }

    const parsed: Basvuru[] = [];
    for (const row of (data || []) as any[]) {
      let belgeler: Record<string, string> | undefined;
      if (row.belgeler) {
        const parsedBelge =
          typeof row.belgeler === "string"
            ? JSON.parse(row.belgeler)
            : row.belgeler;

        belgeler = {};
        for (const [k, v] of Object.entries(parsedBelge)) {
          let url = v as string;
          if (!/^https?:\/\//i.test(url)) {
            const { data: urlData } = supabase.storage
              .from("satici-belgeler")
              .getPublicUrl(url);
            url = urlData.publicUrl;
          }
          belgeler[k] = url;
        }
      }
      parsed.push({ ...row, belgeler });
    }
    setBasvurular(parsed);
    setLoading(false);
  };

  const fetchOdemeler = async () => {
    const { data, error } = await supabase
      .from("siparisler")
      .select("id, toplam_tutar, status, satici_id, saticilar(firma_adi)")
      .eq("status", "delivered");

    if (error) {
      console.error("Siparişler alınamadı:", error.message);
      return;
    }

    const grouped: Record<string, OdemeSatiri> = {};
    (data || []).forEach((row: any) => {
      const firma = row.saticilar?.firma_adi || "Bilinmiyor";
      if (!grouped[firma]) {
        grouped[firma] = {
          firma_adi: firma,
          toplam_satis: 0,
          komisyon: 0,
          net_odeme: 0,
        };
      }
      grouped[firma].toplam_satis += row.toplam_tutar;
    });

    Object.values(grouped).forEach((g) => {
      g.komisyon = g.toplam_satis * KOMISYON_ORANI;
      g.net_odeme = g.toplam_satis - g.komisyon;
    });

    setOdemeler(Object.values(grouped));
  };

  // HeroSlides fetch
   const fetchHeroSlides = async () => {
  const { data, error } = await supabase
    .from("hero_slides")
    .select('id, title, sub, cta, href, img, "order", aktif'); // 👈 order tırnaklı

  if (!error && data) setHeroSlides(data as HeroSlide[]);
};


  const addHeroSlide = async () => {
    if (!newSlide.title || !newSlide.img) {
      alert("Başlık ve görsel zorunlu!");
      return;
    }
    const { error } = await supabase.from("hero_slides").insert([
  {
    title: newSlide.title,
    sub: newSlide.sub || "",
    cta: newSlide.cta || "Keşfet",
    href: newSlide.href || "/",
    img: newSlide.img,
    "order": newSlide.order || heroSlides.length + 1, // 👈 order tırnaklı
    aktif: true,
  },
]);

    if (error) {
      alert("Hata: " + error.message);
      return;
    }
    setNewSlide({});
    fetchHeroSlides();
  };

  const deleteHeroSlide = async (id: number) => {
    await supabase.from("hero_slides").delete().eq("id", id);
    fetchHeroSlides();
  };

  async function sendMail(
    to: string,
    subject: string,
    text: string,
    html: string
  ) {
    try {
      await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, html }),
      });
    } catch (err) {
      console.error("Mail gönderilemedi:", err);
    }
  }

  const updateDurum = async (id: number, durum: "approved" | "rejected") => {
    let updateData: any = { durum };
    if (durum === "rejected") {
      updateData.red_nedeni = redAciklama[id] || "";
    }

    const { error } = await supabase
      .from("satici_basvuru")
      .update(updateData)
      .eq("id", id);

    if (error) {
      setMessage("Hata: " + error.message);
      return;
    }

    setMessage("Başvuru güncellendi.");
    fetchBasvurular();

    const basvuru = basvurular.find((b) => b.id === id);
    if (basvuru?.user_email) {
      if (durum === "approved") {
        sendMail(
          basvuru.user_email,
          "Satıcı Başvurunuz Onaylandı",
          `Merhaba ${basvuru.firma_adi}, satıcı başvurunuz onaylandı.`,
          `<p>Merhaba <b>${basvuru.firma_adi}</b>,</p>
           <p>Satıcı başvurunuz <span style="color:green">ONAYLANDI ✅</span>.</p>
           <p>Artık ürünlerinizi eklemeye başlayabilirsiniz.</p>`
        );
      } else {
        sendMail(
          basvuru.user_email,
          "Satıcı Başvurunuz Reddedildi",
          `Merhaba ${basvuru.firma_adi}, başvurunuz reddedildi. Sebep: ${
            redAciklama[id] || ""
          }`,
          `<p>Merhaba <b>${basvuru.firma_adi}</b>,</p>
           <p>Satıcı başvurunuz <span style="color:red">REDDEDİLDİ ❌</span>.</p>
           <p>Sebep: ${redAciklama[id] || "Belirtilmedi"} </p>`
        );
      }
    }
  };

  if (loading) return <p style={{ padding: 30 }}>Yükleniyor...</p>;

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 20, color: "#1648b0" }}>Satıcı Başvuruları</h2>

      {message && <p style={{ color: "green", fontWeight: 600 }}>{message}</p>}

      {/* Başvurular tablosu */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f4f7fa", textAlign: "left" }}>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Firma</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Vergi No</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Telefon</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Belgeler</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>Durum</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>IBAN</th>
            <th style={{ padding: 8, border: "1px solid #ddd" }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {basvurular.map((b) => (
            <tr key={b.id}>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>
                {b.firma_adi}
              </td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>
                {b.vergi_no || "-"}
              </td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>
                {b.telefon || "-"}
              </td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>
                {b.belgeler && Object.keys(b.belgeler).length > 0
                  ? Object.entries(b.belgeler).map(([k, v]) => (
                      <div key={k}>
                        <a
                          href={v}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#1648b0" }}
                        >
                          {k.toUpperCase()}
                        </a>
                      </div>
                    ))
                  : "-"}
              </td>
              <td
                style={{
                  padding: 8,
                  border: "1px solid #ddd",
                  fontWeight: 600,
                }}
              >
                {b.durum === "pending" && (
                  <span style={{ color: "orange" }}>Beklemede</span>
                )}
                {b.durum === "approved" && (
                  <span style={{ color: "green" }}>Onaylandı</span>
                )}
                {b.durum === "rejected" && (
                  <span style={{ color: "red" }}>
                    Reddedildi {b.red_nedeni ? `(${b.red_nedeni})` : ""}
                  </span>
                )}
              </td>
              <td style={{ padding: 8, border: "1px solid #ddd" }}>
                {formatIban(b.iban)}
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
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="Red nedeni..."
                        value={redAciklama[b.id] || ""}
                        onChange={(e) =>
                          setRedAciklama({
                            ...redAciklama,
                            [b.id]: e.target.value,
                          })
                        }
                        style={{ width: "100%", padding: 6, marginBottom: 6 }}
                      />
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
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Ödeme Tablosu */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ marginBottom: 20, color: "#1648b0" }}>Satıcı Ödemeleri</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f7fa" }}>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Firma</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>
                Toplam Satış
              </th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Komisyon</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Net Ödeme</th>
            </tr>
          </thead>
          <tbody>
            {odemeler.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>
                  {s.firma_adi}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>
                  {s.toplam_satis.toFixed(2)} ₺
                </td>
                <td
                  style={{ padding: 8, border: "1px solid #ddd", color: "red" }}
                >
                  -{s.komisyon.toFixed(2)} ₺
                </td>
                <td
                  style={{
                    padding: 8,
                    border: "1px solid #ddd",
                    fontWeight: 600,
                    color: "green",
                  }}
                >
                  {s.net_odeme.toFixed(2)} ₺
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hero Slider Yönetimi */}
      <div style={{ marginTop: 50 }}>
        <h2 style={{ marginBottom: 20, color: "#1648b0" }}>Hero Slider Yönetimi</h2>

        {/* Yeni slide ekle formu */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Başlık"
            value={newSlide.title || ""}
            onChange={(e) => setNewSlide({ ...newSlide, title: e.target.value })}
            style={{ marginRight: 6, padding: 6 }}
          />
          <input
            type="text"
            placeholder="Alt Başlık"
            value={newSlide.sub || ""}
            onChange={(e) => setNewSlide({ ...newSlide, sub: e.target.value })}
            style={{ marginRight: 6, padding: 6 }}
          />
          <input
            type="text"
            placeholder="CTA"
            value={newSlide.cta || ""}
            onChange={(e) => setNewSlide({ ...newSlide, cta: e.target.value })}
            style={{ marginRight: 6, padding: 6 }}
          />
          <input
            type="text"
            placeholder="Link (href)"
            value={newSlide.href || ""}
            onChange={(e) => setNewSlide({ ...newSlide, href: e.target.value })}
            style={{ marginRight: 6, padding: 6 }}
          />
          <input
            type="text"
            placeholder="Resim URL"
            value={newSlide.img || ""}
            onChange={(e) => setNewSlide({ ...newSlide, img: e.target.value })}
            style={{ marginRight: 6, padding: 6 }}
          />
          <input
            type="number"
            placeholder="Sıra"
            value={newSlide.order || ""}
            onChange={(e) =>
              setNewSlide({ ...newSlide, order: Number(e.target.value) })
            }
            style={{ marginRight: 6, padding: 6, width: 80 }}
          />
          <button onClick={addHeroSlide} style={{ padding: "6px 12px" }}>
            ➕ Ekle
          </button>
        </div>

        {/* Var olan slider listesi */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f7fa" }}>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>ID</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Başlık</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Alt Başlık</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>CTA</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Link</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Resim</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Sıra</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>Aktif</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {heroSlides.map((h) => (
              <tr key={h.id}>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>{h.id}</td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>{h.title}</td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>{h.sub}</td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>{h.cta}</td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>{h.href}</td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>
                  <img src={h.img} alt="" style={{ width: 100 }} />
                </td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>{h.order}</td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>
                  {h.aktif ? "✅" : "❌"}
                </td>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>
                  <button
                    onClick={() => deleteHeroSlide(h.id)}
                    style={{
                      background: "red",
                      color: "#fff",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
