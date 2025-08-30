// pages/urun/[id].tsx
import { useRouter } from "next/router";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

interface Ilan {
  id: number;
  title: string;
  price: number;
  resim_url: string[] | string;
  kategori_id?: number;
  user_email?: string;
  doped?: boolean;
  desc?: string;
  ozellikler?: Record<string, string[]>;
  kategori?: { ad: string };
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
  // id’yi güvenli sayıya çevir
  const idParam = Array.isArray(context.params?.id) ? context.params.id[0] : context.params?.id;
  const idNum = Number(idParam);

  // İlanı ilişkili tablo olmadan çek
  const { data: ilanRaw, error: ilanErr } = await supabase
    .from("ilan")
    .select("id, title, price, resim_url, kategori_id, user_email, doped, desc, ozellikler")
    .eq("id", idNum)
    .maybeSingle();

  if (ilanErr || !ilanRaw) return { notFound: true };

  // Kategori adını ayrı sorgu ile al
  let kategoriAd: string | null = null;
  if (ilanRaw.kategori_id != null) {
    const { data: kat } = await supabase
      .from("kategori")
      .select("ad")
      .eq("id", ilanRaw.kategori_id)
      .maybeSingle();
    kategoriAd = kat?.ad ?? null;
  }

  // UI ile uyum için { kategori: { ad } } şeklinde ekle
  const ilan = { ...ilanRaw, kategori: kategoriAd ? { ad: kategoriAd } : null };

  // Firma bilgisi
  let firmaAdi: string | null = null;
  let firmaPuan = 0;
  if (ilan.user_email) {
    const { data: firma } = await supabase
      .from("satici_firmalar")
      .select("firma_adi, puan")
      .eq("email", ilan.user_email)
      .maybeSingle();
    firmaAdi = firma?.firma_adi ?? null;
    firmaPuan = firma?.puan ?? 0;
  }

  // Benzer ürünler
  const { data: benzerler } = await supabase
    .from("ilan")
    .select("id, title, price, resim_url")
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
  const [user, setUser] = useState<User | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const ozellikler = ilan.ozellikler ?? {};
  const [yorumlar, setYorumlar] = useState<any[]>([]);
  const [yorum, setYorum] = useState("");
  const [puan, setPuan] = useState(5);
  const [secilenOzellikler, setSecilenOzellikler] = useState<Record<string, string>>({});

  function handleOzellikSec(ozellikAdi: string, secilenDeger: string) {
    setSecilenOzellikler((prev) => ({
      ...prev,
      [ozellikAdi]: secilenDeger
    }));
  }

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

  // Ortalama ürün puanı
  const ortalamaPuan = useMemo(() => {
    if (!yorumlar?.length) return 0;
    const sum = yorumlar.reduce((a: number, y: any) => a + (Number(y.puan) || 0), 0);
    return sum / yorumlar.length;
  }, [yorumlar]);

  // Kullanıcının mevcut yorumu (varsa)
  const benimYorumum = useMemo(
    () => (user ? yorumlar.find((y) => y.user_id === user.id) : null),
    [user, yorumlar]
  );

  // İlk yükleme
  useEffect(() => {
    setShareUrl(window.location.href);
    setMainImg(
      Array.isArray(ilan.resim_url)
        ? ilan.resim_url[0] || "/placeholder.jpg"
        : (ilan.resim_url as string) || "/placeholder.jpg"
    );
    fetchYorumlar();
  }, [ilan.resim_url, ilan.id]);

