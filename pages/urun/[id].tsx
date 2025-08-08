// pages/urun/[id].tsx
import { useRouter } from "next/router";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Head from "next/head";

// Yardımcı fonksiyonlar (ör: renderStars)
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

// getServerSideProps, props döner!
export async function getServerSideProps(context: any) {
  const { id } = context.params;

  // 1. İlanı çek
  const { data: ilan, error } = await supabase
    .from("ilan")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !ilan) return { notFound: true };

  // 2. Firma adını + puanı user_email ile çek
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

  // 3. Benzer ilanları çek
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

// ---- SADECE BİR TANE! ----
export default function UrunDetay({
  ilan,
  firmaAdi,
  firmaPuan,
  benzerler,
}: {
  ilan: any;
  firmaAdi: string | null;
  firmaPuan: number;
  benzerler: any[];
}) {
  const router = useRouter();
  const { from } = router.query;

  // STATE'LER
  const [mainImg, setMainImg] = useState<string | null>(null);
  const [favori, setFavori] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [shareUrl, setShareUrl] = useState(`https://seninsiten.com/urun/${ilan.id}`);
  const [yorumlar, setYorumlar] = useState<any[]>([]);
  const [yorum, setYorum] = useState("");
  const [puan, setPuan] = useState(5);

  // ROUTE
  const anasayfaPath = from === "index2" ? "/index2" : "/";
  const sepetPath = from === "index2" ? "/sepet2" : "/sepet";

  // Yorumları getir fonksiyonu
  async function fetchYorumlar() {
  const { data, error } = await supabase
    .from("yorumlar")
    .select("*")
    .eq("urun_id", ilan.id)
    .order("created_at", { ascending: false });
  console.log("Yorumlar:", data, "Hata:", error);
  setYorumlar(data || []);
}


  // İlk açılışta ve yorum gönderildikten sonra yorumları getir
  useEffect(() => {
    fetchYorumlar();
  }, [ilan.id]);

  // Yorum gönder fonksiyonu
  async function yorumGonder(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return alert("Giriş yapmalısınız.");
    if (!yorum) return alert("Yorum boş olamaz.");

    const { error } = await supabase.from("yorumlar").insert([{
      urun_id: ilan.id,
      user_id: user.id,
      yorum,
      puan,
    }]);
    if (error) {
      alert("Yorum eklenemedi: " + error.message);
      return;
    }

    // Yorumlar tekrar çekilsin:
    await fetchYorumlar();
      // --- Firma puanını otomatik güncelle ---
  // Bu ürüne yapılan tüm yorumları çek
  const { data: tumYorumlar } = await supabase
    .from("yorumlar")
    .select("puan")
    .eq("urun_id", ilan.id);

  if (tumYorumlar && tumYorumlar.length > 0) {
    const toplamPuan = tumYorumlar.reduce((sum, y) => sum + (y.puan || 0), 0);
    const ortalama = toplamPuan / tumYorumlar.length;

    // Firma puanını güncelle
    if (ilan.user_email) {
      await supabase
        .from("satici_firmalar")
        .update({ puan: ortalama })
        .eq("email", ilan.user_email);
    }
  }

    setYorum("");
    setPuan(5);
  }
  // Ana resmi ilk renderda ayarla
  useEffect(() => {
    setMainImg(
      Array.isArray(ilan.resim_url)
        ? ilan.resim_url[0] || "/placeholder.jpg"
        : ilan.resim_url || "/placeholder.jpg"
    );
  }, [ilan.resim_url]);

  // Kullanıcıyı çek
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Favori kontrolü
  useEffect(() => {
    if (!user || !ilan) {
      setFavori(false);
      return;
    }
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
  }, [user, ilan]);

  // Client yüklendikten sonra gerçek URL'yi al
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  const sepeteEkle = async (urun: any) => {
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
        >
          
        </span>
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
    {/* Firma Adı */}
    <span>Firma: {firmaAdi}</span>

    {/* Yıldız Grafiği */}
    <span style={{ color: "#f59e0b", fontSize: 18 }}>
      {renderStars(firmaPuan)}
    </span>

    {/* Sayısal Puan */}
    <span style={{ color: "#64748b", fontSize: 14 }}>
      ({firmaPuan.toFixed(1)})
    </span>
  </div>
  
)}

