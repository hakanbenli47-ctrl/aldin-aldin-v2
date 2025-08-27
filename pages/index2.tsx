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
        color: "#1d8cf8",
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
  FiMoreHorizontal
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
  user_email: string;  // <-- BURAYA EKLE!
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
  // "12.345,67" -> 12345.67
  const cleaned = String(p).replace(/\s/g,'').replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,'');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

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
  const [debouncedSearch, setDebouncedSearch] = useState('');          // NEW
  const [showSuggestions, setShowSuggestions] = useState(false);       // NEW
  const [loading, setLoading] = useState(true);
  const [dopedIlanlar, setDopedIlanlar] = useState<Ilan[]>([]);
  const router = useRouter()
  const { kategori } = router.query
  const [aktifKategori, setAktifKategori] = useState<{ ad: string; id?: number | null }>({
    ad: 'Tümü',
    id: undefined
  });
  const [favoriler, setFavoriler] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  // ANDROID tespiti
  const [isAndroid, setIsAndroid] = useState(false);

  // Hızlı filtreler + sıralama + görünür sayısı (lazy pagination)
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);         // NEW
  const [onlyInStock, setOnlyInStock]     = useState(false);           // NEW
  const [onlyNew, setOnlyNew]             = useState(false);           // NEW
  const [minPrice, setMinPrice]           = useState<string>('');      // NEW
  const [maxPrice, setMaxPrice]           = useState<string>('');      // NEW
  const [sortKey, setSortKey] = useState<'relevance'|'priceAsc'|'priceDesc'|'rating'|'newest'|'viewsDesc'>('relevance'); // NEW
  const [visibleCount, setVisibleCount]   = useState(12);              // NEW

  // === MEGA KAMPANYA autoplay slider ===
  const [kampanyaIndex, setKampanyaIndex] = useState(0);
  const [kampanyaPaused, setKampanyaPaused] = useState(false);
  const kampanyaTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsAndroid(/Android/i.test(navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      document.documentElement.classList.add('is-android');
      return () => {
        // sayfadan çıkarken temizle (diğer sayfaları etkilemesin)
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
      // Email, firma_adi ve puan çekiyoruz
      const { data: firmalar } = await supabase
        .from("satici_firmalar")
        .select("email, firma_adi, puan");

      // FirmaInfo tipinde map oluştur
      const map: Record<string, FirmaInfo> = {};

      firmalar?.forEach((f: any) => {
        if (f.email && f.firma_adi) {
          map[f.email] = {
            ad: f.firma_adi,
            puan: f.puan ?? 0,
          };
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
    async function fetchUserCartAndFavorites() {
      const { data: userData } = await supabase.auth.getUser();
      setIsLoggedIn(!!userData?.user);
      setUser(userData?.user || null);

      if (userData?.user) {
        const userId = userData.user.id;
        const { data: cartData } = await supabase
          .from("cart")
          .select("id, adet, product_id")
          .eq("user_id", userId);
        setCartItems(cartData || []);
        const { data: favData, error: favError } = await supabase
          .from("favoriler")
          .select("ilan_id")
          .eq("user_id", userId);
        if (!favError && favData) {
          setFavoriler(favData.map(f => f.ilan_id));
        }
      } else {
        setCartItems([]);
        setFavoriler([]);
      }
      setLoading(false);
    }
    fetchUserCartAndFavorites();
  }, []);

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

  const sepetteVarMi = (id: number) => cartItems.find((item) => item.product_id === id);
  // ✅ Özellikleri varsayılan olarak ayarla
  let defaultOzellikler: Record<string, string> = {};
  const sepeteEkle = async (urun: Ilan) => {
    if (!isLoggedIn || !user) {
      alert("Lütfen giriş yapınız!");
      window.location.href = "/giris";
      return;
    }

    // Varsayılan özellikler (boş obje)
    const defaultOzellikler: Record<string, string> = {};
    const sepette = sepetteVarMi(urun.id);

    if (sepette) {
      await supabase
        .from("cart")
        .update({ adet: sepette.adet + 1 })
        .eq("id", sepette.id);
    } else {
      await supabase
        .from("cart")
        .insert([{
          user_id: user.id,
          product_id: urun.id,
          adet: 1,
          ozellikler: defaultOzellikler
        }]);
    }

    const { data: cartData } = await supabase
      .from("cart")
      .select("id, adet, product_id, ozellikler")
      .eq("user_id", user.id);

    setCartItems(cartData || []);
  };

  const sepeteGit = () => {
    window.location.href = '/sepet2';
  };

  const toggleFavori = async (ilanId: number) => {
    if (!isLoggedIn || !user) {
      alert("Lütfen giriş yapınız!");
      window.location.href = "/giris";
      return;
    }
    if (favoriler.includes(ilanId)) {
      await supabase
        .from("favoriler")
        .delete()
        .eq("user_id", user.id)
        .eq("ilan_id", ilanId);
      setFavoriler(favoriler.filter(id => id !== ilanId));
    } else {
      await supabase
        .from("favoriler")
        .insert([{ user_id: user.id, ilan_id: ilanId }]);
      setFavoriler([...favoriler, ilanId]);
    }
  };

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

  /** === GELİŞMİŞ FİLTRELEME + SIRALAMA + ÖNERİ === */
  const aktifKategoriId = aktifKategori.id ?? null;

  // Alaka skoru (title>kategori>firma>desc)
  const relevanceScore = (p: Ilan, q: string) => {
    if (!q) return 0;
    const qn = normalizeText(q);
    const title = normalizeText(p.title);
    const desc  = normalizeText(p.desc);
    const katAd = normalizeText(findKategoriAd(p.kategori_id));
    const firma = normalizeText(firmaAdMap[p.user_email]?.ad || '');

    let score = 0;
    if (title.includes(qn)) score += 6;
    if (katAd.includes(qn)) score += 3;
    if (firma.includes(qn)) score += 2;
    if (desc.includes(qn))  score += 1;

    // Başta geçiyorsa bonus
    if (title.startsWith(qn)) score += 3;
    return score;
  };

  const {
    items: normalIlanlar,
    total: totalAfterFilters,
    suggestions
  } = useMemo(() => {
    const base = ilanlar.filter(i => {
      // kategori
      const kategoriOk = !aktifKategoriId || i.kategori_id === aktifKategoriId;

      // geniş arama alanı
      const q = normalizeText(debouncedSearch);
      if (!q) return kategoriOk;
      const title = normalizeText(i.title);
      const desc  = normalizeText(i.desc);
      const katAd = normalizeText(findKategoriAd(i.kategori_id));
      const firma = normalizeText(firmaAdMap[i.user_email]?.ad || '');

      const matches = title.includes(q) || desc.includes(q) || katAd.includes(q) || firma.includes(q);
      return kategoriOk && matches;
    });

    // hızlı filtreler
    const afterQuick = base.filter(p => {
      if (onlyDiscounted && !(p.indirimli_fiyat && p.indirimli_fiyat !== p.price)) return false;
      if (onlyInStock && !(p.stok && p.stok > 0)) return false;
      if (onlyNew && !isYeni(p.created_at)) return false;
      const minOk = minPrice ? parsePrice(p.indirimli_fiyat || p.price) >= parseFloat(minPrice) : true;
      const maxOk = maxPrice ? parsePrice(p.indirimli_fiyat || p.price) <= parseFloat(maxPrice) : true;
      return minOk && maxOk;
    });

    // sıralama
    const sorted = [...afterQuick].sort((a,b) => {
      switch (sortKey) {
        case 'priceAsc':
          return parsePrice(a.indirimli_fiyat || a.price) - parsePrice(b.indirimli_fiyat || b.price);
        case 'priceDesc':
          return parsePrice(b.indirimli_fiyat || b.price) - parsePrice(a.indirimli_fiyat || a.price);
        case 'rating':
          return (b.ortalamaPuan ?? 0) - (a.ortalamaPuan ?? 0);
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'viewsDesc':
          return (b.views ?? 0) - (a.views ?? 0);
        case 'relevance':
        default:
          return relevanceScore(b, debouncedSearch) - relevanceScore(a, debouncedSearch);
      }
    });

    const total = sorted.length;
    const sliced = sorted.slice(0, visibleCount);

    // ÖNERİLER (arama kutusu açılır listesi)
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
    sortKey, visibleCount
  ]);

  // İndirimli ürünleri belirle
  const indirimliUrunler = useMemo(
    () => ilanlar.filter(x => x.indirimli_fiyat && x.indirimli_fiyat !== x.price).slice(0, 12),
    [ilanlar]
  );

  // MEGA KAMPANYA slider listesi (indirimli ürünlerden beslenir; yoksa doped; o da yoksa ilanlar)
  const kampanyaSlides = useMemo(() => {
    const src = (indirimliUrunler.length ? indirimliUrunler
      : (dopedIlanlar.length ? dopedIlanlar : ilanlar)).slice(0, 8);
    return src;
  }, [indirimliUrunler, dopedIlanlar, ilanlar]);

  // Autoplay (pause on hover)
  useEffect(() => {
    if (!kampanyaSlides.length) return;
    if (kampanyaTimer.current) clearInterval(kampanyaTimer.current);
    if (!kampanyaPaused) {
      kampanyaTimer.current = setInterval(() => {
        setKampanyaIndex(i => (i + 1) % kampanyaSlides.length);
      }, 3500);
    }
    return () => { if (kampanyaTimer.current) clearInterval(kampanyaTimer.current); }
  }, [kampanyaSlides.length, kampanyaPaused]);

  // Görselliği mobile uygunlaştır
  if (loading) return <p style={{ textAlign: "center", padding: 40 }}>⏳ Yükleniyor...</p>;

  return (
    <>
      <Head>
        <title>80bir - Alıcı</title>
        <meta name="description" content="80bir -En iyi fırsatlar burada" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div className="force-desktop"><div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(120deg, var(--surface, #f8fafc) 0%, var(--bg-grad-end, #eafcf6) 100%)',
        }}
      >
        {/* HEADER */}
        <header className="pwa-header"
          style={{
            background: '#fff',
            boxShadow: '0 2px 14px var(--brand-700, #1648b0)05',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            borderBottom: '2px solid var(--primary, #2563eb)',
            padding: 0
          }}
        >
          <div
            className="header-inner"
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              padding: '0 12px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'center',
              minHeight: 70,
              gap: 10,
            }}
          >
            {/* LEFT: Logo */}
            <div className="header-left" style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Image src="/logo.png" alt="Aldın Aldın Logo" width={100} height={50} />
            </div>

            {/* MIDDLE: Categories + Search (fills space on mobile) */}
            <div className="header-middle" style={{ display:'flex', alignItems:'center', gap:10, width:'100%', position:'relative' }}>
              {/* Categories button */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{
                    background: dropdownOpen
                      ? 'linear-gradient(93deg,var(--ink-900, #223555) 40%,var(--primary-400, #3479e3) 65%, var(--accent, #00d18f) 100%)'
                      : 'linear-gradient(90deg,#ffffff 0%,#eef6ff 100%)',
                    color: dropdownOpen ? '#fff' : 'var(--primary,#2563eb)',
                    border: '2px solid var(--primary, #2563eb)',
                    fontWeight: 800,
                    fontSize: isAndroid ? 13 : 14,
                    padding: isAndroid ? '6px 10px' : '9px 14px',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: isAndroid ? 6 : 8,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all .19s cubic-bezier(.55,.01,.48,1.05)',
                    position: 'relative'
                  }}
                >
                  <FiTag size={isAndroid ? 16 : 18} />
                  <span style={{ fontWeight:900, letterSpacing:'.3px' }}>Kategoriler</span>
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
                      borderRadius: 12,
                      listStyle: 'none',
                      minWidth: 220,
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
                          fontWeight: 800,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 15.5,
                          backgroundColor: aktifKategori.ad === 'Tümü' ? 'var(--dropdown-active)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          borderRadius: 8,
                          transition: 'background .14s'
                        }}
                        onClick={() => {
                          setAktifKategori({ ad: 'Tümü', id: undefined });
                          setDropdownOpen(false);
                        }}
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
                            fontWeight: 800,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: 15.5,
                            backgroundColor: aktifKategori.id === kat.id ? 'var(--dropdown-active)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            borderRadius: 8,
                            transition: 'background .14s'
                          }}
                          onClick={() => {
                            setAktifKategori({ ad: kat.ad, id: kat.id });
                            setDropdownOpen(false);
                          }}
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

              {/* Search input + temizle + öneriler */}
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
                    border: '2px solid var(--accent, #00d18f)',
                    borderRadius: 12,
                    padding: '11px 44px 11px 14px',
                    fontSize: 16,
                    height: isAndroid ? 48 : undefined,
                    background: 'linear-gradient(90deg,#f0fff7,#f3f4ff)',
                    outline: 'none',
                    color: 'var(--ink-900, #223555)',
                    minWidth: 0
                  }}
                />
                {/* Clear button */}
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    title="Temizle"
                    style={{
                      position:'absolute', right:10, top: '50%', transform:'translateY(-50%)',
                      border:'none', background:'transparent', cursor:'pointer', fontSize:20, color:'#94a3b8', fontWeight:900
                    }}
                  >×</button>
                )}

                {/* Öneriler dropdown */}
                {showSuggestions && debouncedSearch && suggestions.length > 0 && (
                  <div
                    style={{
                      position:'absolute', top:'110%', left:0, width:'100%',
                      background:'#fff', border:'1px solid #e5e7eb', borderRadius:12,
                      boxShadow:'0 8px 24px rgba(0,0,0,.08)', zIndex:3000, overflow:'hidden'
                    }}
                  >
                    {suggestions.map(s => (
                      <div
                        key={s.id}
                        onMouseDown={(e)=>{ e.preventDefault(); window.location.href=`/urun/${s.id}?from=search_suggest`; }}
                        style={{
                          display:'grid',
                          gridTemplateColumns:'64px 1fr auto',
                          gap:10, alignItems:'center',
                          padding:'10px 10px',
                          borderBottom:'1px solid #f1f5f9',
                          cursor:'pointer'
                        }}
                      >
                        <img
                          src={Array.isArray(s.resim_url) ? s.resim_url[0] || "/placeholder.jpg" : s.resim_url || "/placeholder.jpg"}
                          alt={s.title}
                          style={{ width:64, height:44, objectFit:'cover', borderRadius:8, border:'1px solid #eef2f7' }}
                        />
                        <div style={{ overflow:'hidden' }}>
                          <div style={{ fontWeight:800, fontSize:14, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{s.title}</div>
                          <div style={{ fontSize:12, color:'#6b7280' }}>{findKategoriAd(s.kategori_id)}</div>
                        </div>
                        <div style={{ fontWeight:900, fontSize:13, color:'#ef4444' }}>
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
                  background: "linear-gradient(135deg,#ebfff7,#eff6ff)",
                  borderRadius: 12,
                  boxShadow: "0 2px 10px rgba(0,0,0,.06)",
                  display: "flex",
                  alignItems: "center",
                  border: '1.6px solid #dbeafe'
                }}
                title="Sepetim"
              >
                <FiShoppingCart size={26} color="#00d18f" />
                {cartItems.length > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -4,
                    right: -7,
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#fff",
                    background: "linear-gradient(90deg,#ef4444,#f97316)",
                    borderRadius: 16,
                    padding: "2px 6px",
                    minWidth: 18,
                    textAlign: "center",
                    border: '1px solid #fff'
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
                        background: 'linear-gradient(90deg,#2563eb,#00d18f)',
                        color: '#fff',
                        padding: '9px 14px',
                        borderRadius: 12,
                        border: 'none',
                        fontWeight: 900,
                        fontSize: 14,
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(37,99,235,.18)'
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
                          borderRadius: 10,
                          boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                          zIndex: 999,
                          minWidth: 180
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
                            fontWeight: 700,
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
                            fontWeight: 700,
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
                      background: 'linear-gradient(90deg,#f97316,#ef4444)',
                      color: '#fff',
                      padding: '9px 14px',
                      borderRadius: 12,
                      border: 'none',
                      fontWeight: 900,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 6px 20px rgba(249,115,22,.18)'
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
                      background: '#fff',
                      color: 'var(--primary, #2563eb)',
                      border: '2px solid rgba(37,99,235,.35)',
                      padding: '9px 14px',
                      borderRadius: 12,
                      fontWeight: 900,
                      fontSize: 14,
                      cursor: 'pointer'
                    }}
                  >
                    👤 Profilim
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{
                      background: 'linear-gradient(90deg,#ef4444,#f97316)',
                      color: '#fff',
                      padding: '9px 14px',
                      borderRadius: 12,
                      border: 'none',
                      fontWeight: 900,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 6px 20px rgba(239,68,68,.18)'
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

        {/* === MEGA KAMPANYA AUTOPLAY === */}
        {kampanyaSlides.length > 0 && (
          <section
            className="mega-campaign"
            style={{
              maxWidth: 1300,
              margin: '14px auto 26px',
              borderRadius: 18,
              padding: '0 10px'
            }}
          >
            <div
              onMouseEnter={() => setKampanyaPaused(true)}
              onMouseLeave={() => setKampanyaPaused(false)}
              style={{
                position:'relative',
                overflow:'hidden',
                borderRadius: 18,
                border:'2px solid #fecaca',
                background: 'linear-gradient(135deg,#fff1f2,#fff7ed 40%,#ecfeff 100%)',
                boxShadow:'0 10px 40px rgba(0,0,0,.08)'
              }}
            >
              <div
                style={{
                  display:'flex',
                  width:`${kampanyaSlides.length * 100}%`,
                  transform:`translateX(-${kampanyaIndex * (100 / kampanyaSlides.length)}%)`,
                  transition:'transform .55s cubic-bezier(.4,.0,.2,1)'
                }}
              >
                {kampanyaSlides.map((item, i) => (
                  <div
                    key={item.id ?? i}
                    style={{
                      width:`${100 / kampanyaSlides.length}%`,
                      minHeight: 220,
                      display:'grid',
                      gridTemplateColumns:'1.6fr 1fr',
                      alignItems:'center',
                      gap:18,
                      padding:'18px',
                    }}
                  >
                    <div style={{ padding:'6px 8px' }}>
                      <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#fff', padding:'5px 10px', borderRadius:999, border:'1px solid #fee2e2', fontWeight:900, color:'#ef4444', marginBottom:8 }}>
                        🔥 MEGA KAMPANYA
                        <span style={{ color:'#f97316', fontWeight:900, fontSize:12, marginLeft:6 }}>OTOMATİK KAYAR</span>
                      </div>
                      <h3 style={{ fontSize: isAndroid ? 18 : 22, fontWeight:900, lineHeight:1.2, color:'#0f172a', margin:'6px 0 8px' }}>
                        {item.title}
                      </h3>
                      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:10 }}>
                        {item.indirimli_fiyat && item.indirimli_fiyat !== item.price ? (
                          <>
                            <span style={{ textDecoration:'line-through', color:'#94a3b8', fontWeight:700 }}>{item.price} ₺</span>
                            <span style={{ color:'#ef4444', fontWeight:900, fontSize: isAndroid ? 18 : 22 }}>{item.indirimli_fiyat} ₺</span>
                          </>
                        ):(
                          <span style={{ color:'#16a34a', fontWeight:900, fontSize: isAndroid ? 18 : 22 }}>{item.price} ₺</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        <button
                          onClick={() => window.location.href = `/urun/${item.id}?from=mega_kampanya`}
                          style={{
                            background:'linear-gradient(90deg,#2563eb,#00d18f)',
                            color:'#fff',
                            border:'none',
                            padding:'10px 14px',
                            borderRadius:12,
                            fontWeight:900,
                            cursor:'pointer',
                            boxShadow:'0 8px 24px rgba(0,209,143,.25)'
                          }}
                        >
                          Fırsatı Yakala
                        </button>
                        <button
                          onClick={() => sepeteEkle(item)}
                          style={{
                            background:'#fff',
                            color:'#ef4444',
                            border:'2px solid #fecaca',
                            padding:'10px 14px',
                            borderRadius:12,
                            fontWeight:900,
                            cursor:'pointer'
                          }}
                        >
                          Sepete Ekle
                        </button>
                      </div>
                    </div>
                    <div style={{ padding:'8px' }}>
                      <img
                        src={Array.isArray(item.resim_url) ? item.resim_url[0] || "/placeholder.jpg" : item.resim_url || "/placeholder.jpg"}
                        alt={item.title}
                        style={{
                          width:'100%',
                          height: isAndroid ? 160 : 220,
                          objectFit:'cover',
                          borderRadius:16,
                          border:'2px solid #fee2e2',
                          boxShadow:'0 10px 30px rgba(239,68,68,.15)'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* dots */}
              <div style={{ position:'absolute', left:'50%', bottom:10, transform:'translateX(-50%)', display:'flex', gap:6, background:'rgba(255,255,255,.75)', padding:'6px 10px', borderRadius:999, border:'1px solid #fecaca' }}>
                {kampanyaSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setKampanyaIndex(i)}
                    style={{
                      width: i === kampanyaIndex ? 22 : 8,
                      height: 8,
                      borderRadius: 999,
                      border:'none',
                      background: i === kampanyaIndex ? 'linear-gradient(90deg,#ef4444,#f97316)' : '#fecaca',
                      cursor:'pointer',
                      transition:'all .25s'
                    }}
                    aria-label={`Kampanya ${i+1}`}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Layout: Sol reklam, ana, sağ reklam */}
        <div className="layout-3col"
          style={{
            display: 'flex',
            width: '100%',
            maxWidth: 1300,
            margin: '0 auto',
            position: 'relative',
            gap: 20,
            alignItems: "flex-start",
            padding: "0 6px"
          }} 
        >
          {/* SOL REKLAM */}
          {!isAndroid && (
          <aside className="ads-left" style={{
              width: 150,
              minWidth: 100,
              maxWidth: 170,
              height: 280,
              background: 'var(--surface, #f8fafc)',
              padding: 13,
              borderRadius: 14,
              boxShadow: '0 4px 12px var(--primary, #2563eb)09',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'sticky',
              top: 92,
              zIndex: 10
            }}
          >
            <span
              style={{
                marginBottom: 8,
                fontSize: 13,
                color: 'var(--slate-600, #475569)',
                fontWeight: 600,
                textAlign: 'center'
              }}
            >
              Sponsorlu Reklam
            </span>
            <img
              src="/300x250.png"
              alt="Reklam"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 10,
                objectFit: 'cover',
                boxShadow: '0 2px 9px var(--brand-700, #1648b0)18'
              }}
            />
          </aside>
          )}
          {/* ANA İÇERİK */}
          <main className="main-col" style={{
            maxWidth: 950,
            width: "100%",
            padding: '0 10px',
            flexGrow: 1,
          }}>
            {/* ÖNE ÇIKANLAR */}
            <section
              style={{
                background: '#fff',
                padding: '30px 24px',
                borderRadius: 18,
                marginBottom: 42,
                boxShadow: '0 4px 22px var(--warning, #f59e0b)09',
                border: '2px solid #fde68a'
              }}
            >
              <h2
                style={{
                  fontSize: 23,
                  fontWeight: 900,
                  color: '#b45309',
                  marginBottom: 20,
                  letterSpacing: ".2px"
                }}
              >
                🚀 Öne Çıkanlar
              </h2>
              {dopedIlanlar.length === 0 ? (
                <div
                  style={{
                    background: 'linear-gradient(90deg,#fef9c3,#fff7ed)',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: '#92400e',
                    fontWeight: 700,
                    fontSize: 16
                  }}
                >
                  Şu anda öne çıkarılan bir ilan yok.
                </div>
              ) : (
                <div className="featuredGrid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
                    gap: 23
                  }}
                >
                  {dopedIlanlar.map((product) => (
                    <div className="product-card featured"
                      key={product.id}
                      style={{
                        background: 'linear-gradient(180deg,#fff7ed,#fef3c7)',
                        borderRadius: 15,
                        padding: 15,
                        boxShadow: '0 8px 24px rgba(234,179,8,.18)',
                        transition: 'transform 0.15s, box-shadow 0.18s',
                        cursor: 'pointer',
                        border: "2px solid #fde68a"
                      }}
                      onClick={() => window.location.href = `/urun/${product.id}?from=index2`}
                      onMouseOver={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)"}
                      onMouseOut={e => (e.currentTarget as HTMLElement).style.transform = "none"}
                    >
                      <img
                        src={
                          Array.isArray(product.resim_url)
                            ? product.resim_url[0] || '/placeholder.jpg'
                            : product.resim_url || '/placeholder.jpg'
                        }
                        alt={product.title}
                        style={{
                          width: '100%',
                          height: 160,
                          objectFit: 'cover',
                          borderRadius: 10,
                          marginBottom: 12,
                          border: "1.5px solid #fae27a"
                        }}
                      />
                      <h3
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: '#78350f',
                          marginBottom: 6
                        }}
                      >
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

                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: product.indirimli_fiyat ? "#ef4444" : "#16a34a",
                          marginBottom: 4
                        }}
                      >
                        {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                          <>
                            <span style={{
                              textDecoration: "line-through",
                              color: "#d1d5db",
                              fontWeight: 600,
                              marginRight: 7
                            }}>
                              {product.price} ₺
                            </span>
                            <span style={{ color: "#ef4444", fontWeight: 900 }}>
                              {product.indirimli_fiyat} ₺
                            </span>
                          </>
                        ) : (
                          `${product.price} ₺`
                        )}
                      </div>

                      <div
                        style={{ fontSize: 13, color: '#555', marginTop: 4 }}
                      >
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
              <section className="section-block" style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#1d8cf8',
                  marginBottom: 12,
                  letterSpacing: ".2px"
                }}>
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
                        border: "2px solid #bfdbfe",
                        marginRight: 5,
                        cursor: "pointer",
                        padding: "13px 9px",
                        position: "relative"
                      }}
                      onClick={() => window.location.href = `/urun/${product.id}?from=populer`}
                    >
                      <img src={Array.isArray(product.resim_url) ? product.resim_url[0] || "/placeholder.jpg" : product.resim_url || "/placeholder.jpg"}
                        alt={product.title}
                        style={{
                          width: "100%",
                          height: 92,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1.5px solid #dbeafe"
                        }} />
                      <div style={{
                        fontWeight: 800, fontSize: 15,
                        color: "var(--ink-900, #223555)", marginTop: 5
                      }}>{product.title}</div>
                      {/* Ortalama yıldız */}
                      <div style={{
                        color: "var(--warning, #f59e0b)", fontWeight: 600, fontSize: 18
                      }}>
                        {renderStars(product.ortalamaPuan ?? 0)}
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-500, #64748b)", marginLeft: 5 }}>
                          ({(product.ortalamaPuan ?? 0).toFixed(1)})
                        </span>
                      </div>
                      {/* Fiyat */}
                      <div style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "#ef4444" : "#16a34a",
                        marginBottom: 4
                      }}>
                        {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                          <>
                            <span style={{
                              textDecoration: "line-through",
                              color: "#d1d5db",
                              fontWeight: 600,
                              marginRight: 7
                            }}>
                              {product.price} ₺
                            </span>
                            <span style={{ color: "#ef4444", fontWeight: 900 }}>
                              {product.indirimli_fiyat} ₺
                            </span>
                          </>
                        ) : (
                          `${product.price} ₺`
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* POPÜLER & FIRSAT ÜRÜNLERİ */}
            <section className="section-block" style={{ marginBottom: 32 }}>
              <h2 style={{
                fontSize: 24,
                fontWeight: 900,
                color: '#e11d48',
                marginBottom: 8,
                letterSpacing: ".2px",
                display: "flex",
                alignItems: "center",
                gap: 11
              }}>
                <span style={{fontSize: 28, marginTop: -4}}>🔥</span>
                Ayın İndirimleri Başladı!
                <span style={{
                  background: "linear-gradient(90deg,#22c55e,#16a34a)",
                  color: "#fff",
                  borderRadius: 7,
                  fontSize: 14,
                  padding: "2px 12px",
                  marginLeft: 8,
                  fontWeight: 900
                }}>
                  Haftanın Fırsatları
                </span>
              </h2>
              <p style={{
                fontWeight: 700,
                fontSize: 15.5,
                color: '#444',
                marginBottom: 12,
                marginLeft: 3
              }}>
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
                      border: "2px solid #fecaca",
                      marginRight: 5,
                      cursor: "pointer",
                      padding: "13px 9px",
                      position: "relative"
                    }}
                    onClick={() => window.location.href = `/urun/${p.id}?from=populer`}
                  >
                    {/* İNDİRİMDE ROZETİ */}
                    {p.indirimli_fiyat &&
                      <span style={{
                        position: "absolute", top: 11, left: 11,
                        background: "linear-gradient(90deg,#ef4444,#f97316)", color: "#fff",
                        fontWeight: 900, fontSize: 12, borderRadius: 7, padding: "2px 10px", boxShadow: "0 1px 5px rgba(239,68,68,.3)"
                      }}>İNDİRİMDE</span>}

                    {/* ÇOK SATAN ROZETİ */}
                    {idx < 3 &&
                      <span style={{
                        position: "absolute", top: 11, right: 11,
                        background: "linear-gradient(90deg,#f59e0b,#f97316)", color: "#fff", fontWeight: 900,
                        fontSize: 12, borderRadius: 7, padding: "2px 10px"
                      }}>Çok Satan</span>}

                    <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                      alt={p.title}
                      style={{
                        width: "100%",
                        height: 92,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1.5px solid #fde68a"
                      }} />
                    <div style={{
                      fontWeight: 800, fontSize: 15,
                      color: "#e11d48", marginTop: 5
                    }}>{p.title}</div>
                    <div style={{
                      fontWeight: 900, fontSize: 15, color: "#22c55e"
                    }}>
                      {p.indirimli_fiyat ?
                        <>
                          <span style={{ textDecoration: "line-through", color: "#d1d5db", fontWeight: 700, marginRight: 4 }}>
                            {p.price}₺
                          </span>
                          <span style={{ color: "#ef4444" }}>{p.indirimli_fiyat}₺</span>
                        </>
                        : `${p.price}₺`}
                    </div>
                    {/* Stok azaldı badge örneği */}
                    {p.stok && p.stok < 5 &&
                      <div style={{
                        color: "#e11d48", fontWeight: 900, fontSize: 13, marginTop: 2
                      }}>
                        Son {p.stok} ürün!
                      </div>
                    }
                  </div>
                ))}
              </div>
            </section>

            {/* === STANDART İLAN KARTLARI + FİLTRE BAR === */}
            <section className="section-block">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                <h2
                  style={{
                    fontSize: 23,
                    fontWeight: 900,
                    color: 'var(--ink-900, #223555)',
                    marginBottom: 10
                  }}
                >
                  {aktifKategori.ad === 'Tümü'
                    ? 'Tüm İlanlar'
                    : `${aktifKategori.ad} İlanları`}
                </h2>

                {/* SIRALAMA */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <label style={{ fontSize:13, color:'#64748b', fontWeight:900 }}>Sırala:</label>
                  <select
                    value={sortKey}
                    onChange={(e)=> setSortKey(e.target.value as any)}
                    style={{ padding:'8px 10px', border:'2px solid #e2e8f0', borderRadius:10, fontWeight:900 }}
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

              {/* HIZLI FİLTRELER */}
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', margin:'6px 0 14px' }}>
                <button onClick={()=> setOnlyDiscounted(v=>!v)}
                  style={{
                    padding:'8px 12px', borderRadius:999, border:'2px solid #fde68a',
                    background: onlyDiscounted ? '#fff7ed' : '#fff', fontWeight:900, fontSize:13, cursor:'pointer'
                  }}>İndirimli</button>

                <button onClick={()=> setOnlyInStock(v=>!v)}
                  style={{
                    padding:'8px 12px', borderRadius:999, border:'2px solid #bbf7d0',
                    background: onlyInStock ? '#ecfeff' : '#fff', fontWeight:900, fontSize:13, cursor:'pointer'
                  }}>Stokta</button>

                <button onClick={()=> setOnlyNew(v=>!v)}
                  style={{
                    padding:'8px 12px', borderRadius:999, border:'2px solid #bfdbfe',
                    background: onlyNew ? '#eff6ff' : '#fff', fontWeight:900, fontSize:13, cursor:'pointer'
                  }}>Yeni</button>

                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="Min ₺"
                    style={{ width:90, padding:'8px 10px', border:'2px solid #e2e8f0', borderRadius:10 }} />
                  <span style={{ color:'#94a3b8' }}>–</span>
                  <input value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Max ₺"
                    style={{ width:90, padding:'8px 10px', border:'2px solid #e2e8f0', borderRadius:10 }} />
                </div>

                {(onlyDiscounted || onlyInStock || onlyNew || minPrice || maxPrice || debouncedSearch) && (
                  <button
                    onClick={()=>{
                      setOnlyDiscounted(false); setOnlyInStock(false); setOnlyNew(false);
                      setMinPrice(''); setMaxPrice(''); setSearch(''); setVisibleCount(12);
                    }}
                    style={{ padding:'8px 12px', borderRadius:10, border:'2px solid #e2e8f0', background:'#fff', fontWeight:900, fontSize:13, cursor:'pointer' }}
                  >
                    Temizle
                  </button>
                )}
              </div>

              {normalIlanlar.length === 0 ? (
                <div
                  style={{
                    background: 'var(--surface, #f8fafc)',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: 'var(--ink-500, #64748b)',
                    fontWeight: 700,
                    fontSize: 16
                  }}
                >
                  {aktifKategori.ad === 'Tümü'
                    ? 'Sonuç bulunamadı. Filtreleri gevşetmeyi deneyin.'
                    : `${aktifKategori.ad} kategorisinde uygun sonuç yok.`}
                </div>
              ) : (
                <>
                  <div
                    className="ilanGrid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
                      gap: 23
                    }}
                  >
                    {normalIlanlar.map((product) => {
                      const sepette = sepetteVarMi(product.id);

                      return (
                        <div
                          key={product.id}
                          style={{
                            background: '#fff',
                            borderRadius: 15,
                            padding: 15,
                            boxShadow: '0 3px 16px rgba(34,197,94,.14)',
                            transition: 'transform 0.16s',
                            cursor: 'pointer',
                            position: 'relative',
                            border: "2px solid #e2e8f0"
                          }}
                          onClick={() => window.location.href = `/urun/${product.id}?from=index2`}
                          onMouseOver={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)"}
                          onMouseOut={e => (e.currentTarget as HTMLElement).style.transform = "none"}
                        >
                          {isYeni(product.created_at) && (
                            <span
                              style={{
                                position: 'absolute',
                                top: 13, left: 13,
                                background: 'linear-gradient(90deg,#22c55e,#16a34a)',
                                color: '#fff',
                                fontWeight: 900,
                                fontSize: 13,
                                borderRadius: 999,
                                padding: '4px 13px',
                                boxShadow: '0 2px 8px rgba(34,197,94,.25)',
                                zIndex: 1
                              }}
                            >
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
                              color: favoriler.includes(product.id) ? "#fb8500" : "#bbb",
                              cursor: 'pointer',
                              userSelect: 'none',
                              zIndex: 2,
                              transition: 'color 0.2s'
                            }}
                          >
                            {favoriler.includes(product.id) ? "❤️" : "🤍"}
                          </span>
                          <img
                            src={
                              Array.isArray(product.resim_url)
                                ? product.resim_url[0] || '/placeholder.jpg'
                                : product.resim_url || '/placeholder.jpg'
                            }
                            alt={product.title}
                            style={{
                              width: '100%',
                              height: 155,
                              objectFit: 'cover',
                              borderRadius: 10,
                              marginBottom: 12,
                              background: '#f0fdf4',
                              border: "1.5px solid #e2e8f0"
                            }}
                          />
                          <h3
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: '#1e293b',
                              marginBottom: 6
                            }}
                          >
                            {product.title}
                          </h3>
                          <FirmaBilgiSatiri
                            email={product.user_email}
                            firmaAdMap={firmaAdMap}
                            onYorumClick={() => window.location.href = `/firma-yorumlar/${product.user_email}`}
                          />
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "#ef4444" : "#16a34a",
                              marginBottom: 4
                            }}
                          >
                            {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                              <>
                                <span style={{
                                  textDecoration: "line-through",
                                  color: "#d1d5db",
                                  fontWeight: 600,
                                  marginRight: 7
                                }}>
                                  {product.price} ₺
                                </span>
                                <span style={{ color: "#ef4444", fontWeight: 900 }}>
                                  {product.indirimli_fiyat} ₺
                                </span>
                              </>
                            ) : (
                              `${product.price} ₺`
                            )}
                          </div>

                          <span
                            style={{
                              fontSize: 14,
                              color: '#64748b'
                            }}
                          >
                            {findKategoriAd(product.kategori_id)}
                          </span>
                          {!sepette ? (
                            <button
                              style={{
                                marginTop: 13,
                                background: 'linear-gradient(90deg,#00d18f,#2563eb)',
                                color: '#fff',
                                padding: '10px 0',
                                borderRadius: 12,
                                border: 'none',
                                fontWeight: 900,
                                fontSize: 15,
                                cursor: 'pointer',
                                width: '100%',
                                boxShadow: '0 6px 20px rgba(0,209,143,.25)',
                                letterSpacing: 0.5,
                                transition: 'background 0.18s'
                              }}
                              onClick={async e => {
                                e.stopPropagation();
                                await sepeteEkle(product);
                              }}
                            >
                              🛒 Sepete Ekle
                            </button>
                          ) : (
                            <button
                              style={{
                                marginTop: 13,
                                background: 'linear-gradient(90deg,#fb8500,#ffbc38)',
                                color: '#fff',
                                padding: '10px 0',
                                borderRadius: 12,
                                border: 'none',
                                fontWeight: 900,
                                fontSize: 15,
                                cursor: 'pointer',
                                width: '100%',
                                boxShadow: '0 6px 18px rgba(251,133,0,.25)',
                                letterSpacing: 0.5,
                                transition: 'background 0.18s'
                              }}
                              onClick={e => {
                                e.stopPropagation();
                                sepeteGit();
                              }}
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
                          background:'#fff', border:'2px solid #e2e8f0', borderRadius:12,
                          padding:'10px 16px', fontWeight:900, cursor:'pointer'
                        }}
                      >
                        Daha Fazla Yükle ({totalAfterFilters - normalIlanlar.length} kaldı)
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </main>

          {/* SAĞ REKLAM */}
          {!isAndroid && (
          <aside className="ads-right" style={{
              width: 150,
              minWidth: 100,
              maxWidth: 170,
              height: 280,
              background: 'var(--surface, #f8fafc)',
              padding: 13,
              borderRadius: 14,
              boxShadow: '0 4px 12px var(--primary, #2563eb)09',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'sticky',
              top: 92,
              zIndex: 10
            }}
          >
            <span
              style={{
                marginBottom: 8,
                fontSize: 13,
                color: 'var(--slate-600, #475569)',
                fontWeight: 600,
                textAlign: 'center'
              }}
            >
              Sponsorlu Reklam
            </span>
            <img
              src="/300x250.png"
              alt="Reklam"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 10,
                objectFit: 'cover',
                boxShadow: '0 2px 9px var(--brand-700, #1648b0)18'
              }}
            />
          </aside>
          )}
        </div>

        {/* Responsive + Canlı renkler için global stiller */}
        <style jsx global>{`
  :root{
    --primary:#2563eb;
    --accent:#00d18f;
    --warning:#f59e0b;
    --danger:#e11d48;
    --highlight:#fef08a;
    --surface:#f8fafc;
    --ink-900:#0f172a;
  }

  /* PWA / çentik güvenli alanları */
  body { padding-bottom: env(safe-area-inset-bottom); }
  .pwa-header{
    padding-top: constant(safe-area-inset-top);
    padding-top: env(safe-area-inset-top);
    min-height: calc(70px + env(safe-area-inset-top));
  }

  /* Tablet ve aşağısı: reklamları gizle, layout tek kolona düşsün */
  @media (max-width: 1024px) {
    .layout-3col {
      flex-direction: column !important;
      gap: 12px !important;
      padding: 0 !important;
      width: 100% !important;
    }
    .ads-left, .ads-right { display: none !important; }

    /* Kart gridleri: 2 sütun */
    .ilanGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 14px !important;
    }

    /* Arama kutusu genişlesin */
    header input[type="text"] {
      width: 100% !important;
      max-width: none !important;
    }
  }

  /* Telefon: tam genişlik görünüm + 1 sütun grid */
  @media (max-width: 640px) {
    .header-inner{
      max-width: none !important;
      width: 100% !important;
      padding: 0 12px !important;
    }
    .main-col{
      max-width: none !important;
      padding: 0 !important;
    }
    .main-col > section{
      margin-left: 0 !important;
      margin-right: 0 !important;
      border-radius: 0 !important;
      padding-left: 16px !important;
      padding-right: 16px !important;
    }
    .ilanGrid { grid-template-columns: 1fr !important; }
  }

  /* Genel güvenlik bandı */
  html, body { max-width: 100vw; overflow-x: hidden; }
  img, video { max-width: 100%; height: auto; display: block; }

  /* === PHONE REFINEMENTS (<=640px) === */
  @media (max-width: 640px){
    .header-left{ display:none !important; }
    .ads-left, .ads-right{ display:none !important; }

    .header-inner{
      grid-template-columns: 1fr !important;
      min-height: 56px !important;
      padding: 0 12px !important;
    }
    .header-middle{ width:100% !important; gap:8px !important; }
    .header-middle input[type="text"], .searchBar{
      width:100% !important; height:40px !important;
    }
    .header-actions{ gap:8px !important; }
    .header-actions button{ padding:6px 10px !important; font-size:13px !important; }
    .main-col > .section-block{
      padding:16px 12px !important;
      margin-bottom:20px !important;
      border-radius:10px !important;
    }
    .product-card img{ height:140px !important; object-fit:cover !important; }
  }

  @media (max-width: 480px){
    .featuredGrid, .ilanGrid, .products, .cards{
      grid-template-columns: 1fr !important;
      gap:12px !important;
    }
  }
  @media (min-width: 481px) and (max-width: 640px){
    .featuredGrid, .ilanGrid, .products, .cards{
      grid-template-columns: repeat(2, minmax(0,1fr)) !important;
      gap:12px !important;
    }
  }

  /* ===== ANDROID FULL-FIT + ADS OFF ===== */
  .is-android .ads-left,
  .is-android .ads-right{
    display: none !important;
  }
  .is-android .layout-3col{
    display: block !important;
    max-width: none !important;
  }
  .is-android .main-col{
    width: 100% !important;
    max-width: none !important;
    padding: 0 10px !important;
  }
  .is-android .main-col > .section-block{
    margin: 0 0 18px !important;
    border-radius: 10px !important;
    padding: 16px 12px !important;
  }
  .is-android .section-block h2 + div{
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    gap: 12px !important;
    overflow: visible !important;
  }
  .is-android .section-block h2 + p + div{
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    gap: 12px !important;
    overflow: visible !important;
  }
  .is-android .ilanGrid{
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    gap: 12px !important;
  }
  @media (max-width: 480px){
    .is-android .section-block h2 + div,
    .is-android .section-block h2 + p + div,
    .is-android .ilanGrid{
      grid-template-columns: 1fr !important;
    }
  }
  .is-android .product-card img{
    height: 140px !important;
    object-fit: cover !important;
  }
  .is-android .layout-3col{
    display:block !important;
    max-width:none !important;
  }
  .is-android .main-col{
    width:100% !important;
    max-width:none !important;
    padding:0 4px !important;
  }
  .is-android .header-left{ display:none !important; }
  .is-android .header-inner{
    grid-template-columns: 1fr auto !important;
    padding:0 6px !important;
    min-height:54px !important;
  }
  .is-android .header-middle{ gap:6px !important; width:100% !important; }
  .is-android .header-middle input[type="text"]{ height:42px !important; }
  .is-android .header-actions{ gap:6px !important; }
  .is-android .header-actions button{ padding:6px 10px !important; font-size:13px !important; border-radius:8px !important; }
  .is-android .main-col > .section-block{
    padding:12px 6px !important;
    margin:0 0 16px !important;
    border-radius:8px !important;
  }
  .is-android .featuredGrid{
    display:grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    gap:10px !important;
  }
  .is-android .section-block h2 + div{
    display:grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    gap:10px !important;
    overflow:visible !important;
  }
  .is-android .section-block h2 + p + div{
    display:flex !important;
    gap:12px !important;
    overflow-x:auto !important;
    -webkit-overflow-scrolling:touch !important;
    scroll-snap-type:x mandatory;
    padding-bottom:6px !important;
  }
  .is-android .section-block h2 + p + div > *{
    scroll-snap-align:start;
    min-width:220px;
  }
  .is-android .ilanGrid{
    display:grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    gap:10px !important;
  }
  .is-android .product-card img{
    height:150px !important;
    object-fit:cover !important;
    border-radius:10px !important;
  }
  @media (min-width:400px){
    .is-android .main-col{ padding:0 6px !important; }
    .is-android .main-col > .section-block{ padding:14px 8px !important; }
    .is-android .featuredGrid,
    .is-android .section-block h2 + div,
    .is-android .ilanGrid{ gap:12px !important; }
    .is-android .section-block h2 + p + div > *{ min-width:240px; }
  }
  @media (max-width:360px){
    .is-android .product-card img{ height:140px !important; }
  }
  html, body { max-width: 100vw; overflow-x: hidden; }
  img, video { max-width: 100%; height: auto; display: block; }
  @media (max-width: 420px){
    .is-android .header-middle{
      display:flex !important;
      flex-direction: column !important;
      gap:8px !important;
    }
    .is-android .header-inner{
      grid-template-columns: 1fr auto !important;
    }
    .is-android .header-middle input[type="text"]{
      width:100% !important;
    }
  }
        `}</style>
      </div></div>
    </>
  );
};

export default Index2;