  // Oturum kullanıcıyı getir
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const newUser = data?.session?.user || null;
      setUser((prev) => (prev?.id === newUser?.id ? prev : newUser));
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Favori kontrolü
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;
    async function checkFavori() {
      const { data, error } = await supabase
        .from("favoriler")
        .select("ilan_id")
        .eq("user_id", userId)
        .eq("ilan_id", ilan.id);
      if (cancelled) return;
      if (error) {
        console.error("Favori kontrol hatası:", error);
        setFavori(false);
      } else {
        setFavori((data?.length ?? 0) > 0);
      }
    }
    checkFavori();
    return () => {
      cancelled = true;
    };
  }, [user?.id, ilan.id]);

  // ürün detay sayfası açıldığında görüntülenme sayısını +1 arttır
  useEffect(() => {
    async function artir() {
      if (!ilan?.id) return;
      try {
        await supabase.rpc("increment_views", { ilan_id: ilan.id });
      } catch (e) {
        console.error("Views update hatası:", e);
      }
    }
    artir();
  }, [ilan?.id]);

  const sepeteEkle = async (urun: Ilan) => {
    if (!user) {
      alert("Lütfen giriş yapınız!");
      router.push("/giris");
      return;
    }
    const userId = user.id;

    const { data: sepetteVar } = await supabase
      .from("cart")
      .select("*")
      .eq("user_id", userId)
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
        .insert([{
          user_id: userId,
          product_id: urun.id,
          adet: 1,
          ozellikler: secilenOzellikler // seçilen özellikleri ekliyoruz
        }]);
    }
    alert("Sepete eklendi!");
  };

  const favoriyeToggle = async () => {
    if (!user) {
      alert("Lütfen giriş yapınız!");
      router.push("/giris");
      return;
    }
    const userId = user.id;
    if (favori) {
      await supabase
        .from("favoriler")
        .delete()
        .eq("user_id", userId)
        .eq("ilan_id", ilan.id);
      setFavori(false);
    } else {
      await supabase
        .from("favoriler")
        .insert([{ user_id: userId, ilan_id: ilan.id }]);
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

  const fiyatText =
    typeof ilan.price === "number"
      ? `${ilan.price.toLocaleString("tr-TR")} ₺`
      : (ilan.price ? `${ilan.price} ₺` : "Fiyat bilgisi yok");

  // === YORUM GÖNDER / GÜNCELLE ===
  async function yorumGonder() {
    if (!user) {
      alert("Yorum yapmak için giriş yapınız.");
      router.push("/giris");
      return;
    }
    if (puan < 1 || puan > 5) {
      alert("Lütfen 1-5 arasında bir puan seçin.");
      return;
    }

    try {
      // Aynı kullanıcının aynı ürüne yorumunu güncelle
      const mevcut = yorumlar.find((y) => y.user_id === user.id);
      if (mevcut) {
        await supabase
          .from("yorumlar")
          .update({ yorum: yorum.trim(), puan })
          .eq("id", mevcut.id);
      } else {
        await supabase.from("yorumlar").insert([{
          urun_id: ilan.id,
          user_id: user.id,
          yorum: yorum.trim(),
          puan
        }]);
      }
      setYorum("");
      await fetchYorumlar();
      alert("Teşekkürler! Yorumun kaydedildi.");
    } catch (e) {
      console.error(e);
      alert("Yorum gönderilirken bir hata oluştu.");
    }
  }

  // Yardımcı: tarih
  function formatDate(d?: string) {
    if (!d) return "";
    try {
      return new Date(d).toLocaleString("tr-TR");
    } catch {
      return d;
    }
  }

  return (
    <>
      <Head>
        <title>{ilan.title}</title>
        <meta name="description" content={ilan.desc?.slice(0, 120) || ilan.title} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* ÜST BAR */}
      <div className="topbar" onClick={logoClick} title="Anasayfa" role="button" tabIndex={0}>
        <div className="topbarInner">
          <Image src="/logo.png" alt="Aldın Aldın Logo" width={40} height={40} />
          <span className="brand"> </span>
        </div>
      </div>

      {/* SAYFA GÖVDE */}
      <main className="page">
        {/* ÜRÜN KARTI */}
        <section className="detailCard">
          {/* BADGE */}
          <span className={`badge ${badge === "Fırsat" ? "deal" : "new"}`}>{badge}</span>

          {/* FAVORİ */}
          <button
            type="button"
            className={`fav ${favori ? "active" : ""}`}
            title={favori ? "Favorilerden çıkar" : "Favorilere ekle"}
            onClick={favoriyeToggle}
          >
            {favori ? "❤️" : "🤍"}
          </button>

          {/* ANA FOTO */}
          <div className="mainImgWrap">
            <Image
              src={mainImg ?? "/placeholder.jpg"}
              alt={ilan.title}
              width={480}
              height={480}
              priority
              sizes="(max-width: 640px) 85vw, 480px"
              className="mainImg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg";
              }}
            />
          </div>

          {/* THUMBS */}
          {Array.isArray(ilan.resim_url) && ilan.resim_url.length > 1 && (
            <div className="thumbRow">
              {ilan.resim_url.map((url: string, idx: number) => (
                <Image
                  key={idx}
                  src={url}
                  alt={`Ürün fotoğrafı ${idx + 1}`}
                  width={72}
                  height={72}
                  sizes="72px"
                  className={`thumb ${mainImg === url ? "active" : ""}`}
                  onClick={() => setMainImg(url)}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg";
                  }}
                />
              ))}
            </div>
          )}

          {/* BAŞLIK */}
          <h1 className="title">{ilan.title}</h1>

          {/* FİRMA + PUAN */}
          {firmaAdi && (
            <div className="firmRow">
              <span>Firma: <b>{firmaAdi}</b></span>
              <span className="stars">{renderStars(firmaPuan)}</span>
              <span className="score">({firmaPuan.toFixed(1)})</span>
            </div>
          )}

          {/* ÜRÜN ORTALAMA PUAN */}
          <div className="productRatingRow">
            <span className="stars">{renderStars(ortalamaPuan)}</span>
            <span className="score">({ortalamaPuan.toFixed(1)} / 5 • {yorumlar.length} yorum)</span>
          </div>

          {/* ÖZELLİKLER */}
          {/* ÖZELLİKLER sadece gıda ve giyim için */}
          {ilan?.kategori?.ad &&
          ["gıda", "giyim"].includes(ilan.kategori.ad.toLowerCase()) &&
          Object.keys(ozellikler).length > 0 && (
            <div className="opts">
              {Object.keys(ozellikler).map((ozellik) => (
                <div key={ozellik} className="opt">
                  <label className="optLabel">{ozellik}</label>
                  <select
                    value={secilenOzellikler[ozellik] || ""}
                    onChange={(e) => handleOzellikSec(ozellik, e.target.value)}
                    className="optSelect"
                  >
                    <option value="">Seçiniz</option>
                    {ozellikler[ozellik]?.map((deger: string, idx: number) => (
                      <option key={idx} value={deger}>
                        {deger}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* FİYAT */}
          <div className="price">{fiyatText}</div>

          {/* BUTONLAR */}
          <button className="btnAdd" onClick={() => sepeteEkle(ilan)}>🛒 Sepete Ekle</button>
          <button className="btnGo" onClick={sepeteGit}>Sepete Git</button>
        </section>

        {/* YORUMLAR & PUANLAMA */}
        <section className="reviews">
          <h2>Yorumlar & Puanlama</h2>

          {user ? (
            <div className="reviewForm">
              <div className="rateRow" aria-label="Puan ver">
                {[1,2,3,4,5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    className="rateStar"
                    onClick={() => setPuan(n)}
                    title={`${n} yıldız`}
                  >
                    {n <= puan ? "★" : "☆"}
                  </button>
                ))}
                <span className="rateScore">{puan}</span>
                {benimYorumum && <span className="editBadge">Mevcut yorumun güncellenecek</span>}
              </div>

              <textarea
                className="reviewTextarea"
                placeholder="Deneyimini yaz (isteğe bağlı)"
                value={yorum}
                onChange={(e) => setYorum(e.target.value)}
                rows={4}
              />
              <button
  className="reviewSend"
  onClick={yorumGonder}
  style={{ background:'#000', color:'#fff', border:'1px solid #000' }}
>
  {benimYorumum ? "Güncelle" : "Gönder"}
</button>

            </div>
          ) : (
            <div className="loginHint">
              Yorum yazmak için lütfen <a onClick={()=>router.push("/giris")} style={{cursor:"pointer", textDecoration:"underline"}}>giriş yapın</a>.
            </div>
          )}

          <div className="reviewList">
            {yorumlar.length === 0 ? (
              <div className="empty">Bu ürün için henüz yorum yapılmamış.</div>
            ) : (
              yorumlar.map((y) => (
                <div key={y.id} className="reviewCard">
                  <div className="reviewHead">
                    <span className="reviewUser">{(y.user_id || "").slice(0, 8) || "Anonim"}</span>
                    <span className="reviewStars">{renderStars(Number(y.puan) || 0)}</span>
                  </div>
                  {y.yorum && <p className="reviewText">{y.yorum}</p>}
                  <div className="reviewMeta">{formatDate(y.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* BENZER ÜRÜNLER */}
        {benzerler && benzerler.length > 0 && (
          <section className="similar">
            <h2>Benzer Ürünler</h2>
            <div className="simGrid">
              {benzerler.map((b) => (
                <div
                  key={b.id}
                  className="simCard"
                  onClick={() => router.push(`/urun/${b.id}?from=${from || ""}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="simImgWrap">
                    <Image
                      src={
                        Array.isArray(b.resim_url)
                          ? (b.resim_url[0] || "/placeholder.jpg")
                          : (b.resim_url as string) || "/placeholder.jpg"
                      }
                      alt={b.title}
                      width={220}
                      height={220}
                      sizes="(max-width: 640px) 40vw, 220px"
                      className="simImg"
                    />
                  </div>
                  <div className="simTitle" title={b.title}>{b.title}</div>
                  <div className="simPrice">
                    {typeof b.price === "number"
                      ? `${b.price.toLocaleString("tr-TR")} ₺`
                      : (b.price ? `${b.price} ₺` : "—")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* STYLES */}
      <style jsx>{`
        :root {
          --bg1: #f6f7f9;
          --bg2: #e4ecef;
          --card: #fff;
          --text: #191c1f;
          --muted: #64748b;
          --brand: #1bbd8a;
          --brand-2: #16a34a;
          --accent: #fb8500;
          --border: #f2f2f2;
          --shadow: 0 4px 24px #e1e3e814;
        }
        .topbar {
          width: 100%;
          position: sticky;
          top: 0;
          z-index: 50;
          background: #fff;
          box-shadow: 0 2px 12px #1bbd8a09;
        }
        .topbarInner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
        }
        .brand {
          font-size: 24px;
          font-weight: 800;
          color: #1a1a1a;
          letter-spacing: 1px;
        }
        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 100%);
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          overflow-x: hidden;
        }
        .detailCard {
          width: 460px;
          max-width: 100%;
          position: relative;
          margin: 24px auto 12px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 24px 20px;
          box-shadow: var(--shadow);
          text-align: center;
        }
        .badge {
          position: absolute;
          top: 18px;
          left: 18px;
          color: #fff;
          font-weight: 800;
          font-size: 13px;
          border-radius: 8px;
          padding: 5px 12px;
          box-shadow: 0 2px 8px #0000001a;
        }
        .badge.deal { background: var(--accent); }
        .badge.new { background: var(--brand-2); }
        .fav {
          position: absolute;
          top: 14px;
          right: 16px;
          font-size: 26px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #bdbdbd;
          transition: color .2s ease;
        }
        .fav.active { color: var(--accent); }
        .mainImgWrap {
          display: flex;
          justify-content: center;
          margin-top: 18px;
          margin-bottom: 14px;
        }
        .mainImg {
          border-radius: 14px;
          background: #f3f3f3;
          box-shadow: 0 6px 22px #1bbd8a0a;
          width: 100%;
          height: auto;
          max-width: 480px;
          object-fit: cover;
        }
        .thumbRow {
          display: flex;
          flex-wrap: nowrap;
          gap: 8px;
          justify-content: center;
          margin-bottom: 12px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .thumb {
          border-radius: 8px;
          border: 2px solid var(--border);
          cursor: pointer;
          object-fit: cover;
          flex: 0 0 auto;
        }
        .thumb.active { border-color: var(--brand); }
        .title {
          font-size: 22px;
          line-height: 1.25;
          font-weight: 800;
          color: var(--text);
          margin: 10px 0 8px;
        }
        .firmRow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 600;
          font-size: 15px;
          color: #31806c;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .stars { color: #f59e0b; font-size: 18px; }
        .score { color: var(--muted); font-size: 14px; }

        .productRatingRow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 4px 0 8px;
          font-weight: 700;
          color: #334155;
        }

        .opts { margin: 8px 0 12px; text-align: left; }
        .opt { margin-bottom: 10px; }
        .optLabel {
          display: block;
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 4px;
          color: #1f2937;
        }
        .optSelect {
          width: 100%;
          padding: 9px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          font-size: 14px;
          background: #fff;
        }
        .price {
          font-size: 22px;
          font-weight: 800;
          color: var(--brand);
          margin: 8px 0 16px;
        }
        .btnAdd, .btnGo {
          width: 100%;
          border: none;
          cursor: pointer;
          border-radius: 10px;
          font-weight: 700;
          box-shadow: 0 2px 10px #00000011;
        }
        .btnAdd {
          background: var(--accent);
          color: #fff;
          padding: 13px 0;
          font-size: 16px;
        }
        .btnGo {
          margin-top: 12px;
          background: var(--brand);
          color: #fff;
          padding: 11px 0;
          font-size: 15px;
        }

        /* --- YORUMLAR --- */
        .reviews{
          width:100%;
          max-width: 800px;
          background:#fff;
          border:1px solid var(--border);
          border-radius:16px;
          box-shadow: var(--shadow);
          padding:16px;
          margin: 8px auto 24px;
        }
        .reviews h2{
          font-size:18px;
          font-weight:900;
          color:#111827;
          margin: 4px 0 12px;
        }
        .reviewForm{
          border:1px solid #e5e7eb;
          border-radius:12px;
          padding:12px;
          margin-bottom:14px;
          background:#fcfcfd;
        }
        .rateRow{
          display:flex; align-items:center; gap:6px; margin-bottom:8px;
        }
        .rateStar{
          border:none; background:transparent; cursor:pointer; font-size:22px; line-height:1;
          color:#f59e0b;
        }
        .rateScore{ font-weight:800; color:#334155; margin-left:4px; }
        .editBadge{ margin-left:8px; font-size:12px; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:999px; font-weight:700; }
        .reviewTextarea{
          width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:10px; font-size:14px; resize:vertical;
          min-height:90px; background:#fff;
        }
        .reviewSend{
          margin-top:8px; background: var(--brand-2); color:#fff; border:none; border-radius:10px; padding:10px 14px; font-weight:800; cursor:pointer;
        }
        .loginHint{ background:#f8fafc; border:1px solid #e5e7eb; padding:12px; border-radius:10px; margin-bottom:12px; color:#334155; }

        .reviewList{ display:flex; flex-direction:column; gap:10px; }
        .reviewCard{
          border:1px solid #e5e7eb; border-radius:12px; padding:10px; background:#fff;
        }
        .reviewHead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
        .reviewUser{ font-weight:800; color:#0f172a; }
        .reviewStars{ color:#f59e0b; }
        .reviewText{ margin:4px 0 6px; color:#111827; font-size:14px; line-height:1.35; }
        .reviewMeta{ color:#64748b; font-size:12px; }
        .empty{ color:#64748b; font-weight:600; }

        /* Benzerler */
        .similar {
          width: 100%;
          max-width: 1200px;
          margin: 8px auto 40px;
        }
        .similar h2 {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          margin: 8px 6px 10px;
        }
        .simGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          padding: 0 6px;
        }
        .simCard {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 10px;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          transition: transform .15s ease;
        }
        .simCard:active { transform: scale(0.98); }
        .simImgWrap { width: 100%; display: flex; justify-content: center; }
        .simImg {
          width: 100%;
          height: auto;
          border-radius: 10px;
          object-fit: cover;
        }
        .simTitle {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          line-height: 1.25;
          height: 36px;
          overflow: hidden;
        }
        .simPrice {
          font-size: 14px;
          font-weight: 800;
          color: var(--brand);
        }

        /* --------- Mobile (<=640px) ---------- */
        @media (max-width: 640px) {
          .topbarInner { padding: 12px 14px; }
          .brand { font-size: 20px; }
          .page { padding: 10px 10px 20px; }
          .detailCard {
            width: 100%;
            margin: 14px auto 8px;
            padding: 16px 12px 18px;
            border-radius: 16px;
          }
          .badge { top: 12px; left: 12px; font-size: 12px; padding: 4px 10px; }
          .fav { top: 10px; right: 12px; font-size: 24px; }
          .mainImg { max-width: 100%; border-radius: 12px; }
          .thumbRow { gap: 6px; margin-bottom: 10px; }
          .thumb { width: 60px; height: 60px; }
          .title { font-size: 18px; margin-top: 6px; }
          .firmRow { font-size: 14px; gap: 6px; }
          .optLabel { font-size: 13px; }
          .optSelect { font-size: 13px; padding: 8px 9px; }
          .price { font-size: 20px; margin-top: 6px; }
          .btnAdd { padding: 12px 0; font-size: 15px; }
          .btnGo { padding: 10px 0; font-size: 14px; }

          .reviews{ padding:12px; }
          .reviewTextarea{ min-height: 80px; }

          .similar h2 { font-size: 16px; margin: 12px 8px; }
          .simGrid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .simTitle { font-size: 13px; height: 34px; }
          .simPrice { font-size: 13px; }
        }

        /* Tablet (641px - 1024px) */
        @media (min-width: 641px) and (max-width: 1024px) {
          .simGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
      `}</style>
    </>
  );
}
