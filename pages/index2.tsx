/* Add to globals.css for compact featured grid on phones:
@media (max-width: 640px){
  .featuredGrid{ grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 12px !important; }
  .featuredGrid .product-card{ padding: 10px !important; }
  .featuredGrid img{ height: 90px !important; }
  .featuredGrid h3{ font-size: 14px !important; }
}
*/

import type { NextPage } from 'next';
import React, { useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';
import SloganBar from "../components/SloganBar";
import { FiChevronDown } from 'react-icons/fi'
import { useRouter } from 'next/router'

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
} from 'react-icons/fi';
import { FaCar } from 'react-icons/fa';

// Firma bilgisi tipi
type FirmaInfo = { ad: string; puan: number; };

// Ürün tipi
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

type Kategori = { id: number; ad: string; };
type CartItem = { id: number; adet: number; product_id: number; };

// Türkçe karakter normalize
const trMap: Record<string,string> = { 'İ':'i','I':'ı','Ş':'ş','Ğ':'ğ','Ü':'ü','Ö':'ö','Ç':'ç' };
const trLower = (s:string) => s.replace(/[İIŞĞÜÖÇ]/g, ch => trMap[ch] ?? ch).toLowerCase();
const stripDiacritics = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeText = (s:string) => stripDiacritics(trLower(s || ''));

// Fiyat parse
const parsePrice = (p?: string) => {
  if (!p) return 0;
  const cleaned = String(p).replace(/\s/g,'').replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,'');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

// Yeni ürün kontrolü
function isYeni(created_at?: string) {
  if (!created_at) return false;
  const ilanTarihi = new Date(created_at).getTime();
  const simdi = Date.now();
  return simdi - ilanTarihi < 86400000;
}
// Ortalama puan hesaplama (tek sorgu)
async function ilanlaraOrtalamaPuanEkle(ilanlar: Ilan[]) {
  if (!ilanlar?.length) return ilanlar;
  const ids = ilanlar.map(i => i.id);
  const { data: rows, error } = await supabase
    .from("yorumlar")
    .select("urun_id, puan")
    .in("urun_id", ids);

  if (error) {
    console.error("yorumlar toplu çekme hatası:", error);
    return ilanlar.map(i => ({ ...i, ortalamaPuan: 0 }));
  }

  const sum: Record<number, number> = {};
  const cnt: Record<number, number> = {};
  for (const r of rows || []) {
    const id = Number((r as any).urun_id);
    const p = Number((r as any).puan) || 0;
    sum[id] = (sum[id] ?? 0) + p;
    cnt[id] = (cnt[id] ?? 0) + 1;
  }
  return ilanlar.map(i => ({
    ...i,
    ortalamaPuan: cnt[i.id] ? sum[i.id] / cnt[i.id] : 0
  }));
}

// Yıldız render
function renderStars(rating: number, max = 5) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = max - full - half;
  return (
    <>
      {Array(full).fill(0).map((_, i) => <span key={"f"+i} style={{ color: "#14b8a6", fontSize: 15 }}>★</span>)}
      {half ? <span key="h" style={{ color: "#14b8a6", fontSize: 15 }}>☆</span> : null}
      {Array(empty).fill(0).map((_, i) => <span key={"e"+i} style={{ color: "#d1d5db", fontSize: 15 }}>★</span>)}
    </>
  );
}

