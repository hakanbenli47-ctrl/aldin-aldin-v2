// pages/urun/[id].tsx
import { useRouter } from "next/router";
import Image from "next/image";
import { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient"; // ✅ Supabase import

interface Ilan {
  id: number;
  title: string;
  price: number;
  resim_url: string[] | string;
  kategori_id?: number;
  user_email?: string;
  doped?: boolean;
  desc?: string;
}

function renderStars(rating: number, max = 5) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = max - full - half;
  return (
    <>
      {Array(full).fill(0).map((_, i) => <span key={"f"+i}>★</span>)}
      {half ? <span key="h">☆</span> : null}
      {Array(empty).fill(0).map((_, i) => <span key={"e"+i}>☆</span>)}
    </>
  );
}

export async function getServerSideProps(context: any) {
  const { id } = context.params;

  const { data: ilan, error } = await supabase
    .from("ilan")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !ilan) return { notFound: true };

  let firmaAdi = null;
  let firmaPuan = 0;
  if (ilan.user_email) {
    const { data: firma } = await supabase
      .from("satici_firmalar")
      .select("firma_adi, puan")
      .eq("email", ilan.user_email)
      .single();
    firmaAdi = firma?.firma_adi || null;
    firmaPuan = firma?.puan ?? 0;
  }

  const { data: benzerler } = await supabase
    .from("ilan")
    .select("*")
    .eq("kategori_id", ilan.kategori_id)
    .neq("id", ilan.id)
    .limit(8);

  return {
    props: {
      ilan,
      firmaAdi,
      firmaPuan,
      benzerler: benzerler || [],
    },
  };
}

