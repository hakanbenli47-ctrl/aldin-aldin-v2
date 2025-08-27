/* Add to globals.css for compact featured grid on phones:
@media (max-width: 640px){
  .featuredGrid{ grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 12px !important; }
  .featuredGrid .product-card{ padding: 10px !important; }
  .featuredGrid img{ height: 90px !important; }
  .featuredGrid h3{ font-size: 14px !important; }
}
*/

// NOTE: Colors now use CSS variables with fallbacks to your current palette.
// Define these in your global CSS (e.g., :root { --primary: #yourColor; ... }) to match your site theme.
import type { NextPage } from 'next';
import React, { useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';
import SloganBar from "../components/SloganBar";
import { FiChevronDown } from 'react-icons/fi'
import { useRouter } from 'next/router'

// Ortalama puan hesaplama fonksiyonu
async function ilanlaraOrtalamaPuanEkle(ilanlar: Ilan[]) {
  const result: Ilan[] = [];
  for (const ilan of ilanlar) {
    const { data: yorumlar } = await supabase
      .from("yorumlar")
      .select("puan")
      .eq("urun_id", ilan.id);
    const puanArr = (yorumlar || []).map(y => y.puan);
    const ortalama = puanArr.length
      ? puanArr.reduce((a, b) => a + b, 0) / puanArr.length
      : 0;
    result.push({ ...ilan, ortalamaPuan: ortalama });
  }
  return result;
}

// Firma adı + yıldız + yorum butonu
type FirmaInfo = {
  ad: string;
  puan: number;
};
function renderStars(rating: number, max = 5) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = max - full - half;
  return (
    <>
      {Array(full).fill(0).map((_, i) => <span key={"f"+i} style={{ color: "var(--warning, #f59e0b)", fontSize: 15 }}>★</span>)}
      {half ? <span key="h" style={{ color: "var(--warning, #f59e0b)", fontSize: 15 }}>☆</span> : null}
      {Array(empty).fill(0).map((_, i) => <span key={"e"+i} style={{ color: "var(--ink-300, #d1d5db)", fontSize: 15 }}>★</span>)}
    </>
  );
}

function FirmaBilgiSatiri({
  email,
  firmaAdMap,
  onYorumClick,
}: {
  email: string;
  firmaAdMap: Record<string, FirmaInfo>;
  onYorumClick?: () => void;
}) {
  const info = firmaAdMap[email];
  if (!info) return null;

  return (
    <div className="product-card standard" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 2,
      marginBottom: 8,
      justifyContent: 'flex-start',
    }}>
      {/* Firma adı */}
      <span style={{
        fontWeight: 600,
        fontSize: 15,
        color: "var(--primary, #2563eb)",
        marginRight: 3
      }}>
        {info.ad}
      </span>
      {/* Yıldız */}
      <span>
        {renderStars(info.puan)}
        <span style={{ color: "var(--ink-500, #64748b)", fontSize: 13, marginLeft: 5 }}>
          ({info.puan.toFixed(1)})
        </span>
      </span>

      {/* Yorumlar butonu */}
      <button
        onClick={onYorumClick}
        style={{
          background: "#f3f4f6",
          border: "1.5px solid var(--border, #e4e9ef)",
          color: "var(--ink-900, #223555)",
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: 600,
          marginLeft: 6,
          padding: "3px 11px",
          cursor: "pointer"
        }}
      >
        Yorumlar
      </button>
    </div>
  );
}

import {
  FiShoppingCart,
  FiSmartphone,
  FiUsers,
  FiBox,
  FiHeart,
  FiTag,
  FiMoreHorizontal,
  FiTruck,
  FiShield,
  FiRefreshCw,
  FiTrendingUp,
  FiStar
} from 'react-icons/fi';
import { FaCar } from 'react-icons/fa';

// ad’a göre icon ataması
const iconMap: Record<string, ReactNode> = {
  'Tümü': null,
  'Elektronik': <FiSmartphone size={28} />,
  'Araçlar':     <FaCar size={28} />,
  'Giyim':       <FiMoreHorizontal size={20}/>,
  'Ev Eşyaları': <FiMoreHorizontal size={20}/>,
  'Spor & Outdoor': <FiUsers size={28} />,
  'Anne & Bebek':   <FiHeart size={28} />,
  'Evcil Hayvan':   <FiBox size={28} />,
  'Kozmetik':       <FiTag size={28} />,
  'Diğer':          <FiMoreHorizontal size={28} />,
};

type Ilan = {
  id: number;
  title: string;
  desc: string;
  price: string;
  kategori_id: number;
  resim_url: string[] | string | null;
  stok?: number;
  created_at?: string;
  doped?: boolean;
  doped_expiration?: string;
  indirimli_fiyat?: string;
  views?: number;
  user_email: string;
  ortalamaPuan?: number;
  ozellikler?: Record<string, string[]>;
};

type Kategori = {
  id: number;
  ad: string;
};

type CartItem = {
  id: number;
  adet: number;
  product_id: number;
};

function isYeni(created_at?: string) {
  if (!created_at) return false;
  const ilanTarihi = new Date(created_at).getTime();
  const simdi = Date.now();
  return simdi - ilanTarihi < 86400000;
}

/** === ARAMA & SIRALAMA yardımcıları === */
const trMap: Record<string,string> = { 'İ':'i','I':'ı','Ş':'ş','Ğ':'ğ','Ü':'ü','Ö':'ö','Ç':'ç' };
const trLower = (s:string) => s.replace(/[İIŞĞÜÖÇ]/g, ch => trMap[ch] ?? ch).toLowerCase();
const stripDiacritics = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeText = (s:string) => stripDiacritics(trLower(s || ''));
const parsePrice = (p?: string) => {
  if (!p) return 0;
  const cleaned = String(p).replace(/\s/g,'').replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,'');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

/** === HERO SLIDE verileri (görsel yoksa degrade kutu) === */

const Index2: NextPage = () => {
  const [loginDropdown, setLoginDropdown] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, FirmaInfo>>({});
  const [dbKategoriler, setDbKategoriler] = useState<Kategori[]>([]);
  const [populerIlanlar, setPopulerIlanlar] = useState<Ilan[]>([]);
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dopedIlanlar, setDopedIlanlar] = useState<Ilan[]>([]);
  // Hero için state