// Firma bilgi satırı
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
      display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 8
    }}>
      <span style={{ fontWeight: 600, fontSize: 15, color: "#0ea5e9", marginRight: 3 }}>
        {info.ad}
      </span>
      <span>
        {renderStars(info.puan)}
        <span style={{ color: "#64748b", fontSize: 13, marginLeft: 5 }}>
          ({info.puan.toFixed(1)})
        </span>
      </span>
      <button
        onClick={onYorumClick}
        style={{
          background: "#f3f4f6",
          border: "1.5px solid #dbeafe",
          color: "#223555",
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
const Index2: NextPage = () => {
  const [loginDropdown, setLoginDropdown] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
  const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const router = useRouter()
  const { kategori } = router.query as { kategori?: string };
  const [aktifKategori, setAktifKategori] = useState<{ ad: string; id?: number | null }>({ ad: 'Tümü', id: undefined });
  const [favoriler, setFavoriler] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);

  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [onlyInStock, setOnlyInStock]     = useState(false);
  const [onlyNew, setOnlyNew]             = useState(false);
  const [minPrice, setMinPrice]           = useState<string>('');
  const [maxPrice, setMaxPrice]           = useState<string>('');
  const [sortKey, setSortKey] = useState<'relevance'|'priceAsc'|'priceDesc'|'rating'|'newest'|'viewsDesc'>('relevance');
  const [visibleCount, setVisibleCount]   = useState(12);

  // Oturum bilgisi
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const usr = data?.session?.user ?? null;
      setUser(usr);
      setIsLoggedIn(!!usr);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const usr = session?.user ?? null;
      setUser(usr); setIsLoggedIn(!!usr);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // Hero autoplay ayarları
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPause, setHeroPause] = useState(false);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAutoScrolling = useRef(false);
  const scrollEndTimer = useRef<number | null>(null);

  const scrollHero = (idx: number) => {
    const el = heroRef.current;
    if (!el) return;
    const target = el.children[idx] as HTMLElement | undefined;
    const left = target ? target.offsetLeft : idx * el.clientWidth;
    isAutoScrolling.current = true;
    el.scrollTo({ left, behavior: 'smooth' });
    if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(() => { isAutoScrolling.current = false; }, 450) as unknown as number;
  };

  useEffect(() => {
    if (heroTimer.current) clearInterval(heroTimer.current);
    if (!heroPause) {
      heroTimer.current = setInterval(() => {
        setHeroIndex(i => {
          const next = (i + 1) % Math.max(1, heroSlides.length);
          requestAnimationFrame(() => scrollHero(next));
          return next;
        });
      }, 3500);
    }
    return () => { if (heroTimer.current) clearInterval(heroTimer.current); };
  }, [heroPause, heroSlides.length]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isAutoScrolling.current) return;
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
  // Android kontrolü
  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsAndroid(/Android/i.test(navigator.userAgent));
  }, []);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      document.documentElement.classList.add('is-android');
      return () => { document.documentElement.classList.remove('is-android'); };
    }
  }, []);

  // Debounce arama
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Firma adlarını çek
  useEffect(() => {
    async function fetchFirmaAdlari() {
      const { data: firmalar } = await supabase.from("satici_firmalar").select("email, firma_adi, puan");
      const map: Record<string, FirmaInfo> = {};
      firmalar?.forEach((f: any) => {
        if (f.email && f.firma_adi) map[f.email] = { ad: f.firma_adi, puan: f.puan ?? 0 };
      });
      setFirmaAdMap(map);
    }
    fetchFirmaAdlari();
  }, []);

  // Kategori query param
  useEffect(() => {
    if (kategori) {
      const kat = dbKategoriler.find(k => String(k.id) === kategori);
      if (kat) {
        setAktifKategori({ ad: kat.ad, id: kat.id });
        setTimeout(scrollToProducts, 50); 
      }
    }
  }, [kategori, dbKategoriler]);

  // Scroll to ürünler
  const scrollToProducts = () => {
    const el = document.getElementById('urunler');
    if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Header yüksekliği
  useEffect(() => {
    const header = document.querySelector('.pwa-header') as HTMLElement | null;
    const setH = () => {
      const h = header?.offsetHeight || 80;
      document.documentElement.style.setProperty('--header-h', `${h}px`);
    };
    setH();
    window.addEventListener('resize', setH);
    return () => window.removeEventListener('resize', setH);
  }, []);

  // İlk yükleme
  useEffect(() => {
    let alive = true;
    async function loadAll() {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const [katRes, ilanRes, dopedRes] = await Promise.allSettled([
        supabase.from('kategori').select('*'),
        supabase.from('ilan').select(`
          id, title, desc, price, kategori_id, resim_url, stok,
          created_at, doped, doped_expiration, indirimli_fiyat,
          views, user_email, ozellikler
        `),
        supabase.from('ilan')
          .select('*')
          .eq('doped', true)
          .gt('doped_expiration', nowIso)
          .order('doped_expiration', { ascending: false }),
      ]);

      if (!alive) return;
      if (katRes.status === "fulfilled") setDbKategoriler(katRes.value.data || []);
      if (ilanRes.status === "fulfilled") {
        const base = ilanRes.value.data || [];
        const withAvg = await ilanlaraOrtalamaPuanEkle(base);
        if (!alive) return;
        setIlanlar(withAvg);
        const populer = withAvg.filter(i => (i.ortalamaPuan ?? 0) > 0)
          .sort((a,b)=> (b.ortalamaPuan ?? 0) - (a.ortalamaPuan ?? 0))
          .slice(0,6);
        setPopulerIlanlar(populer);
      }
      if (dopedRes.status === "fulfilled") setDopedIlanlar(dopedRes.value.data || []);
      setTimeout(() => alive && setLoading(false), 300);
    }
    loadAll();
    return () => { alive = false; };
  }, []);
  // Hero slides
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("hero_slides")
        .select("*")
        .eq("aktif", true)
        .order("id", { ascending: true });
      if (!alive) return;
      if (error) console.error(error);
      setHeroSlides(data || []);
    })();
    return () => { alive = false; };
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

  // Sepette kontrol
  const sepetteVarMi = (id: number) => cartItems.find((item) => item.product_id === id);

  // Sepete ekle
  const sepeteEkle = async (urun: Ilan) => {
    const defaultOzellikler: Record<string, string> = {};
    if (isLoggedIn && user) {
      const sepette = sepetteVarMi(urun.id);
      if (sepette) {
        await supabase.from("cart").update({ adet: sepette.adet + 1 }).eq("id", sepette.id);
      } else {
        await supabase.from("cart").insert([{ user_id: user.id, product_id: urun.id, adet: 1, ozellikler: defaultOzellikler }]);
      }
      const { data: cartData } = await supabase.from("cart").select("id, adet, product_id, ozellikler").eq("user_id", user.id);
      setCartItems(cartData || []);
    } else {
      let guestCart: any[] = [];
      try { guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]"); } catch {}
      const existing = guestCart.find(item => item.product_id === urun.id);
      if (existing) existing.adet += 1;
      else guestCart.push({ product_id: urun.id, adet: 1, ozellikler: defaultOzellikler, product: urun });
      localStorage.setItem("guestCart", JSON.stringify(guestCart));
      setCartItems(guestCart.map(g => ({ ...g, product: g.product })));
    }
  };

  // Sepete git
  const sepeteGit = () => { window.location.href = '/sepet2'; };

  // Favoriler
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

  // Ürün detay yönlendirme
  const goToProduct = (id: number, from: string) => {
    try {
      const raw = localStorage.getItem('recently_viewed');
      const arr: number[] = raw ? JSON.parse(raw) : [];
      const updated = [id, ...arr.filter(x => x !== id)].slice(0, 20);
      localStorage.setItem('recently_viewed', JSON.stringify(updated));
    } catch {}
    router.push(`/urun/${id}?from=${from}`);
  };

  // Sıralama için relevance
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

  // Normal ilanlar, filtreler ve öneriler
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

  // Gece yarısına geri sayım
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(23,59,59,999);
  const left = Math.max(0, midnight.getTime() - now.getTime());
  const HH = Math.floor(left/3600000).toString().padStart(2,'0');
  const MM = Math.floor((left%3600000)/60000).toString().padStart(2,'0');
  const SS = Math.floor((left%60000)/1000).toString().padStart(2,'0');

  return (
    <>
      <Head>
        <title>80bir </title>
        <meta name="description" content="80bir -En iyi fırsatlar burada" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* === SAYFA WRAP === */}
      <div className="force-desktop">
        <div style={{
          minHeight: '100vh',
          background: 'var(--page-bg, linear-gradient(120deg, var(--surface, #f8fafc) 0%, var(--bg-grad-end, #e0f7fa) 100%))',
        }}>
          {/* HEADER */}
          <header className="pwa-header"
            style={{
              background: 'linear-gradient(90deg, #0ea5e9, #10b981)',
              boxShadow: '0 2px 14px #0ea5e90a',
              position: 'sticky',
              top: 0,
              zIndex: 1000,
              borderBottom: '1.5px solid var(--border, #dbeafe)',
              padding: 0,
              width: '100%'
            }}>
           <div className="header-inner">
              {/* Logo */}
              <div className="header-left" style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Image src="/logo.png" alt="80bir Logo" width={110} height={52} />
              </div>

              {/* Kategoriler + Arama */}
              <div className="header-middle" style={{ display:'flex', alignItems:'center', gap:10, width:'100%', position:'relative' }}>
                {/* Kategori Dropdown */}
                {/* ... kategori butonu ve arama inputu burada ... */}
              </div>

              {/* Sağ taraf: Sepet + Auth */}
              <div className="header-actions" style={{ display:'flex', alignItems:'center', gap:10 }}>
                {/* ... sepet ve login/register butonları ... */}
              </div>
            </div>
          </header>

          <SloganBar />

          {/* === Hero Slider, Avantaj Bar, Trend Aramalar vs === */}
          {/* ... yukarıdaki mantıkla render edilen bölümler ... */}

          {/* === Ana İçerik === */}
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
              {/* Flash Deals, Öne Çıkanlar, Popüler Ürünler, İndirimler, Sticky CatBar, Standart İlanlar, Çok Görüntülenenler, Son Baktıkların */}
              {/* ... tam JSX kodu (senin ilk paylaştığın gibi) burada devam ediyor ... */}
            </main>
          </div>

          {/* === Global Styles === */}
          <style jsx global>{`
            :root{
              --primary: #0ea5e9;
              --primary-400: #38bdf8;
              --accent:  #10b981;
              --success: #10b981;
              --warning: #14b8a6;
              --price-discount: #0ea5e9;
              --ink-900: #0f172a;
              --bg-grad-end: #e0f7fa;
              --dropdown-active: #e0f2fe;
              --dropdown-hover: #f0f9ff;
              --border:  #dbeafe;
              --surface: #f8fafc;
              --highlight: #e0f2fe;
              --highlight-border: #bae6fd;
              --highlight-img-border: #bfdbfe;
            }
            /* ... responsive ve grid CSS'ler ... */
          `}</style>
        </div>
      </div>
    </>
  );
};

export default Index2;
