// pages/urun/[id].tsx
import { useRouter } from "next/router";
import Image from "next/image";
import { useEffect, useState } from "react";
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
  const idParam = Array.isArray(context.params?.id) ? context.params.id[0] : context.params?.id;
const idNum = Number(idParam);

const { data: ilan, error } = await supabase
  .from("ilan")
  .select("*, kategori:kategori_id (ad)") // ← JOIN’u FK alias ile yap
  .eq("id", idNum)                        // ← id sayıya çevrildi
  .maybeSingle();                         // ← 406 yerine null döner

  if (error || !ilan) return { notFound: true };

  let firmaAdi: string | null = null;
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

  useEffect(() => {
    setShareUrl(window.location.href);
    setMainImg(
      Array.isArray(ilan.resim_url)
        ? ilan.resim_url[0] || "/placeholder.jpg"
        : (ilan.resim_url as string) || "/placeholder.jpg"
    );
    fetchYorumlar();
  }, [ilan.resim_url, ilan.id]);

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