const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const router = useRouter()
  const { kategori } = router.query
  const [aktifKategori, setAktifKategori] = useState<{ ad: string; id?: number | null }>({
    ad: 'Tümü',
    id: undefined
  });
  const [favoriler, setFavoriler] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);

  // Hızlı filtreler + sıralama + görünür sayısı
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [onlyInStock, setOnlyInStock]     = useState(false);
  const [onlyNew, setOnlyNew]             = useState(false);
  const [minPrice, setMinPrice]           = useState<string>('');
  const [maxPrice, setMaxPrice]           = useState<string>('');
  const [sortKey, setSortKey] = useState<'relevance'|'priceAsc'|'priceDesc'|'rating'|'newest'|'viewsDesc'>('relevance');
  const [visibleCount, setVisibleCount]   = useState(12);

  // === HERO AUTOPLAY ===
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPause, setHeroPause] = useState(false);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollHero = (idx: number) => {
    const el = heroRef.current;
    if (!el) return;
    const target = el.children[idx] as HTMLElement | undefined;
    const left = target ? target.offsetLeft : idx * el.clientWidth;
    el.scrollTo({ left, behavior: 'smooth' });
  };

  useEffect(() => {
    if (heroTimer.current) clearInterval(heroTimer.current);
    if (!heroPause) {
      heroTimer.current = setInterval(() => {
        setHeroIndex(i => {
          const next = (i + 1) % heroSlides.length;
          requestAnimationFrame(() => scrollHero(next));
          return next;
        });
      }, 3500);
    }
    return () => { if (heroTimer.current) clearInterval(heroTimer.current); };
  }, [heroPause]);

  useEffect(() => { scrollHero(heroIndex); }, [heroIndex]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[];
      let nearest = 0, best = Infinity;
      children.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft - el.scrollLeft);
        if (d < best) { best = d; nearest = i; }
      });
      setHeroIndex(nearest);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsAndroid(/Android/i.test(navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      document.documentElement.classList.add('is-android');
      return () => {
        document.documentElement.classList.remove('is-android');
      };
    }
  }, []);

  // Debounce arama
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function fetchFirmaAdlari() {
      const { data: firmalar } = await supabase
        .from("satici_firmalar")
        .select("email, firma_adi, puan");

      const map: Record<string, FirmaInfo> = {};
      firmalar?.forEach((f: any) => {
        if (f.email && f.firma_adi) {
          map[f.email] = { ad: f.firma_adi, puan: f.puan ?? 0 };
        }
      });
      setFirmaAdMap(map);
    }
    fetchFirmaAdlari();
  }, []);

  useEffect(() => {
    if (kategori) {
      const kat = dbKategoriler.find(k => String(k.id) === kategori)
      if (kat) setAktifKategori({ ad: kat.ad, id: kat.id })
    }
  }, [kategori, dbKategoriler]);

  useEffect(() => {
    async function fetchDopedIlanlar() {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('ilan')
        .select('*')
        .eq('doped', true)
        .gt('doped_expiration', now)
        .order('doped_expiration', { ascending: false });
      setDopedIlanlar(data || []);
    }
    async function fetchData() {
      const { data: katData } = await supabase.from('kategori').select('*');
      setDbKategoriler(katData || []);

      const { data: ilanData } = await supabase
        .from('ilan')
        .select(`
          id, title, desc, price, kategori_id, resim_url, stok,
          created_at, doped, doped_expiration, indirimli_fiyat,
          views, user_email, ozellikler
        `);
      const ilanlarWithAvg = await ilanlaraOrtalamaPuanEkle(ilanData || []);
      setIlanlar(ilanlarWithAvg);

      const populer = (ilanlarWithAvg || [])
        .filter(i => (i.ortalamaPuan ?? 0) > 0)
        .sort((a, b) => (b.ortalamaPuan ?? 0) - (a.ortalamaPuan ?? 0))
        .slice(0, 6);
      setPopulerIlanlar(populer);

      setLoading(false);
    }
    fetchData();
    fetchDopedIlanlar();
  }, []);