{/* YORUM FORMU + LİSTE */}
<div style={{ marginTop: 28, width: "100%", textAlign: "left" }}>
  {/* --- Yorum Formu --- */}
  <form
    onSubmit={yorumGonder}
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

  {/* --- Yorumlar Listesi --- */}
  <div>
    <div style={{ fontWeight: 800, color: "#223555", marginBottom: 14, fontSize: 19 }}>
      Ürün Yorumları
    </div>
    {yorumlar.length === 0 && <div style={{ color: "#64748b", fontStyle: "italic" }}>Henüz yorum yok.</div>}
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
        position: "relative",
        minHeight: 60,
        transition: "box-shadow 0.18s",
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
      <div
        style={{
          color: "#262c31",
          fontSize: 16,
          marginTop: 2,
          paddingLeft: 2,
          fontWeight: 500,
          lineHeight: 1.55,
          wordBreak: "break-word",
        }}
      >
        {y.yorum}
      </div>
    </div>
  ))}
</div>

  </div>
</div>



<div
  style={{
    fontSize: 22,
    fontWeight: 700,
    color: "#1bbd8a",
    marginBottom: 20,
  }}
>
  {ilan.price ? ilan.price + " ₺" : "Fiyat bilgisi yok"}
</div>
          {/* Paylaşım butonları */}
          <div
            style={{
              display: "flex",
              gap: 13,
              justifyContent: "center",
              margin: "12px 0",
              alignItems: "center",
            }}
          >
            {/* Whatsapp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Whatsapp'ta paylaş"
            >
              <svg width="26" height="26" fill="#25D366" viewBox="0 0 24 24">
                <path d="M20.52 3.48a12 12 0 00-16.97 0c-4.16 4.16-4.16 10.93 0 15.09a12 12 0 0016.97 0c4.16-4.16 4.16-10.93 0-15.09zm-1.49 13.6c-.21.62-1.22 1.17-1.66 1.25-.43.08-.97.12-1.56-.11-1.83-.7-3.08-2.47-3.18-2.59-.09-.13-.76-1.02-.76-1.95 0-.92.48-1.36.65-1.53.17-.17.37-.21.5-.21.13 0 .26.01.37.01.12 0 .27-.04.41.31.15.35.52 1.22.56 1.3.04.09.07.2.01.33-.07.13-.11.21-.22.33-.11.12-.22.26-.31.34-.09.08-.18.17-.08.33.09.16.41.66.87 1.08.6.54 1.11.72 1.27.8.16.08.25.07.34-.04.09-.11.39-.46.5-.62.12-.16.21-.13.35-.08.13.04.83.4.97.47.13.07.22.09.25.14.04.05.04.27-.07.56z" />
              </svg>
            </a>
            {/* Telegram */}
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Telegram'da paylaş"
            >
              <svg width="26" height="26" fill="#0088cc" viewBox="0 0 24 24">
                <path d="M9.844 15.316l-.398 3.743c.57 0 .814-.243 1.112-.535l2.668-2.523 5.535 4.04c1.013.555 1.74.264 2.017-.927L23.96 5.2c.334-1.353-.49-1.888-1.362-1.6L2.46 10.446c-1.321.512-1.308 1.252-.228 1.577l5.718 1.783L18.797 7.286c.412-.266.789-.12.48.17z" />
              </svg>
            </a>
            {/* X */}
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="X'te paylaş"
            >
              <svg width="26" height="26" fill="#1da1f2" viewBox="0 0 24 24">
                <path d="M23.954 4.569c-.885.385-1.83.647-2.825.764 1.014-.608 1.794-1.574 2.163-2.723-.949.564-2.005.974-3.127 1.194-.896-.959-2.178-1.559-3.594-1.559-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-.424.722-.666 1.561-.666 2.475 0 1.71.87 3.213 2.188 4.099-.807-.026-1.566-.248-2.229-.616v.061c0 2.385 1.693 4.374 3.946 4.827-.693.188-1.452.232-2.224.084.627 1.956 2.444 3.377 4.604 3.417-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.394 4.768 2.209 7.557 2.209 9.142 0 14.307-7.721 13.995-14.646.96-.689 1.8-1.56 2.46-2.549z" />
              </svg>
            </a>
          </div>

          {/* Açıklama */}
          <div
            style={{
              color: "#444",
              fontSize: 16,
              marginBottom: 28,
              lineHeight: 1.5,
            }}
          >
            {ilan.desc || "Açıklama yok."}
          </div>
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
              letterSpacing: 0.5,
              transition: "background 0.18s",
            }}
            onClick={() => sepeteEkle(ilan)}
          >
            🛒 Sepete Ekle
          </button>
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
              transition: "background 0.16s",
            }}
            onClick={sepeteGit}
          >
            Sepete Git
          </button>
        </div>

        {/* BENZER ÜRÜNLER */}
        {benzerler.length > 0 && (
          <div
            style={{
              position: "fixed",
              top: 88,
              right: 0,
              width: 335,
              minHeight: 180,
              maxHeight: "78vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "0 0 0 22px",
              boxShadow: "0 8px 30px #bbb2",
              padding: "25px 12px 15px 15px",
              borderLeft: "1.5px solid #f2f2f2",
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
              gap: 11,
            }}
            className="benzer-sabit"
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#212c35",
                marginBottom: 12,
                marginLeft: 2,
              }}
            >
              Benzer Ürünler
            </div>
            {benzerler.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  router.push({
                    pathname: "/urun/" + item.id,
                    query: from ? { from } : {},
                  });
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  borderRadius: 8,
                  padding: "10px 2px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f0f0f0",
                  transition: "background 0.14s, box-shadow 0.14s",
                  boxShadow: "none",
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "#f7fdfa";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 2px 8px #1bbd8a0b";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "none";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <Image
                  src={
                    Array.isArray(item.resim_url)
                      ? item.resim_url[0] || "/placeholder.jpg"
                      : item.resim_url || "/placeholder.jpg"
                  }
                  alt={item.title}
                  width={46}
                  height={46}
                  style={{ borderRadius: 7, background: "#f6f6f6" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg";
                  }}
                />
                <div>
                  <div
                    style={{ fontSize: 15, fontWeight: 700, color: "#223555" }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      color: "#1bbd8a",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {item.price} ₺
                  </div>
                </div>
                <button
                  title="Sepete ekle"
                  style={{
                    marginLeft: "auto",
                    background: "#f5f6f7",
                    color: "#fb8500",
                    border: "none",
                    borderRadius: "50%",
                    width: 33,
                    height: 33,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 4px #1bbd8a09",
                    cursor: "pointer",
                    fontSize: 20,
                    transition: "background 0.15s",
                  }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await sepeteEkle(item);
                  }}
                >
                  ➕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Responsive */}
      <style jsx global>{`
        @media (max-width: 1100px) {
          .benzer-sabit {
            position: static !important;
            width: 100% !important;
            max-width: 99vw !important;
            border-radius: 0 0 20px 20px !important;
            margin: 26px 0 0 0 !important;
            box-shadow: none !important;
            border-left: none !important;
            border-top: 1.5px solid #f2f2f2 !important;
          }
        }
        @media (max-width: 600px) {
          div[style*="flex-direction: row"] {
            flex-direction: column !important;
            align-items: center !important;
            gap: 0 !important;
          }
          .benzer-sabit {
            margin: 24px 0 0 0 !important;
            padding: 16px 6px 10px 6px !important;
          }
        }
      `}</style>
    </div>
    
  );
}
