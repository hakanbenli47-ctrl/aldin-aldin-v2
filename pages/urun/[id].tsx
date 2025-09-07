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
  price: number | string;               // runtime'da string gelebilir
  resim_url: string[] | string;         // runtime'da string/dizi gelebilir
  kategori_id?: number | null;
  user_email?: string | null;
  doped?: boolean | null;
  desc?: string | null;
  ozellikler?: Record<string, string[]> | string | null;
  kategori?: { ad: string } | null;
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

/* ----------------- Güvenli normalizasyonlar ----------------- */
function normalizeResimler(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  } catch { /* string ya da CSV olabilir */ }
  if (typeof raw === "string" && raw.includes(",")) {
    return raw.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [String(raw)];
}

function normalizeOzellikler(raw: unknown): Record<string, string[]> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj as Record<string, string[]> : {};
    } catch { return {}; }
  }
  return typeof raw === "object" ? (raw as Record<string, string[]>) : {};
}

function prettyLabel(key: string) {
  return key
    .replace(/([a-z])([A-ZĞÜŞİÖÇ])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/(^|\s)([a-zöçşiğü])/g, (m) => m.toUpperCase());
}

/* ----------------- SSR ----------------- */
export async function getServerSideProps(ctx: any) {
  const idNum = Number(Array.isArray(ctx.params?.id) ? ctx.params.id[0] : ctx.params?.id);
  if (!Number.isFinite(idNum)) return { notFound: true };

  const { data: ilanRaw, error: ilanErr } = await supabase
    .from("ilan")
    .select("id, title, price, resim_url, kategori_id, user_email, doped, desc, ozellikler")
    .eq("id", idNum)
    .maybeSingle();
  if (ilanErr || !ilanRaw) return { notFound: true };

  const [katRes, firmaRes, benzerRes] = await Promise.all([
    ilanRaw.kategori_id != null
      ? supabase.from("kategori").select("ad").eq("id", ilanRaw.kategori_id).maybeSingle()
      : Promise.resolve({ data: null }),
    ilanRaw.user_email
      ? supabase.from("satici_firmalar").select("firma_adi, puan").eq("email", ilanRaw.user_email).maybeSingle()
      : Promise.resolve({ data: null }),
    ilanRaw.kategori_id != null
      ? supabase.from("ilan").select("id, title, price, resim_url")
          .eq("kategori_id", ilanRaw.kategori_id).neq("id", ilanRaw.id).limit(8)
      : Promise.resolve({ data: [] }),
  ] as const);

  const kategoriAd = katRes?.data?.ad ?? null;
  const firmaAdi   = firmaRes?.data?.firma_adi ?? null;
  const firmaPuan  = Number(firmaRes?.data?.puan ?? 0);
  const benzerler  = benzerRes?.data ?? [];

  return {
    props: {
      ilan: { ...ilanRaw, kategori: kategoriAd ? { ad: kategoriAd } : null },
      firmaAdi, firmaPuan, benzerler,
    },
  };
}