useEffect(() => {
  async function fetchHeroSlides() {
    // Elektronik
    const { data: elektronik } = await supabase
      .from("ilan")
      .select("id, title, resim_url")
      .eq("kategori_id", 1)
      .limit(3);

    // Giyim
    const { data: giyim } = await supabase
      .from("ilan")
      .select("id, title, resim_url")
      .eq("kategori_id", 2)
      .limit(3);

    // Spor
    const { data: spor } = await supabase
      .from("ilan")
      .select("id, title, resim_url")
      .eq("kategori_id", 3)
      .limit(3);

    setHeroSlides([
      {
  id: "h1",
  title: "Mega Kampanya",
  sub: elektronik?.[1]?.title || "Elektronik Ürünler",
  cta: "Fırsatları Gör",
  href: elektronik?.[1] ? `/urun/${elektronik[1].id}` : "/?kategori=Elektronik",
  img: Array.isArray(elektronik?.[1]?.resim_url)
    ? elektronik[1].resim_url[0]
    : elektronik?.[1]?.resim_url || "/banner-1.jpg",
},
      {
        id: "h2",
        title: "En Güçlü DonanımlarS",
        sub: elektronik?.[2]?.title || "Elektronik Ürünleri",
        cta: "İlham Al",
        href: elektronik?.[2] ? `/urun/${elektronik[2].id}` : "/?kategori=Elekronik",
        img: Array.isArray(elektronik?.[2]?.resim_url)
          ? elektronik[2].resim_url[0]
          : elektronik?.[2]?.resim_url || "/banner-2.jpg",
      },
      {
        id: "h3",
        title: "Süper Fırsat",
        sub: spor?.[0]?.title || "Spor & Outdoor",
        cta: "Keşfet",
        href: spor?.[0] ? `/urun/${spor[0].id}` : "/?kategori=Spor%20&%20Outdoor",
        img: Array.isArray(spor?.[0]?.resim_url)
          ? spor[0].resim_url[0]
          : spor?.[0]?.resim_url || "/banner-3.jpg",
      },
    ]);
  }

  fetchHeroSlides();
}, []);


  // Son bakılanlar
  const [recentlyViewed, setRecentlyViewed] = useState<Ilan[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recently_viewed');
      if (!raw) return;
      const ids: number[] = JSON.parse(raw);
      const list = ids.map(id => ilanlar.find(i => i.id === id)).filter(Boolean) as Ilan[];
      setRecentlyViewed(list);
    } catch {}
  }, [ilanlar]);

  // Flash deals tick
  const [flashTick, setFlashTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setFlashTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const sepetteVarMi = (id: number) => cartItems.find((item) => item.product_id === id);
  // Varsayılan özellikler
  let defaultOzellikler: Record<string, string> = {};
  const sepeteEkle = async (urun: Ilan) => {
    if (!isLoggedIn || !user) {
      alert("Lütfen giriş yapınız!");
      window.location.href = "/giris";
      return;
    }
    const defaultOzellikler: Record<string, string> = {};
    const sepette = sepetteVarMi(urun.id);

    if (sepette) {
      await supabase.from("cart").update({ adet: sepette.adet + 1 }).eq("id", sepette.id);
    } else {
      await supabase.from("cart").insert([{
        user_id: user.id, product_id: urun.id, adet: 1, ozellikler: defaultOzellikler
      }]);
    }
    const { data: cartData } = await supabase
      .from("cart")
      .select("id, adet, product_id, ozellikler")
      .eq("user_id", user.id);
    setCartItems(cartData || []);
  };

  const sepeteGit = () => { window.location.href = '/sepet2'; };

  const toggleFavori = async (ilanId: number) => {
    if (!isLoggedIn || !user) {
      alert("Lütfen giriş yapınız!");
      window.location.href = "/giris";
      return;
    }
    if (favoriler.includes(ilanId)) {
      await supabase.from("favoriler").delete().eq("user_id", user.id).eq("ilan_id", ilanId);
      setFavoriler(favoriler.filter(id => id !== ilanId));
    } else {
      await supabase.from("favoriler").insert([{ user_id: user.id, ilan_id: ilanId }]);
      setFavoriler([...favoriler, ilanId]);
    }
  };

  // Yönlendirme + recently_viewed yazma
  const goToProduct = (id: number, from: string) => {
    try {
      const raw = localStorage.getItem('recently_viewed');
      const arr: number[] = raw ? JSON.parse(raw) : [];
      const updated = [id, ...arr.filter(x => x !== id)].slice(0, 20);
      localStorage.setItem('recently_viewed', JSON.stringify(updated));
    } catch {}
    window.location.href = `/urun/${id}?from=${from}`;
  };

  /** === GELİŞMİŞ FİLTRELEME + SIRALAMA + ÖNERİ === */
  const aktifKategoriId = aktifKategori.id ?? null;

  const relevanceScore = (p: Ilan, q: string) => {
    if (!q) return 0;
    const qn = normalizeText(q);
    const title = normalizeText(p.title);
    const desc  = normalizeText(p.desc);
    const katAd = normalizeText(dbKategoriler.find(k=>k.id===p.kategori_id)?.ad || '');
    const firma = normalizeText(firmaAdMap[p.user_email]?.ad || '');
    let score = 0;
    if (title.includes(qn)) score += 6;
    if (katAd.includes(qn)) score += 3;
    if (firma.includes(qn)) score += 2;
    if (desc.includes(qn))  score += 1;
    if (title.startsWith(qn)) score += 3;
    return score;
  };

  const { items: normalIlanlar, total: totalAfterFilters, suggestions } = useMemo(() => {
    const base = ilanlar.filter(i => {
      const kategoriOk = !aktifKategoriId || i.kategori_id === aktifKategoriId;
      const q = normalizeText(debouncedSearch);
      if (!q) return kategoriOk;
      const title = normalizeText(i.title);
      const desc  = normalizeText(i.desc);
      const katAd = normalizeText(dbKategoriler.find(k=>k.id===i.kategori_id)?.ad || '');
      const firma = normalizeText(firmaAdMap[i.user_email]?.ad || '');
      const matches = title.includes(q) || desc.includes(q) || katAd.includes(q) || firma.includes(q);
      return kategoriOk && matches;
    });

    const afterQuick = base.filter(p => {
      if (onlyDiscounted && !(p.indirimli_fiyat && p.indirimli_fiyat !== p.price)) return false;
      if (onlyInStock && !(p.stok && p.stok > 0)) return false;
      if (onlyNew && !isYeni(p.created_at)) return false;
      const minOk = minPrice ? parsePrice(p.indirimli_fiyat || p.price) >= parseFloat(minPrice) : true;
      const maxOk = maxPrice ? parsePrice(p.indirimli_fiyat || p.price) <= parseFloat(maxPrice) : true;
      return minOk && maxOk;
    });

    const sorted = [...afterQuick].sort((a,b) => {
      switch (sortKey) {
        case 'priceAsc':  return parsePrice(a.indirimli_fiyat || a.price) - parsePrice(b.indirimli_fiyat || b.price);
        case 'priceDesc': return parsePrice(b.indirimli_fiyat || b.price) - parsePrice(a.indirimli_fiyat || a.price);
        case 'rating':    return (b.ortalamaPuan ?? 0) - (a.ortalamaPuan ?? 0);
        case 'newest':    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'viewsDesc': return (b.views ?? 0) - (a.views ?? 0);
        case 'relevance':
        default:          return relevanceScore(b, debouncedSearch) - relevanceScore(a, debouncedSearch);
      }
    });

    const total = sorted.length;
    const sliced = sorted.slice(0, visibleCount);

    const sug = debouncedSearch
      ? [...ilanlar]
          .map(x => ({ p: x, s: relevanceScore(x, debouncedSearch)}))
          .filter(x => x.s > 0)
          .sort((a,b)=> b.s - a.s)
          .slice(0,6)
          .map(x => x.p)
      : [];

    return { items: sliced, total, suggestions: sug };
  }, [
    ilanlar, firmaAdMap, aktifKategoriId, debouncedSearch,
    onlyDiscounted, onlyInStock, onlyNew, minPrice, maxPrice,
    sortKey, visibleCount, dbKategoriler
  ]);

  const indirimliUrunler = useMemo(
    () => ilanlar.filter(x => x.indirimli_fiyat && x.indirimli_fiyat !== x.price).slice(0, 5),
    [ilanlar]
  );

  const cokGoruntulenenler = useMemo(
    () => [...ilanlar].sort((a,b)=> (b.views ?? 0) - (a.views ?? 0)).slice(0, 12),
    [ilanlar]
  );

  const kategoriSayilari = useMemo(() => {
    const map = new Map<number, number>();
    ilanlar.forEach(i => map.set(i.kategori_id, (map.get(i.kategori_id) ?? 0) + 1));
    const list = dbKategoriler.map(k => ({ ...k, sayi: map.get(k.id) ?? 0 }));
    return list.sort((a,b)=> b.sayi - a.sayi);
  }, [ilanlar, dbKategoriler]);

  const topMagazalar = useMemo(() => {
    const counts: Record<string, number> = {};
    ilanlar.forEach(i => { counts[i.user_email] = (counts[i.user_email] ?? 0) + 1; });
    const list = Object.keys(counts).map(email => ({
      email,
      ad: firmaAdMap[email]?.ad || email.split('@')[0],
      puan: firmaAdMap[email]?.puan ?? 0,
      urun: counts[email]
    }));
    return list.sort((a,b)=> (b.puan - a.puan) || (b.urun - a.urun)).slice(0, 10);
  }, [ilanlar, firmaAdMap]);

  const trendingTerms = useMemo(() => {
    const stop = new Set(['ve','ile','the','for','ama','çok','az','yeni','super','süper','set','paket','pro','mini','max']);
    const freq: Record<string, number> = {};
    ilanlar.forEach(i => {
      normalizeText(i.title).split(/\s+/).forEach(w => {
        if (!w || w.length < 3 || stop.has(w)) return;
        if (/^\d+$/.test(w)) return;
        freq[w] = (freq[w] ?? 0) + 1;
      });
    });
    return Object.entries(freq).sort((a,b)=> b[1]-a[1]).slice(0,10).map(x => x[0]);
  }, [ilanlar]);

  const getRemainingTime = (expirationDate: string | undefined): string => {
    if (!expirationDate) return '';
    const now = new Date();
    const expiration = new Date(expirationDate);
    const diff = expiration.getTime() - now.getTime();
    if (diff <= 0) return 'Süre doldu';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return `Kalan süre: ${days} gün ${hours} saat`;
  };

  const findKategoriAd = (id: number | null | undefined): string => {
    if (typeof id !== "number" || isNaN(id)) return "";
    const kat = dbKategoriler.find((k) => k.id === id);
    return kat?.ad || "";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUser(null);
    window.location.href = '/';
  };

  if (loading) return <p style={{ textAlign: "center", padding: 40 }}>⏳ Yükleniyor...</p>;

  // Gece yarısına geri sayım (Flash Deals için)
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(23,59,59,999);
  const left = Math.max(0, midnight.getTime() - now.getTime());
  const HH = Math.floor(left/3600000).toString().padStart(2,'0');
  const MM = Math.floor((left%3600000)/60000).toString().padStart(2,'0');
  const SS = Math.floor((left%60000)/1000).toString().padStart(2,'0');

  return (
    <>
      <Head>
        <title>80bir - Alıcı</title>
        <meta name="description" content="80bir -En iyi fırsatlar burada" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* === PAGE WRAP: Tam genişlik === */}
      <div className="force-desktop">
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(120deg, var(--surface, #f8fafc) 0%, var(--bg-grad-end, #eafcf6) 100%)',
        }}>

          {/* HEADER (full-width) */}
          <header className="pwa-header"
            style={{
              background: '#fff',
              boxShadow: '0 2px 14px #1648b00a',
              position: 'sticky',
              top: 0,
              zIndex: 1000,
              borderBottom: '1.5px solid var(--border, #e4e9ef)',
              padding: 0,
              width: '100%'
            }}>
            <div className="header-inner"
              style={{
                width: '100%',
                margin: 0,
                padding: '0 12px',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                minHeight: 70,
                gap: 10,
              }}>
              {/* LEFT: Logo */}
              <div className="header-left" style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Image src="/logo.png" alt="Aldın Aldın Logo" width={110} height={52} />
              </div>

              {/* MIDDLE: Categories + Search */}
              <div className="header-middle" style={{ display:'flex', alignItems:'center', gap:10, width:'100%', position:'relative' }}>
                {/* Categories button */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setDropdownOpen(o => !o)}
                    style={{
                      background: dropdownOpen
                        ? 'linear-gradient(93deg,var(--ink-900, #223555) 60%,var(--primary-400, #3479e3) 100%)'
                        : 'linear-gradient(90deg,var(--surface, #f8fafc) 0%,var(--dropdown-active, #eef6fd) 100%)',
                      color: dropdownOpen ? '#fff' : 'var(--primary,#2563eb)',
                      border: '1.5px solid var(--dropdown-border, #dde7fa)',
                      fontWeight: 700,
                      fontSize: isAndroid ? 13 : 14,
                      padding: isAndroid ? '6px 10px' : '8px 12px',
                      borderRadius: isAndroid ? 8 : 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: isAndroid ? 6 : 8,
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all .19s cubic-bezier(.55,.01,.48,1.05)',
                      position: 'relative'
                    }}>
                    <FiTag size={isAndroid ? 16 : 18} />
                    <span style={{ fontWeight:800, letterSpacing:'.3px' }}>Kategoriler</span>
                    <FiChevronDown size={isAndroid ? 14 : 16} />
                  </button>

                  {dropdownOpen && (
                    <ul
                      style={{
                        position: 'absolute',
                        top: '110%',
                        left: 0,
                        marginTop: 6,
                        padding: '9px 0',
                        background: '#fff',
                        boxShadow: '0 10px 32px 0 #3479e311,0 2px 8px #22355518',
                        borderRadius: 11,
                        listStyle: 'none',
                        minWidth: 210,
                        zIndex: 2000,
                        border: '1.5px solid var(--panel-border, #e3e8f2)',
                        animation: 'dropdownShow .18s cubic-bezier(.6,.2,.17,1.08)'
                      }}
                      onMouseLeave={() => setDropdownOpen(false)}
                    >
                      <li>
                        <button
                          style={{
                            width: "100%",
                            background: 'none',
                            border: 'none',
                            padding: '10px 19px',
                            color: aktifKategori.ad === 'Tümü' ? 'var(--primary)' : 'var(--ink-900)',
                            fontWeight: 700,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: 15.5,
                            backgroundColor: aktifKategori.ad === 'Tümü' ? 'var(--dropdown-active)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            borderRadius: 7,
                            transition: 'background .14s'
                          }}
                          onClick={() => { setAktifKategori({ ad: 'Tümü', id: undefined }); setDropdownOpen(false); }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--dropdown-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = aktifKategori.ad === 'Tümü' ? 'var(--dropdown-active)' : 'transparent')}
                        >
                          {iconMap['Tümü'] || <FiMoreHorizontal size={20} />} Tümü
                        </button>
                      </li>
                      {dbKategoriler.map((kat) => (
                        <li key={kat.id}>
                          <button
                            style={{
                              width: "100%",
                              background: 'none',
                              border: 'none',
                              padding: '10px 19px',
                              color: aktifKategori.id === kat.id ? 'var(--primary)' : 'var(--ink-900)',
                              fontWeight: 700,
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 15.5,
                              backgroundColor: aktifKategori.id === kat.id ? 'var(--dropdown-active)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              borderRadius: 7,
                              transition: 'background .14s'
                            }}
                            onClick={() => { setAktifKategori({ ad: kat.ad, id: kat.id }); setDropdownOpen(false); }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dropdown-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = aktifKategori.id === kat.id ? 'var(--dropdown-active)' : 'transparent')}
                          >
                            {iconMap[kat.ad] || <FiMoreHorizontal size={20} />} {kat.ad}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Search input + öneriler */}
                <div style={{ position:'relative', flex:1 }}>
                  <input
                    type="text"
                    placeholder="🔍 Ürün, kategori veya firma ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    style={{
                      width:'100%',
                      border: '1.5px solid var(--border-200, #e2e8f0)',
                      borderRadius: 10,
                      padding: '10px 44px 10px 14px',
                      fontSize: 16,
                      height: isAndroid ? 48 : undefined,
                      background: 'var(--surface, #f8fafc)',
                      outline: 'none',
                      color: 'var(--ink-900, #223555)',
                      minWidth: 0
                    }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      title="Temizle"
                      style={{
                        position:'absolute', right:10, top: '50%', transform:'translateY(-50%)',
                        border:'none', background:'transparent', cursor:'pointer', fontSize:18, color:'#9aa3af'
                      }}
                    >×</button>
                  )}

                  {showSuggestions && debouncedSearch && suggestions.length > 0 && (
                    <div
                      style={{
                        position:'absolute', top:'110%', left:0, width:'100%',
                        background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                        boxShadow:'0 8px 24px rgba(0,0,0,.08)', zIndex:3000, overflow:'hidden'
                      }}
                    >
                      {suggestions.map(s => (
                        <div
                          key={s.id}
                          onMouseDown={(e)=>{ e.preventDefault(); goToProduct(s.id, 'search_suggest'); }}
                          style={{
                            display:'grid',
                            gridTemplateColumns:'56px 1fr auto',
                            gap:10, alignItems:'center',
                            padding:'8px 10px',
                            borderBottom:'1px solid #f1f5f9',
                            cursor:'pointer'
                          }}
                        >
                          <img
                            src={Array.isArray(s.resim_url) ? s.resim_url[0] || "/placeholder.jpg" : s.resim_url || "/placeholder.jpg"}
                            alt={s.title}
                            style={{ width:56, height:40, objectFit:'cover', borderRadius:6, border:'1px solid #eef2f7' }}
                          />
                          <div style={{ overflow:'hidden' }}>
                            <div style={{ fontWeight:700, fontSize:14, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{s.title}</div>
                            <div style={{ fontSize:12, color:'#6b7280' }}>{findKategoriAd(s.kategori_id)}</div>
                          </div>
                          <div style={{ fontWeight:700, fontSize:13 }}>
                            {s.indirimli_fiyat && s.indirimli_fiyat !== s.price ? s.indirimli_fiyat : s.price} ₺
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Cart + Auth */}
              <div className="header-actions" style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div
                  onClick={sepeteGit}
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    padding: 8,
                    background: "var(--surface, #f8fafc)",
                    borderRadius: 9,
                    boxShadow: "0 1px 7px rgba(27,189,138,.09)",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title="Sepetim"
                >
                  <FiShoppingCart size={26} color="var(--accent, #16a34a)" />
                  {cartItems.length > 0 && (
                    <span style={{
                      position: "absolute",
                      top: -4,
                      right: -7,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#fff",
                      background: "var(--success-500, #22c55e)",
                      borderRadius: 16,
                      padding: "2px 6px",
                      minWidth: 18,
                      textAlign: "center"
                    }}>
                      {cartItems.reduce((top, c) => top + (c.adet || 1), 0)}
                    </span>
                  )}
                </div>

                {!isLoggedIn ? (
                  <>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setLoginDropdown(prev => !prev)}
                        style={{
                          background: 'var(--primary, #2563eb)',
                          color: '#fff',
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: 'pointer'
                        }}
                      >
                        Giriş Yap
                      </button>

                      {loginDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "110%",
                            right: 0,
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                            zIndex: 999,
                            minWidth: 160
                          }}
                        >
                          <button
                            onClick={() => window.location.href = '/giris'}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "10px 14px",
                              background: "none",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: 14,
                              color: "#223555"
                            }}
                          >
                            👤 Alıcı Giriş
                          </button>
                          <button
                            onClick={() => window.location.href = '/giris-satici'}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "10px 14px",
                              background: "none",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: 14,
                              color: "#223555"
                            }}
                          >
                            🛒 Satıcı Giriş
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => window.location.href = '/kayit'}
                      style={{
                        background: 'var(--accent, #16a34a)',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                    >
                      Kaydol
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => window.location.href = '/profil2'}
                      style={{
                        background: 'var(--surface, #f3f4f6)',
                        color: 'var(--primary, #2563eb)',
                        border: '1px solid rgba(37,99,235,.15)',
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                    >
                      👤 Profilim
                    </button>
                    <button
                      onClick={handleLogout}
                      style={{
                        background: 'var(--danger, #e11d48)',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                    >
                      Çıkış
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>

          <SloganBar />

          {/* ---- HERO + Avantaj Barı + Kategori Çipleri + Trend Aramalar ---- */}
          <section style={{ width:'100%', margin:'10px 0 0' }}>
            {/* Hero Slider (FULL WIDTH) */}
            <div
              ref={heroRef}
              className="hero-scroll"
              onMouseEnter={() => setHeroPause(true)}
              onMouseLeave={() => setHeroPause(false)}
              onTouchStart={() => setHeroPause(true)}
              onTouchEnd={() => setHeroPause(false)}
              style={{
                display:'grid',
                gridAutoFlow:'column',
                gridAutoColumns:'100%',
                overflowX:'auto',
                scrollSnapType:'x mandatory',
                gap:12,
                borderRadius:0, // full-bleed
                width:'100vw',
              }}>
              {heroSlides.map((s)=>( 
  <div key={s.id} className="hero-slide">
    <img src={s.img} alt={s.title}
      onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} />
    <div className="hero-content">
      <div>
        <div className="hero-title">{s.title}</div>
        <div className="hero-sub">{s.sub}</div>
        <button onClick={()=> window.location.href = s.href} className="hero-btn">
          {s.cta} →
        </button>
      </div>
    </div>
  </div>
))}
            </div>
            <div className="hero-dots">
              {heroSlides.map((_, i)=>(
                <button
                  key={i}
                  aria-label={`Hero ${i+1}`}
                  className={i === heroIndex ? 'active' : ''}
                  onClick={() => {
                    setHeroIndex(i);
                    const el = heroRef.current;
                    if (!el) return;
                    const target = el.children[i] as HTMLElement | undefined;
                    const left = target ? target.offsetLeft : i * (el.clientWidth || 0);
                    el.scrollTo({ left, behavior: 'smooth' });
                  }}
                />
              ))}
            </div>

            {/* Avantaj barı (full width card grid) */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',
              gap:12, marginTop:12, padding:'0 12px'
            }}>
              <div style={{ background:'#9cdd84ff', border:'1px solid #e5e7eb', borderRadius:12, padding:12, display:'flex', gap:10, alignItems:'center' }}>
                <FiTruck size={22} /><div><div style={{fontWeight:800}}>Hızlı Kargo</div><div style={{fontSize:13, color:'#6b7280'}}>Seçili ürünlerde aynı gün</div></div>
              </div>
              <div style={{ background:'#77c0c5ff', border:'1px solid #e5e7eb', borderRadius:12, padding:12, display:'flex', gap:10, alignItems:'center' }}>
                <FiShield size={22} /><div><div style={{fontWeight:800}}>Güvenli Ödeme</div><div style={{fontSize:13, color:'#6b7280'}}>3D Secure & koruma</div></div>
              </div>
              <div style={{ background:'#ed3a3aff', border:'1px solid #e5e7eb', borderRadius:12, padding:12, display:'flex', gap:10, alignItems:'center' }}>
                <FiRefreshCw size={22} /><div><div style={{fontWeight:800}}>Kolay İade</div><div style={{fontSize:13, color:'#6b7280'}}>14 gün koşulsuz</div></div>
              </div>
              <div style={{ background:'#ee87d3ff', border:'1px solid #e5e7eb', borderRadius:12, padding:12, display:'flex', gap:10, alignItems:'center' }}>
                <FiTrendingUp size={22} /><div><div style={{fontWeight:800}}>Trend Ürünler</div><div style={{fontSize:13, color:'#6b7280'}}>Her gün güncellenir</div></div>
              </div>
            </div>

            {/* Kategori çipleri */}
           <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12, width:'100%', justifyContent:'center' }}>
              {kategoriSayilari.slice(0,12).map(k=>(
                <button key={k.id}
                  onClick={()=> setAktifKategori({ ad:k.ad, id:k.id })}
                  style={{
                    border:'1px solid #e5e7eb', background:'#fff', borderRadius:999, padding:'6px 12px', cursor:'pointer',
                    fontWeight:800, fontSize:13, display:'flex', alignItems:'center', gap:8
                  }}>
                  {iconMap[k.ad] || <FiMoreHorizontal size={18}/>} {k.ad} <span style={{color:'#94a3b8', fontWeight:700}}>({k.sayi})</span>
                </button>
              ))}
            </div>

            {/* Trend aramalar */}
            {trendingTerms.length > 0 && (
              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', padding:'0 12px' }}>
                <span style={{ fontWeight:900, color:'#334155', fontSize:14 }}>Trend Aramalar:</span>
                {trendingTerms.map(t=>(
                  <button key={t}
                    onClick={()=> setSearch(t)}
                    style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:999, padding:'4px 10px', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ANA İÇERİK (full width) */}
          <div className="layout-3col"
            style={{
              display: 'flex',
              width: '100%',
              margin: 0,
              position: 'relative',
              gap: 20,
              alignItems: "flex-start",
              padding: 0
            }}>
            <main className="main-col" style={{ width: "100%", padding: 0, flexGrow: 1 }}>
              {/* FLASH DEALS */}
              {indirimliUrunler.length > 0 && (
                <section className="section-block"
                  style={{
                    background:'#fff',
                    padding:'22px 0px',
                    borderRadius:0,
                    margin:'24px 0',
                    border:'1.5px solid #fde68a',
                    boxShadow:'0 4px 16px rgba(234,179,8,.15)'
                  }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', padding:'0 12px' }}>
                    <h2 style={{ fontSize:22, fontWeight:900, color:'#78350f' }}>⚡ Flash Deals</h2>
                    <div style={{ fontWeight:900, fontSize:16, color:'#b45309' }}>Bitişe: {HH}:{MM}:{SS}</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px,1fr))', gap:14, marginTop:12, padding:'0 12px' }}>
                    {indirimliUrunler.slice(0,8).map(p=>(
                      <div key={p.id}
                        onClick={()=> goToProduct(p.id,'flash')}
                        style={{ cursor:'pointer', background:'#fff8', border:'1px solid #fde68a', borderRadius:12, padding:10, position:'relative' }}>
                        <span style={{ position:'absolute', top:10, left:10, background:'#ef4444', color:'#fff', fontSize:11, fontWeight:900, borderRadius:6, padding:'2px 8px' }}>-%</span>
                        <img
                          src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                          alt={p.title}
                          style={{ width:'100%', height:110, objectFit:'cover', borderRadius:8, border:'1px solid #fee2e2' }}
                        />
                        <div style={{ fontWeight:800, marginTop:6, fontSize:14, color:'#111827' }}>{p.title}</div>
                        <div style={{ fontWeight:700, fontSize:14 }}>
                          <span style={{ textDecoration:'line-through', color:'#9ca3af', marginRight:6 }}>{p.price}₺</span>
                          <span style={{ color:'#ef4444' }}>{p.indirimli_fiyat}₺</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ÖNE ÇIKANLAR */}
              <section style={{
                background: '#fff',
                padding: '30px 12px',
                borderRadius: 0,
                margin: '0 0 42px',
                boxShadow: '0 4px 22px #f59e0b18',
                border: '1.5px solid var(--border-200, #e2e8f0)'
              }}>
                <h2 style={{ fontSize: 23, fontWeight: 800, color: 'var(--amber-700, #b45309)', marginBottom: 20, letterSpacing: ".2px", padding:'0 12px' }}>
                  🚀 Öne Çıkanlar
                </h2>
                {dopedIlanlar.length === 0 ? (
                  <div style={{
                    background: 'var(--note-bg, #fef9c3)',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: 'var(--note-fg, #92400e)',
                    fontWeight: 500,
                    fontSize: 16
                  }}>
                    Şu anda öne çıkarılan bir ilan yok.
                  </div>
                ) : (
                  <div className="featuredGrid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
                      gap: 23
                    }}>
                    {dopedIlanlar.map((product) => (
                      <div className="product-card featured"
                        key={product.id}
                        style={{
                          background: 'var(--highlight, #fef08a)',
                          borderRadius: 15,
                          padding: 15,
                          boxShadow: '0 4px 17px #eab3082b',
                          transition: 'transform 0.15s, box-shadow 0.18s',
                          cursor: 'pointer',
                          border: "1.5px solid var(--highlight-border, #fbe192)"
                        }}
                        onClick={() => goToProduct(product.id,'featured')}
                        onMouseOver={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)"}
                        onMouseOut={e => (e.currentTarget as HTMLElement).style.transform = "none"}
                      >
                        <img
                          src={Array.isArray(product.resim_url) ? product.resim_url[0] || '/placeholder.jpg' : product.resim_url || '/placeholder.jpg'}
                          alt={product.title}
                          style={{
                            width: '100%',
                            height: 160,
                            objectFit: 'cover',
                            borderRadius: 10,
                            marginBottom: 12,
                            border: "1.5px solid var(--highlight-img-border, #fae27a)"
                          }}
                        />
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--amber-900, #78350f)', marginBottom: 6 }}>
                          {product.title}
                        </h3>
                        <FirmaBilgiSatiri
                          email={product.user_email}
                          firmaAdMap={firmaAdMap}
                          onYorumClick={() => window.location.href = `/firma-yorumlar/${product.user_email}`}
                        />
                        {product.ortalamaPuan !== undefined && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                            {renderStars(product.ortalamaPuan ?? 0)}
                            <span style={{ color: "var(--ink-500, #64748b)", fontSize: 13, marginLeft: 5 }}>
                              ({(product.ortalamaPuan ?? 0).toFixed(1)})
                            </span>
                          </span>
                        )}

                        <div style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: product.indirimli_fiyat ? "var(--price-discount, #ef4444)" : "var(--success, #16a34a)",
                          marginBottom: 4
                        }}>
                          {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                            <>
                              <span style={{ textDecoration: "line-through", color: "var(--ink-300, #d1d5db)", fontWeight: 500, marginRight: 7 }}>
                                {product.price} ₺
                              </span>
                              <span style={{ color: "var(--price-discount, #ef4444)", fontWeight: 700 }}>
                                {product.indirimli_fiyat} ₺
                              </span>
                            </>
                          ) : (`${product.price} ₺`)}
                        </div>

                        <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                          {getRemainingTime(product.doped_expiration)}
                        </div>
                        <span style={{ fontSize: 14, color: '#a16207' }}>
                          {findKategoriAd(product.kategori_id)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {populerIlanlar.length > 0 && (
                <section className="section-block" style={{ margin: '0 0 32px', padding:'0 12px' }}>
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1d8cf8', marginBottom: 12, letterSpacing: ".2px" }}>
                    ⭐ EN POPÜLER ÜRÜNLER
                  </h2>
                  <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 7 }}>
                    {populerIlanlar.map((product, idx) => (
                      <div key={idx}
                        style={{
                          minWidth: 200,
                          maxWidth: 220,
                          background: "var(--surface-200, #f1f5f9)",
                          borderRadius: 13,
                          boxShadow: "0 2px 13px #1d8cf80b",
                          border: "1.5px solid var(--border, #e4e9ef)",
                          marginRight: 5,
                          cursor: "pointer",
                          padding: "13px 9px",
                          position: "relative"
                        }}
                        onClick={() => goToProduct(product.id,'populer')}
                      >
                        <img src={Array.isArray(product.resim_url) ? product.resim_url[0] || "/placeholder.jpg" : product.resim_url || "/placeholder.jpg"}
                          alt={product.title}
                          style={{
                            width: "100%",
                            height: 92,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid var(--border-soft, #e0e7ef)"
                          }} />
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-900, #223555)", marginTop: 5 }}>{product.title}</div>
                        <div style={{ color: "var(--warning, #f59e0b)", fontWeight: 600, fontSize: 18 }}>
                          {renderStars(product.ortalamaPuan ?? 0)}
                          <span style={{ fontWeight: 500, fontSize: 14, color: "var(--ink-500, #64748b)", marginLeft: 5 }}>
                            ({(product.ortalamaPuan ?? 0).toFixed(1)})
                          </span>
                        </div>
                        <div style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "var(--price-discount, #ef4444)" : "var(--success, #16a34a)",
                          marginBottom: 4
                        }}>
                          {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                            <>
                              <span style={{ textDecoration: "line-through", color: "var(--ink-300, #d1d5db)", fontWeight: 500, marginRight: 7 }}>
                                {product.price} ₺
                              </span>
                              <span style={{ color: "var(--price-discount, #ef4444)", fontWeight: 700 }}>
                                {product.indirimli_fiyat} ₺
                              </span>
                            </>
                          ) : (`${product.price} ₺`)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* POPÜLER & FIRSAT ÜRÜNLERİ */}
              <section className="section-block" style={{ margin: '0 0 32px', padding:'0 12px' }}>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: 'var(--danger, #e11d48)',
                  marginBottom: 8,
                  letterSpacing: ".2px",
                  display: "flex",
                  alignItems: "center",
                  gap: 11
                }}>
                  <span style={{fontSize: 28, marginTop: -4}}>🔥</span>
                  Ayın İndirimleri Başladı!
                  <span style={{
                    background: "var(--success-500, #22c55e)",
                    color: "#fff",
                    borderRadius: 7,
                    fontSize: 14,
                    padding: "2px 12px",
                    marginLeft: 8,
                    fontWeight: 700
                  }}>
                    Haftanın Fırsatları
                  </span>
                </h2>
                <p style={{ fontWeight: 600, fontSize: 15.5, color: '#444', marginBottom: 12, marginLeft: 3 }}>
                  Sezonun en popüler ve indirimli ürünleri burada! Acele et, stoklar sınırlı.
                </p>
                <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 7 }}>
                  {indirimliUrunler.slice(0, 6).map((p, idx) => (
                    <div className="product-card discount" key={idx}
                      style={{
                        minWidth: 200,
                        maxWidth: 220,
                        background: "#fff6",
                        borderRadius: 13,
                        boxShadow: "0 2px 13px #f871710b",
                        border: "1.5px solid var(--border, #e4e9ef)",
                        marginRight: 5,
                        cursor: "pointer",
                        padding: "13px 9px",
                        position: "relative"
                      }}
                      onClick={() => goToProduct(p.id,'populer')}
                    >
                      {p.indirimli_fiyat &&
                        <span style={{
                          position: "absolute", top: 11, left: 11,
                          background: "var(--price-discount, #ef4444)", color: "#fff",
                          fontWeight: 800, fontSize: 12, borderRadius: 7, padding: "2px 10px", boxShadow: "0 1px 5px #ef44441a"
                        }}>İNDİRİMDE</span>}
                      {idx < 3 &&
                        <span style={{
                          position: "absolute", top: 11, right: 11,
                          background: "var(--warning, #f59e0b)", color: "#fff", fontWeight: 800,
                          fontSize: 12, borderRadius: 7, padding: "2px 10px"
                        }}>Çok Satan</span>}
                      <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                        alt={p.title}
                        style={{
                          width: "100%",
                          height: 92,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid var(--yellow-300, #fde68a)"
                        }} />
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--danger, #e11d48)", marginTop: 5 }}>{p.title}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--success-500, #22c55e)" }}>
                        {p.indirimli_fiyat ? (
                          <>
                            <span style={{ textDecoration: "line-through", color: "var(--ink-300, #d1d5db)", fontWeight: 600, marginRight: 4 }}>
                              {p.price}₺
                            </span>
                            <span style={{ color: "var(--price-discount, #ef4444)" }}>{p.indirimli_fiyat}₺</span>
                          </>
                        ) : (`${p.price}₺`)}
                      </div>
                      {p.stok && p.stok < 5 &&
                        <div style={{ color: "var(--danger, #e11d48)", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                          Son {p.stok} ürün!
                        </div>}
                    </div>
                  ))}
                </div>
              </section>

              {/* STANDART İLANLAR */}
              <section className="section-block" style={{ padding:'0 12px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                  <h2 style={{ fontSize: 23, fontWeight: 800, color: 'var(--ink-900, #223555)', marginBottom: 10 }}>
                    {aktifKategori.ad === 'Tümü' ? 'Tüm İlanlar' : `${aktifKategori.ad} İlanları`}
                  </h2>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <label style={{ fontSize:13, color:'#64748b', fontWeight:700 }}>Sırala:</label>
                    <select
                      value={sortKey}
                      onChange={(e)=> setSortKey(e.target.value as any)}
                      style={{ padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontWeight:700 }}
                    >
                      <option value="relevance">Alaka</option>
                      <option value="priceAsc">Fiyat Artan</option>
                      <option value="priceDesc">Fiyat Azalan</option>
                      <option value="rating">Puan</option>
                      <option value="newest">En Yeni</option>
                      <option value="viewsDesc">Görüntülenme</option>
                    </select>
                  </div>
                </div>

                {/* Hızlı filtreler */}
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', margin:'6px 0 14px' }}>
                  <button onClick={()=> setOnlyDiscounted(v=>!v)}
                    style={{
                      padding:'8px 12px', borderRadius:999, border:'1px solid #e2e8f0',
                      background: onlyDiscounted ? '#fde68a' : '#fff', fontWeight:800, fontSize:13, cursor:'pointer'
                    }}>İndirimli</button>

                  <button onClick={()=> setOnlyInStock(v=>!v)}
                    style={{
                      padding:'8px 12px', borderRadius:999, border:'1px solid #e2e8f0',
                      background: onlyInStock ? '#dcfce7' : '#fff', fontWeight:800, fontSize:13, cursor:'pointer'
                    }}>Stokta</button>

                  <button onClick={()=> setOnlyNew(v=>!v)}
                    style={{
                      padding:'8px 12px', borderRadius:999, border:'1px solid #e2e8f0',
                      background: onlyNew ? '#e0e7ff' : '#fff', fontWeight:800, fontSize:13, cursor:'pointer'
                    }}>Yeni</button>

                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <input value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="Min ₺"
                      style={{ width:90, padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:8 }} />
                    <span style={{ color:'#94a3b8' }}>–</span>
                    <input value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Max ₺"
                      style={{ width:90, padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:8 }} />
                  </div>

                  {(onlyDiscounted || onlyInStock || onlyNew || minPrice || maxPrice || debouncedSearch) && (
                    <button
                      onClick={()=>{
                        setOnlyDiscounted(false); setOnlyInStock(false); setOnlyNew(false);
                        setMinPrice(''); setMaxPrice(''); setSearch(''); setVisibleCount(12);
                      }}
                      style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}
                    >
                      Temizle
                    </button>
                  )}
                </div>

                {normalIlanlar.length === 0 ? (
                  <div style={{
                    background: 'var(--surface, #f8fafc)',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: 'var(--ink-500, #64748b)',
                    fontWeight: 500,
                    fontSize: 16
                  }}>
                    {aktifKategori.ad === 'Tümü'
                      ? 'Sonuç bulunamadı. Filtreleri gevşetmeyi deneyin.'
                      : `${aktifKategori.ad} kategorisinde uygun sonuç yok.`}
                  </div>
                ) : (
                  <>
                    <div className="ilanGrid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
                        gap: 23
                      }}>
                      {normalIlanlar.map((product) => {
                        const sepette = sepetteVarMi(product.id);
                        return (
                          <div
                            key={product.id}
                            style={{
                              background: '#fff',
                              borderRadius: 15,
                              padding: 15,
                              boxShadow: '0 3px 16px #16a34a24',
                              transition: 'transform 0.16s',
                              cursor: 'pointer',
                              position: 'relative',
                              border: "1.5px solid var(--border, #e4e9ef)"
                            }}
                            onClick={() => goToProduct(product.id,'index2')}
                            onMouseOver={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)"}
                            onMouseOut={e => (e.currentTarget as HTMLElement).style.transform = "none"}
                          >
                            {isYeni(product.created_at) && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 13, left: 13,
                                  background: 'var(--success, #16a34a)',
                                  color: '#fff',
                                  fontWeight: 800,
                                  fontSize: 13,
                                  borderRadius: 8,
                                  padding: '4px 13px',
                                  boxShadow: '0 2px 8px #16a34a33',
                                  zIndex: 1
                                }}>
                                Yeni
                              </span>
                            )}
                            <span
                              onClick={e => { e.stopPropagation(); toggleFavori(product.id); }}
                              title={favoriler.includes(product.id) ? "Favorilerden çıkar" : "Favorilere ekle"}
                              style={{
                                position: 'absolute',
                                top: 12, right: 14,
                                fontSize: 22,
                                color: favoriler.includes(product.id) ? "var(--attention, #fb8500)" : "#bbb",
                                cursor: 'pointer',
                                userSelect: 'none',
                                zIndex: 2,
                                transition: 'color 0.2s'
                              }}>
                              {favoriler.includes(product.id) ? "❤️" : "🤍"}
                            </span>
                            <img
                              src={Array.isArray(product.resim_url) ? product.resim_url[0] || '/placeholder.jpg' : product.resim_url || '/placeholder.jpg'}
                              alt={product.title}
                              style={{
                                width: '100%',
                                height: 155,
                                objectFit: 'cover',
                                borderRadius: 10,
                                marginBottom: 12,
                                background: '#f0fdf4',
                                border: "1px solid var(--border, #e4e9ef)"
                              }}
                            />
                            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-800, #1e293b)', marginBottom: 6 }}>
                              {product.title}
                            </h3>
                            <FirmaBilgiSatiri
                              email={product.user_email}
                              firmaAdMap={firmaAdMap}
                              onYorumClick={() => window.location.href = `/firma-yorumlar/${product.user_email}`}
                            />
                            <div style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "var(--price-discount, #ef4444)" : "var(--success, #16a34a)",
                              marginBottom: 4
                            }}>
                              {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                                <>
                                  <span style={{ textDecoration: "line-through", color: "var(--ink-300, #d1d5db)", fontWeight: 500, marginRight: 7 }}>
                                    {product.price} ₺
                                  </span>
                                  <span style={{ color: "var(--price-discount, #ef4444)", fontWeight: 700 }}>
                                    {product.indirimli_fiyat} ₺
                                  </span>
                                </>
                              ) : (`${product.price} ₺`)}
                            </div>
                            <span style={{ fontSize: 14, color: 'var(--ink-500, #64748b)' }}>
                              {findKategoriAd(product.kategori_id)}
                            </span>

                            {!sepette ? (
                              <button
                                style={{
                                  marginTop: 13,
                                  background: 'linear-gradient(90deg, var(--accent, #16a34a) 0%, #22c55e 90%)',
                                  color: '#fff',
                                  padding: '10px 0',
                                  borderRadius: 10,
                                  border: 'none',
                                  fontWeight: 700,
                                  fontSize: 15,
                                  cursor: 'pointer',
                                  width: '100%',
                                  boxShadow: '0 2px 8px #10b98122',
                                  letterSpacing: 0.5,
                                  transition: 'background 0.18s'
                                }}
                                onClick={async e => { e.stopPropagation(); await sepeteEkle(product); }}
                              >
                                🛒 Sepete Ekle
                              </button>
                            ) : (
                              <button
                                style={{
                                  marginTop: 13,
                                  background: 'linear-gradient(90deg, var(--attention, #fb8500) 0%, var(--attention-300, #ffbc38) 80%)',
                                  color: '#fff',
                                  padding: '10px 0',
                                  borderRadius: 10,
                                  border: 'none',
                                  fontWeight: 700,
                                  fontSize: 15,
                                  cursor: 'pointer',
                                  width: '100%',
                                  boxShadow: '0 2px 8px #fb850022',
                                  letterSpacing: 0.5,
                                  transition: 'background 0.18s'
                                }}
                                onClick={e => { e.stopPropagation(); sepeteGit(); }}
                              >
                                Sepete Git
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Daha Fazla Yükle */}
                    {normalIlanlar.length < totalAfterFilters && (
                      <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}>
                        <button
                          onClick={()=> setVisibleCount(c=> c + 12)}
                          style={{
                            background:'#fff', border:'1px solid #e2e8f0', borderRadius:10,
                            padding:'10px 16px', fontWeight:800, cursor:'pointer'
                          }}
                        >
                          Daha Fazla Yükle ({totalAfterFilters - normalIlanlar.length} kaldı)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* TOP MAĞAZALAR */}
              {topMagazalar.length > 0 && (
                <section className="section-block" style={{ marginTop:24, padding:'0 12px' }}>
                  <h2 style={{ fontSize:22, fontWeight:900, color:'#0f172a', marginBottom:12 }}>🏆 Top Mağazalar</h2>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:12 }}>
                    {topMagazalar.map(m=>(
                      <div key={m.email}
                        onClick={()=> window.location.href=`/firma-yorumlar/${m.email}`}
                        style={{ cursor:'pointer', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:12, display:'flex', gap:10, alignItems:'center' }}>
                        <div style={{
                          width:44, height:44, borderRadius:12, background:'#eef2ff', display:'grid', placeItems:'center',
                          fontWeight:900, color:'#334155'
                        }}>
                          {m.ad?.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:800, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.ad}</div>
                          <div style={{ fontSize:12, color:'#6b7280' }}>{m.urun} ürün</div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, color:'#f59e0b', fontSize:14 }}>
                            <FiStar /> {m.puan.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ÇOK GÖRÜNTÜLENENLER */}
              {cokGoruntulenenler.length > 0 && (
                <section className="section-block" style={{ marginTop:24, padding:'0 12px' }}>
                  <h2 style={{ fontSize:22, fontWeight:900, color:'#0f172a', marginBottom:12 }}>👀 Çok Görüntülenenler</h2>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:12 }}>
                    {cokGoruntulenenler.map(p=>(
                      <div key={p.id}
                        onClick={()=> goToProduct(p.id,'most_viewed')}
                        style={{ cursor:'pointer', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:10 }}>
                        <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                          alt={p.title}
                          style={{ width:'100%', height:110, objectFit:'cover', borderRadius:8, border:'1px solid #eef2f7' }} />
                        <div style={{ fontWeight:800, marginTop:6, fontSize:14 }}>{p.title}</div>
                        <div style={{ color:'#64748b', fontSize:12 }}>{findKategoriAd(p.kategori_id)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* SON BAKTIKLARIN */}
              {recentlyViewed.length > 0 && (
                <section className="section-block" style={{ marginTop:24, padding:'0 12px' }}>
                  <h2 style={{ fontSize:22, fontWeight:900, color:'#0f172a', marginBottom:12 }}>🕒 Son Baktıkların</h2>
                  <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:6 }}>
                    {recentlyViewed.map(p=>(
                      <div key={p.id}
                        onClick={()=> goToProduct(p.id,'recent')}
                        style={{ minWidth:200, border:'1px solid #e5e7eb', background:'#fff', borderRadius:12, padding:10, cursor:'pointer' }}>
                        <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                          alt={p.title}
                          style={{ width:'100%', height:90, objectFit:'cover', borderRadius:8 }} />
                        <div style={{ fontWeight:800, fontSize:14, marginTop:6 }}>{p.title}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </main>
          </div>

          {/* Global Styles */}
          <style jsx global>{`.section-block {
  width: 100vw !important;
  margin-left: calc(-50vw + 50%); /* container kırpıyorsa tam ekrana zorlar */
}

.category-chips,
.trending-terms {
  width: 100vw !important;
  margin-left: calc(-50vw + 50%);
  padding: 0 10px;
}

          .hero-slide {
  position: relative;
  min-height: 180px;
  max-height: 420px;
  background: linear-gradient(135deg,#e0f2fe,#e9d5ff);
  border: 1px solid #e5e7eb;
  border-radius: 0;
  overflow: hidden;
  scroll-snap-align: start;
}

.hero-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: .9;
}

.hero-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.hero-title {
  font-weight: 900;
  font-size: 28px;
  color: #0f172a;
}
.hero-sub {
  font-weight: 700;
  font-size: 16px;
  color: #334155;
  margin-top: 6px;
}
.hero-btn {
  margin-top: 12px;
  background: var(--ink-900, #111827);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 800;
  cursor: pointer;
}

/* Tablet */
@media (max-width: 768px) {
  .hero-slide { min-height: 160px; max-height: 260px; }
  .hero-title { font-size: 22px; }
  .hero-sub { font-size: 14px; }
}

/* Telefon */
@media (max-width: 480px) {
  .hero-slide { min-height: 140px; max-height: 200px; }
  .hero-title { font-size: 18px; }
  .hero-sub { font-size: 13px; }
}

:root{
  --primary: #2563eb;
  --primary-400: #3479e3;
  --accent:  #16a34a;
  --danger:  #e11d48;
  --success: #16a34a;
  --warning: #f59e0b;
  --ink-900: #0f172a;
  --border:  #e5e7eb;
  --bg-grad-end: #eafcf6;
  --dropdown-active: #eef6fd;
  --dropdown-hover: #f5faff;
}

/* Hero kaydırıcı: scrollbar kapalı */
.hero-scroll{ scrollbar-width: none; -ms-overflow-style: none; }
.hero-scroll::-webkit-scrollbar{ display: none; }

.hero-dots{
  display:flex; gap:6px; justify-content:center; margin:8px 0 0;
  position: relative;
}
.hero-dots button{
  width:8px; height:8px; border-radius:999px; border:0; background:#e5e7eb; transition: transform .15s, background .15s;
}
.hero-dots button.active{ background: var(--primary); transform: scale(1.6); }
.hero-dots::before{
  content:"";
  position:absolute;
  left:50%; transform:translateX(-50%);
  bottom:-6px;
  width:160px; height:4px; border-radius:999px;
  background: linear-gradient(90deg,#06b6d4,#22c55e,#a3e635);
  opacity:.25;
}

/* PWA / çentik güvenli alanları */
body { padding-bottom: env(safe-area-inset-bottom); }
.pwa-header{
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
  min-height: calc(70px + env(safe-area-inset-top));
}

/* Tablet ve aşağısı */
@media (max-width: 1024px) {
  .layout-3col { flex-direction: column !important; gap: 12px !important; padding: 0 !important; width: 100% !important; }
  .ads-left, .ads-right { display: none !important; }
  .ilanGrid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
  header input[type="text"] { width: 100% !important; max-width: none !important; }
}

/* Telefon */
@media (max-width: 640px) {
  .header-inner{ grid-template-columns: 1fr !important; min-height: 56px !important; padding: 0 12px !important; }
  .header-left{ display:none !important; }
  .header-middle{ width:100% !important; gap:8px !important; }
  .header-middle input[type="text"], .searchBar{ width:100% !important; height:40px !important; }
  .header-actions{ gap:8px !important; }
  .header-actions button{ padding:6px 10px !important; font-size:13px !important; }
  .ilanGrid { grid-template-columns: 1fr !important; }
}

/* Genel güvenlik bandı */
html, body { max-width: 100vw; overflow-x: hidden; }
img, video { max-width: 100%; height: auto; display: block; }

/* ANDROID iyileştirmeleri */
.is-android .ads-left, .is-android .ads-right{ display: none !important; }
.is-android .layout-3col{ display: block !important; }
.is-android .main-col{ width: 100% !important; max-width: none !important; padding: 0 !important; }
.is-android .main-col > .section-block{ margin: 0 0 18px !important; border-radius: 0 !important; padding: 16px 12px !important; }
.is-android .ilanGrid{ display: grid !important; grid-template-columns: repeat(2, minmax(0,1fr)) !important; gap: 10px !important; }
@media (max-width: 480px){
  .is-android .ilanGrid{ grid-template-columns: 1fr !important; }
}
          `}</style>
        </div>
      </div>
    </>
  );
};

export default Index2;