export default function UrunDetay({
  ilan,
  firmaAdi,
  firmaPuan,
  benzerler,
}: {
  ilan: Ilan;
  firmaAdi: string | null;
  firmaPuan: number;
  benzerler: Ilan[];
}) {
  const router = useRouter();
  const { from } = router.query;

  const [mainImg, setMainImg] = useState<string | null>(null);
  const [favori, setFavori] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [yorumlar, setYorumlar] = useState<any[]>([]);
  const [yorum, setYorum] = useState("");
  const [puan, setPuan] = useState(5);

  const anasayfaPath = from === "index2" ? "/index2" : "/";
  const sepetPath = from === "index2" ? "/sepet2" : "/sepet";

  async function fetchYorumlar() {
    const { data } = await supabase
      .from("yorumlar")
      .select("*")
      .eq("urun_id", ilan.id)
      .order("created_at", { ascending: false });
    setYorumlar(data || []);
  }

  // İlk yüklemede tek sefer çalışır
  useEffect(() => {
    setShareUrl(window.location.href);
    setMainImg(
      Array.isArray(ilan.resim_url)
        ? ilan.resim_url[0] || "/placeholder.jpg"
        : ilan.resim_url || "/placeholder.jpg"
    );
    fetchYorumlar();
  }, []);

  // Kullanıcıyı çek
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // Favori kontrolü
  useEffect(() => {
    if (!user) return;
    async function checkFavori() {
      const { data } = await supabase
        .from("favoriler")
        .select("ilan_id")
        .eq("user_id", user.id)
        .eq("ilan_id", ilan.id)
        .single();
      setFavori(!!data);
    }
    checkFavori();
  }, [user, ilan.id]);
  const sepeteEkle = async (urun: Ilan) => {
    if (!user) {
      alert("Lütfen giriş yapınız!");
      router.push("/rol-secim");
      return;
    }
    const { data: sepetteVar } = await supabase
      .from("cart")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_id", urun.id)
      .single();
    if (sepetteVar) {
      await supabase
        .from("cart")
        .update({ adet: sepetteVar.adet + 1 })
        .eq("id", sepetteVar.id);
    } else {
      await supabase
        .from("cart")
        .insert([{ user_id: user.id, product_id: urun.id, adet: 1 }]);
    }
    alert("Sepete eklendi!");
  };

  const favoriyeToggle = async () => {
    if (!user) {
      alert("Lütfen giriş yapınız!");
      router.push("/giris");
      return;
    }
    if (favori) {
      await supabase
        .from("favoriler")
        .delete()
        .eq("user_id", user.id)
        .eq("ilan_id", ilan.id);
      setFavori(false);
    } else {
      await supabase
        .from("favoriler")
        .insert([{ user_id: user.id, ilan_id: ilan.id }]);
      setFavori(true);
    }
  };

  const sepeteGit = () => {
    router.push(sepetPath);
  };

  const logoClick = () => {
    router.push(anasayfaPath);
  };

  const badge = ilan.doped ? "Fırsat" : "Yeni";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f6f7f9 0%, #e4ecef 100%)",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 0,
        margin: 0,
      }}
    >
      <Head>
        <title>{ilan.title} - Aldın Aldın</title>
        <meta name="description" content={ilan.desc?.slice(0, 120)} />
      </Head>

      {/* HEADER - LOGO */}
      <div
        style={{
          width: "100%",
          background: "#fff",
          boxShadow: "0 2px 12px #1bbd8a09",
          padding: "16px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          position: "sticky",
          top: 0,
          zIndex: 50,
          cursor: "pointer",
        }}
        onClick={logoClick}
        title="Anasayfa"
      >
        <Image src="/logo.png" alt="Aldın Aldın Logo" width={40} height={40} />
        <span
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#1a1a1a",
            letterSpacing: 1,
          }}
        ></span>
      </div>

      {/* DETAY + BENZERLER */}
      <div
        style={{
          width: "100%",
          maxWidth: "100vw",
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "center",
          margin: "0 auto",
          position: "relative",
        }}
      >
        {/* ÜRÜN DETAYI */}
        <div
          style={{
            flex: "0 0 460px",
            width: 460,
            margin: "40px 0",
            padding: 36,
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 4px 24px #e1e3e814",
            textAlign: "center",
            zIndex: 2,
            border: "1px solid #f2f2f2",
            position: "relative",
          }}
        >
          {/* BADGE */}
          <span
            style={{
              position: "absolute",
              top: 26,
              left: 28,
              background: badge === "Fırsat" ? "#fb8500" : "#16a34a",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              borderRadius: 8,
              padding: "5px 14px",
              boxShadow: "0 2px 8px #fb850026",
            }}
          >
            {badge}
          </span>

          {/* FAVORİ KALP */}
          <span
            title={favori ? "Favorilerden çıkar" : "Favorilere ekle"}
            style={{
              position: "absolute",
              top: 20,
              right: 26,
              cursor: "pointer",
              fontSize: 26,
              color: favori ? "#fb8500" : "#bdbdbd",
              transition: "color 0.2s",
            }}
            onClick={favoriyeToggle}
          >
            {favori ? "❤️" : "🤍"}
          </span>

          {/* ANA FOTOĞRAF */}
          <Image
            src={mainImg ?? "/placeholder.jpg"}
            alt={ilan.title}
            width={240}
            height={240}
            priority
            style={{
              borderRadius: 14,
              marginBottom: 20,
              background: "#f3f3f3",
              boxShadow: "0 6px 22px #1bbd8a0a",
              transition: "transform 0.2s",
              transform: "scale(1)",
              objectFit: "cover",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg";
            }}
          />
          {/* Fotoğraf Sliderı */}
          {Array.isArray(ilan.resim_url) && ilan.resim_url.length > 1 && (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14 }}>
              {ilan.resim_url.map((url: string, idx: number) => (
                <Image
                  key={idx}
                  src={url}
                  alt={`Ürün fotoğrafı ${idx + 1}`}
                  width={55}
                  height={55}
                  style={{
                    borderRadius: 7,
                    border: mainImg === url ? "2px solid #1bbd8a" : "2px solid #f2f2f2",
                    cursor: "pointer",
                    objectFit: "cover",
                  }}
                  onClick={() => setMainImg(url)}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg";
                  }}
                />
              ))}
            </div>
          )}

          {/* Ürün Başlık */}
          <h2
            style={{
              fontSize: 29,
              fontWeight: 800,
              color: "#191c1f",
              marginBottom: 12,
              marginTop: 7,
              letterSpacing: 0.4,
            }}
          >
            {ilan.title}
          </h2>

          {/* Firma Adı + Puan */}
          {firmaAdi && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
                fontSize: 16,
                color: "#31806c",
                marginBottom: 12,
              }}
            >
              <span>Firma: {firmaAdi}</span>
              <span style={{ color: "#f59e0b", fontSize: 18 }}>
                {renderStars(firmaPuan)}
              </span>
              <span style={{ color: "#64748b", fontSize: 14 }}>
                ({firmaPuan.toFixed(1)})
              </span>
            </div>
          )}

          {/* Yorum Formu */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!user) return alert("Giriş yapmalısınız.");
              if (!yorum) return alert("Yorum boş olamaz.");
              supabase.from("yorumlar").insert([{
                urun_id: ilan.id,
                user_id: user.id,
                yorum,
                puan,
              }]).then(() => {
                fetchYorumlar();
                setYorum("");
                setPuan(5);
              });
            }}
            style={{
              background: "#f3faf7",
              padding: 18,
              borderRadius: 12,
              marginBottom: 24,
              boxShadow: "0 1px 8px #000000a1",
              border: "1.5px solid #e0f7ee",
            }}
          >
            <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 17, color: "#10b981" }}>
              Ürüne Yorum Yap ve Puan Ver
            </div>
            <textarea
              value={yorum}
              onChange={e => setYorum(e.target.value)}
              placeholder="Yorumunuzu yazın..."
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #000000ff",
                padding: 11,
                fontSize: 16,
                marginBottom: 15,
                background: "#fff",
                outline: "none",
                resize: "vertical",
                color: "#191c1f",
              }}
              rows={3}
              required
            />
            <div style={{ marginBottom: 14, fontWeight: 500, color: "#444" }}>
              Puanınız:{" "}
              {[1, 2, 3, 4, 5].map(num => (
                <span
                  key={num}
                  style={{
                    color: num <= puan ? "#f59e0b" : "#d1d5db",
                    fontSize: 24,
                    cursor: "pointer",
                    marginRight: 3
                  }}
                  onClick={() => setPuan(num)}
                >★</span>
              ))}
            </div>
            <button
              type="submit"
              style={{
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 30px",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: "0 1px 4px #10b98122"
              }}
            >Yorumu Gönder</button>
          </form>

          {/* Ürün Yorumları */}
          <div>
            <div style={{ fontWeight: 800, color: "#223555", marginBottom: 14, fontSize: 19 }}>
              Ürün Yorumları
            </div>
            {yorumlar.length === 0 && (
              <div style={{ color: "#64748b", fontStyle: "italic" }}>Henüz yorum yok.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              {yorumlar.map((y, i) => (
                <div
                  key={i}
                  style={{
                    background: "linear-gradient(120deg, #efd8e1ff 75%, #efd8e1ff 100%)",
                    borderRadius: 13,
                    padding: "18px 20px 14px 20px",
                    boxShadow: "0 4px 24px #10b98115",
                    border: "1.5px solid #e0f7ee",
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ color: "#f59e0b", fontSize: 18, marginRight: 7 }}>
                      {renderStars(y.puan)}
                    </span>
                    <span style={{ color: "#0a7068", fontWeight: 600, fontSize: 15 }}>
                      {y.auth?.email?.split("@")[0] || "Kullanıcı"}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 13, color: "#7e8ba3" }}>
                      {y.created_at && new Date(y.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div style={{ color: "#262c31", fontSize: 16, fontWeight: 500 }}>
                    {y.yorum}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fiyat */}
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1bbd8a", marginBottom: 20 }}>
            {ilan.price ? ilan.price + " ₺" : "Fiyat bilgisi yok"}
          </div>

          {/* Sepete Ekle */}
          <button
            style={{
              marginTop: 2,
              background: "#fb8500",
              color: "#fff",
              padding: "13px 0",
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              fontSize: 17,
              cursor: "pointer",
              width: "100%",
              boxShadow: "0 2px 10px #fb850011",
            }}
            onClick={() => sepeteEkle(ilan)}
          >
            🛒 Sepete Ekle
          </button>

          {/* Sepete Git */}
          <button
            style={{
              marginTop: 18,
              background: "#1bbd8a",
              color: "#fff",
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              width: "100%",
              boxShadow: "0 1px 5px #1bbd8a08",
            }}
            onClick={sepeteGit}
          >
            Sepete Git
          </button>
        </div>
      </div>
    </div>
  );
}