/* ----------------- COMPONENT ----------------- */
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

  // Veriyi güvene al
  const resimler = useMemo(() => normalizeResimler(ilan.resim_url), [ilan.resim_url]);
  const ozellikler = useMemo(() => normalizeOzellikler(ilan.ozellikler), [ilan.ozellikler]);

  const [yorumlar, setYorumlar] = useState<any[]>([]);
  const [yorumUserMap, setYorumUserMap] = useState<
    Record<string, { first_name: string | null; last_name: string | null }>
  >({});
  const [yorum, setYorum] = useState("");
  const [puan, setPuan] = useState(5);
  const [secilenOzellikler, setSecilenOzellikler] = useState<Record<string, string>>({});

  function handleOzellikSec(ozellikAdi: string, secilenDeger: string) {
    setSecilenOzellikler((prev) => ({ ...prev, [ozellikAdi]: secilenDeger }));
  }

  const anasayfaPath = from === "index2" ? "/index2" : "/";
  const sepetPath    = from === "index2" ? "/sepet2" : "/sepet";

  // Yorumlar
  async function fetchYorumlar() {
    const { data: yData, error } = await supabase
      .from("yorumlar")
      .select("*")
      .eq("urun_id", ilan.id)
      .order("created_at", { ascending: false });

    if (error) console.error("yorumlarErr:", error);
    setYorumlar(yData || []);

    const ids = Array.from(new Set((yData || []).map((y: any) => y.user_id).filter(Boolean)));
    if (ids.length === 0) {
      setYorumUserMap({});
      return;
    }

    const { data: profs, error: profErr } = await supabase
      .from("user_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", ids);

    if (profErr) console.error("user_profilesErr:", profErr);

    const map: Record<string, { first_name: string | null; last_name: string | null }> =
      Object.fromEntries((profs || []).map((p: any) => [
        p.user_id,
        { first_name: p.first_name, last_name: p.last_name }
      ]));

    setYorumUserMap(map);
  }

  // Ortalama puan
  const ortalamaPuan = useMemo(() => {
    if (!yorumlar?.length) return 0;
    const sum = yorumlar.reduce((a: number, y: any) => a + (Number(y.puan) || 0), 0);
    return sum / yorumlar.length;
  }, [yorumlar]);

  // Benim yorumum
  const benimYorumum = useMemo(
    () => (user ? yorumlar.find((y) => y.user_id === user.id) : null),
    [user, yorumlar]
  );

  // İlk yükleme
  useEffect(() => {
    setShareUrl(typeof window !== "undefined" ? window.location.href : "");
    setMainImg(resimler[0] || "/placeholder.jpg");
    fetchYorumlar();
  }, [ilan.id, resimler]);

  // Özellik: tek değerli olanları otomatik seç
  useEffect(() => {
    const next: Record<string, string> = {};
    Object.entries(ozellikler).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length === 1) next[k] = v[0];
    });
    if (Object.keys(next).length) {
      setSecilenOzellikler((prev) => ({ ...next, ...prev }));
    }
  }, [ozellikler]);

  // Oturum
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const newUser = (data?.session?.user as User) || null;
      setUser((prev) => (prev?.id === newUser?.id ? prev : newUser));
    });
    return () => { mounted = false; };
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
    return () => { cancelled = true; };
  }, [user?.id, ilan.id]);

  // Görüntülenme +1
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

  // Sepete ekle
  const sepeteEkle = async (urun: Ilan) => {
    if (!user) {
      alert("Lütfen giriş yapınız!");
      router.push("/giris");
      return;
    }

    // Eğer çok değerli bir özellik varsa ve seçilmemişse uyar
    const kategori = ilan?.kategori?.ad?.toLowerCase() || "";
    if (["gıda", "giyim"].includes(kategori)) {
      for (const [k, arr] of Object.entries(ozellikler)) {
        if (Array.isArray(arr) && arr.length > 1 && !secilenOzellikler[k]) {
          alert(`Lütfen "${prettyLabel(k)}" seçiniz.`);
          return;
        }
      }
    }

    const userId = (user as any).id as string;

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
          ozellikler: secilenOzellikler
        }]);
    }
    alert("Sepete eklendi!");
  };

  // Favori toggle
  const favoriyeToggle = async () => {
    if (!user) {
      alert("Lütfen giriş yapınız!");
      router.push("/giris");
      return;
    }
    const userId = (user as any).id as string;
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

  const sepeteGit = () => router.push(sepetPath);
  const logoClick = () => router.push(anasayfaPath);

  const badge = ilan.doped ? "Fırsat" : "Yeni";

  // Fiyat (string/number güvenli)
  const priceNum = Number((ilan as any).price);
  const fiyatText = Number.isFinite(priceNum)
    ? `${priceNum.toLocaleString("tr-TR")} ₺`
    : (ilan?.price ? `${ilan.price}` : "Fiyat bilgisi yok");

  // Görünecek özellik alanları:
  const visibleOzellikEntries = useMemo(() => {
    const kategori = ilan?.kategori?.ad?.toLowerCase() || "";
    if (!["gıda", "giyim"].includes(kategori)) return [];
    return Object.entries(ozellikler)
      .filter(([, v]) => Array.isArray(v) && v.length > 0);
  }, [ozellikler, ilan?.kategori?.ad]);

  // --- YORUM GÖNDER / GÜNCELLE (EKLENDİ) ---
  const yorumGonder = async () => {
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
      const mevcut = yorumlar.find((y) => y.user_id === (user as any).id);
      if (mevcut) {
        await supabase
          .from("yorumlar")
          .update({ yorum: yorum.trim(), puan })
          .eq("id", mevcut.id);
      } else {
        await supabase.from("yorumlar").insert([{
          urun_id: ilan.id,
          user_id: (user as any).id,
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
  };

  function formatDate(d?: string) {
    if (!d) return "";
    try { return new Date(d).toLocaleString("tr-TR"); }
    catch { return d || ""; }
  }

  function maskedName(uid?: string) {
    if (!uid) return "Anonim";
    const p = yorumUserMap[uid];
    if (!p) return (uid || "").slice(0, 8) || "Anonim";
    const f = (p.first_name || "").trim().slice(0, 9);
    const l = (p.last_name || "").trim().slice(0, 2);
    const label = `${f} ${l}`.trim();
    return label || "Anonim";
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
          <span className={`badge ${badge === "Fırsat" ? "deal" : "new"}`}>{badge}</span>

          <button
            type="button"
            className={`fav ${favori ? "active" : ""}`}
            title={favori ? "Favorilerden çıkar" : "Favorilere ekle"}
            onClick={favoriyeToggle}
          >
            {favori ? "❤️" : "🤍"}
          </button>

          <div className="mainImgWrap">
            <Image
              src={mainImg ?? "/placeholder.jpg"}
              alt={ilan.title}
              width={480}
              height={480}
              priority
              sizes="(max-width: 640px) 85vw, 480px"
              className="mainImg"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg"; }}
            />
          </div>

          {resimler.length > 1 && (
            <div className="thumbRow">
              {resimler.map((url, idx) => (
                <Image
                  key={idx}
                  src={url}
                  alt={`Ürün fotoğrafı ${idx + 1}`}
                  width={72}
                  height={72}
                  sizes="72px"
                  className={`thumb ${mainImg === url ? "active" : ""}`}
                  onClick={() => setMainImg(url)}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg"; }}
                />
              ))}
            </div>
          )}

          <h1 className="title">{ilan.title}</h1>

          {/* Firma + Puan */}
          {firmaAdi && (
            <div className="firmRow">
              <span>Firma: <b>{firmaAdi}</b></span>
              <span className="stars">{renderStars(firmaPuan)}</span>
              <span className="score">({firmaPuan.toFixed(1)})</span>
            </div>
          )}

          {/* Ürün Açıklaması */}
          {ilan.desc && (
            <div className="descBox">
              <p className="descText">{ilan.desc}</p>
            </div>
          )}

          {/* Ürün ortalama puan */}
          <div className="productRatingRow">
            <span className="stars">{renderStars(ortalamaPuan)}</span>
            <span className="score">({ortalamaPuan.toFixed(1)} / 5 • {yorumlar.length} yorum)</span>
          </div>

          {/* ÖZELLİKLER (sadece gıda/giyim) */}
          {visibleOzellikEntries.length > 0 && (
            <div className="opts">
              {visibleOzellikEntries.map(([ozellik, degerler]) => {
                const arr = (degerler as string[]).filter(Boolean);
                if (arr.length <= 1) {
                  return (
                    <div key={ozellik} className="opt">
                      <label className="optLabel">{prettyLabel(ozellik)}</label>
                      <div className="singleValue">{arr[0] || "—"}</div>
                    </div>
                  );
                }
                return (
                  <div key={ozellik} className="opt">
                    <label className="optLabel">{prettyLabel(ozellik)}</label>
                    <select
                      value={secilenOzellikler[ozellik] || ""}
                      onChange={(e) => handleOzellikSec(ozellik, e.target.value)}
                      className="optSelect"
                    >
                      <option value="">Seçiniz</option>
                      {arr.map((deger: string, idx: number) => (
                        <option key={idx} value={deger}>{deger}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fiyat */}
          <div className="price">{fiyatText}</div>

          {/* Butonlar */}
          <button className="btnAdd" onClick={() => sepeteEkle(ilan)}>🛒 Sepete Ekle</button>
         <button
  className="btnGo"
  onClick={() => router.push(sepetPath)}
  style={{
    backgroundColor: "#f97316", // turuncu
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    fontWeight: 700,
    cursor: "pointer"
  }}
>
  Sepete Git
</button>

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
                    <span className="reviewUser">{maskedName(y.user_id)}</span>
                    <span className="reviewStars">{renderStars(Number(y.puan) || 0)}</span>
                  </div>
                  {y.yorum && <p className="reviewText">{y.yorum}</p>}
                  <div className="reviewMeta">{formatDate(y.created_at)}</div>
                  {y.cevap && (
  <div className="reviewReply">
    <strong>Satıcı:</strong> {y.cevap}
  </div>
)}

                </div>
              ))
            )}
          </div>
        </section>

        {/* BENZER ÜRÜNLER (aynı kategori) */}
        {benzerler && benzerler.length > 0 && (
          <section className="similar">
            <h2>Benzer Ürünler</h2>
            <div className="simGrid">
              {benzerler.map((b) => {
                const imgs = normalizeResimler((b as any).resim_url);
                const firstImg = imgs[0] || "/placeholder.jpg";
                const pnum = Number((b as any).price);
                const priceTxt = Number.isFinite(pnum) ? `${pnum.toLocaleString("tr-TR")} ₺` : "—";
                return (
                  <div
                    key={b.id}
                    className="simCard"
                    onClick={() => router.push(`/urun/${b.id}?from=${from || ""}`)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="simImgWrap">
  <Image
    src={firstImg}
    alt={b.title}
    fill
    sizes="(max-width: 640px) 50vw, 220px"
    className="simImg"
    loading="lazy"
  />
</div>

                    <div className="simTitle" title={b.title}>{b.title}</div>
                    <div className="simPrice">{priceTxt}</div>
                  </div>
                );
              })}
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
        .topbar { width: 100%; position: sticky; top: 0; z-index: 50; background: #fff; box-shadow: 0 2px 12px #1bbd8a09; }
        .topbarInner { max-width: 1200px; margin: 0 auto; padding: 14px 16px; display: flex; align-items: center; gap: 16px; cursor: pointer; }
        .brand { font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: 1px; }

        .page { min-height: 100vh; background: linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 100%); width: 100%; display: flex; flex-direction: column; align-items: center; padding: 16px; overflow-x: hidden; }
        .detailCard { width: 460px; max-width: 100%; position: relative; margin: 24px auto 12px; background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 24px 20px; box-shadow: var(--shadow); text-align: center; }

        .badge { position: absolute; top: 18px; left: 18px; color: #fff; font-weight: 800; font-size: 13px; border-radius: 8px; padding: 5px 12px; box-shadow: 0 2px 8px #0000001a; }
        .badge.deal { background: var(--accent); }
        .badge.new { background: var(--brand-2); }

        .fav { position: absolute; top: 14px; right: 16px; font-size: 26px; background: transparent; border: none; cursor: pointer; color: #bdbdbd; transition: color .2s ease; }
        .fav.active { color: var(--accent); }

        .mainImgWrap { display: flex; justify-content: center; margin-top: 18px; margin-bottom: 14px; }
        .mainImg { border-radius: 14px; background: #f3f3f3; box-shadow: 0 6px 22px #1bbd8a0a; width: 100%; height: auto; max-width: 480px; object-fit: cover; }

        .thumbRow { display: flex; flex-wrap: nowrap; gap: 8px; justify-content: center; margin-bottom: 12px; overflow-x: auto; padding-bottom: 4px; }
        .thumb { border-radius: 8px; border: 2px solid var(--border); cursor: pointer; object-fit: cover; flex: 0 0 auto; }
        .thumb.active { border-color: var(--brand); }

        .title { font-size: 22px; line-height: 1.25; font-weight: 800; color: #1a1a1a; margin: 10px 0 8px; }

        .firmRow { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 15px; color: #31806c; margin-bottom: 10px; flex-wrap: wrap; }
        .stars { color: #f59e0b; font-size: 18px; }
        .score { color: var(--muted); font-size: 14px; }

        .descBox { background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin: 8px 0; text-align: left; }
        .descText { color: #111827; font-size: 14px; line-height: 1.45; white-space: pre-line; }

        .productRatingRow { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0 8px; font-weight: 700; color: #334155; }

        .opts { margin: 8px 0 12px; text-align: left; }
        .opt { margin-bottom: 10px; }
        .optLabel { display: block; font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #1f2937; }
        .optSelect { width: 100%; padding: 9px 10px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; background: #fff; }
        .singleValue { width: 100%; padding: 9px 10px; border-radius: 8px; border: 1px dashed #d1d5db; font-size: 14px; background: #f9fafb; color:#334155; }

        .price { font-size: 22px; font-weight: 800; color: var(--brand); margin: 8px 0 16px; }
        .btnAdd, .btnGo { width: 100%; border: none; cursor: pointer; border-radius: 10px; font-weight: 700; box-shadow: 0 2px 10px #00000011; }
        .btnAdd { background: var(--accent); color: #fff; padding: 13px 0; font-size: 16px; }
        .btnGo { margin-top: 12px; background: var(--brand); color: #fff; padding: 11px 0; font-size: 15px; }

        .reviews{ width:100%; max-width: 800px; background:#fff; border:1px solid var(--border); border-radius:16px; box-shadow: var(--shadow); padding:16px; margin: 8px auto 24px; }
        .reviews h2{ font-size:18px; font-weight:900; color:#111827; margin: 4px 0 12px; }
        .reviewForm{ border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin-bottom:14px; background:#fcfcfd; }
        .rateRow{ display:flex; align-items:center; gap:6px; margin-bottom:8px; }
        .rateStar{ border:none; background:transparent; cursor:pointer; font-size:22px; line-height:1; color:#f59e0b; }
        .rateScore{ font-weight:800; color:#334155; margin-left:4px; }
        .editBadge{ margin-left:8px; font-size:12px; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:999px; font-weight:700; }
        .reviewTextarea{ width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:10px; font-size:14px; resize:vertical; min-height:90px; background:#fff; }
        .reviewSend{ margin-top:8px; background: var(--brand-2); color:#fff; border:none; border-radius:10px; padding:10px 14px; font-weight:800; cursor:pointer; }
        .loginHint{ background:#f8fafc; border:1px solid #e5e7eb; padding:12px; border-radius:10px; margin-bottom:12px; color:#334155; }

        .reviewList{ display:flex; flex-direction:column; gap:10px; }
        .reviewCard{ border:1px solid #e5e7eb; border-radius:12px; padding:10px; background:#fff; }
        .reviewHead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
        .reviewUser{ font-weight:800; color:#0f172a; }
        .reviewStars{ color:#f59e0b; }
        .reviewText{ margin:4px 0 6px; color:#111827; font-size:14px; line-height:1.35; }
        .reviewMeta{ color:#64748b; font-size:12px; }

        .similar { width: 100%; max-width: 1200px; margin: 8px auto 40px; }
        .similar h2 { font-size: 18px; font-weight: 800; color: #111827; margin: 8px 6px 10px; }
        .simGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; padding: 0 6px; }
        .simCard { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 10px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px; cursor: pointer; transition: transform .15s ease; }
        .simCard:active { transform: scale(0.98); }
        .simImgWrap{
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;   /* kare alan */
  overflow: hidden;
  border-radius: 10px;
}
       .simImg{
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  display: block;
} 
        .simTitle { font-size: 14px; font-weight: 700; color: #111827; line-height: 1.25; height: 36px; overflow: hidden; }
        .simPrice { font-size: 14px; font-weight: 800; color: var(--brand); }

        @media (max-width: 640px) {
          .topbarInner { padding: 12px 14px; }
          .brand { font-size: 20px; }
          .page { padding: 10px 10px 20px; }
          .detailCard { width: 100%; margin: 14px auto 8px; padding: 16px 12px 18px; border-radius: 16px; }
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
          .simGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .simTitle { font-size: 13px; height: 34px; }
          .simPrice { font-size: 13px; }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .simGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
      .reviewReply {
  margin-top: 6px;
  padding: 8px 10px;
  border-left: 3px solid #16a34a;
  background: #f0fdf4;
  border-radius: 6px;
  font-size: 13px;
  color: #166534;
}
`}</style>
    </>
  );
}
