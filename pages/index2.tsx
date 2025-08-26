/* pages/index2.tsx */

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
import React, { useState, useEffect, ReactNode } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';
import SloganBar from "../components/SloganBar";
import { FiChevronDown } from 'react-icons/fi'
import { useRouter } from 'next/router'

/** ===== Ortalama puan hesaplama ===== **/
async function ilanlaraOrtalamaPuanEkle(ilanlar: Ilan[]) {
  const result: Ilan[] = [];
  for (const ilan of ilanlar) {
    const { data: yorumlar } = await supabase
      .from("yorumlar")
      .select("puan")
      .eq("urun_id", ilan.id);
    const puanArr = (yorumlar || []).map((y: any) => y.puan);
    const ortalama = puanArr.length
      ? puanArr.reduce((a: number, b: number) => a + b, 0) / puanArr.length
      : 0;
    result.push({ ...ilan, ortalamaPuan: ortalama });
  }
  return result;
}

/** ===== Firma adı + yıldız + yorum butonu ===== **/
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
      <span style={{ fontWeight: 600, fontSize: 15, color: "#1d8cf8", marginRight: 3 }}>{info.ad}</span>
      <span>
        {renderStars(info.puan)}
        <span style={{ color: "var(--ink-500, #64748b)", fontSize: 13, marginLeft: 5 }}>
          ({info.puan.toFixed(1)})
        </span>
      </span>
      <button
        onClick={onYorumClick}
        className="tap-safe"
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

type Kategori = { id: number; ad: string; };
type CartItem = { id: number; adet: number; product_id: number; };

function isYeni(created_at?: string) {
  if (!created_at) return false;
  const ilanTarihi = new Date(created_at).getTime();
  const simdi = Date.now();
  return simdi - ilanTarihi < 86400000;
}

const Index2: NextPage = () => {
  const router = useRouter();

  // ===== STATES =====
  const [loginDropdown, setLoginDropdown] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, FirmaInfo>>({});
  const [dbKategoriler, setDbKategoriler] = useState<Kategori[]>([]);
  const [populerIlanlar, setPopulerIlanlar] = useState<Ilan[]>([]);
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dopedIlanlar, setDopedIlanlar] = useState<Ilan[]>([]);
  const { kategori } = router.query as { kategori?: string };
  const [aktifKategori, setAktifKategori] = useState<{ ad: string; id?: number | null }>({ ad: 'Tümü', id: undefined });
  const [favoriler, setFavoriler] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);

  // ===== HELPERS =====
  const sepetteVarMi = (id: number) => cartItems.find((item) => item.product_id === id);
  const findKategoriAd = (id: number | null | undefined): string => {
    if (typeof id !== "number" || isNaN(id)) return "";
    const kat = dbKategoriler.find((k) => k.id === id);
    return kat?.ad || "";
  };

  /** 🔗 TIKLAMA SORUNUNA KESİN ÇÖZÜM
   *  Dinamik route'a stringle değil, router.push({pathname:'/urun/[id]', query:{id}}) ile gidiyoruz.
   *  Ayrıca klavye/tap için erişilebilir kısayollar da ekledik.
   */
  const gotoProduct = (id: number, from: string) => {
    router.push({ pathname: '/urun/[id]', query: { id, from } });
  };

  // ===== EFFECTS =====
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const isAnd = /Android/i.test(navigator.userAgent);
      setIsAndroid(isAnd);
      if (isAnd) document.documentElement.classList.add('is-android');
      return () => { if (isAnd) document.documentElement.classList.remove('is-android'); };
    }
  }, []);

  useEffect(() => {
    async function fetchFirmaAdlari() {
      const { data: firmalar } = await supabase.from("satici_firmalar").select("email, firma_adi, puan");
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
    async function fetchUserCartAndFavorites() {
      const { data: userData } = await supabase.auth.getUser();
      setIsLoggedIn(!!userData?.user);
      setUser(userData?.user || null);

      if (userData?.user) {
        const userId = userData.user.id;
        const { data: cartData } = await supabase.from("cart").select("id, adet, product_id").eq("user_id", userId);
        setCartItems(cartData || []);
        const { data: favData } = await supabase.from("favoriler").select("ilan_id").eq("user_id", userId);
        setFavoriler((favData || []).map((f: any) => f.ilan_id));
      } else {
        setCartItems([]); setFavoriler([]);
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

  useEffect(() => {
    if (kategori) {
      const kat = dbKategoriler.find(k => String(k.id) === kategori);
      if (kat) setAktifKategori({ ad: kat.ad, id: kat.id });
    }
  }, [kategori, dbKategoriler]);

  // ===== Derivations =====
  const trendKategoriler = React.useMemo(() => {
    const counter: Record<number, number> = {};
    (ilanlar || []).forEach(i => {
      if (typeof i.kategori_id === "number") counter[i.kategori_id] = (counter[i.kategori_id] || 0) + 1;
    });
    return Object.entries(counter)
      .map(([id, count]) => ({ id: Number(id), ad: findKategoriAd(Number(id)), count }))
      .filter(k => !!k.ad)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [ilanlar, dbKategoriler]);

  const yeniEklenenler = React.useMemo(() => {
    return [...(ilanlar || [])]
      .filter(i => !!i.created_at)
      .sort((a, b) => (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime()))
      .slice(0, 8);
  }, [ilanlar]);

  const cokGoruntulenenler = React.useMemo(() => {
    return [...(ilanlar || [])]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 8);
  }, [ilanlar]);

  // ===== Actions =====
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUser(null);
    window.location.href = '/';
  };

  const sepeteEkle = async (urun: Ilan) => {
    if (!isLoggedIn || !user) {
      alert("Lütfen giriş yapınız!");
      router.push('/giris');
      return;
    }
    const sepette = sepetteVarMi(urun.id);
    if (sepette) {
      await supabase.from("cart").update({ adet: sepette.adet + 1 }).eq("id", sepette.id);
    } else {
      await supabase.from("cart").insert([{ user_id: user.id, product_id: urun.id, adet: 1, ozellikler: {} }]);
    }
    const { data: cartData } = await supabase.from("cart").select("id, adet, product_id, ozellikler").eq("user_id", user.id);
    setCartItems(cartData || []);
  };

  const sepeteGit = () => router.push('/sepet2');

  const toggleFavori = async (ilanId: number) => {
    if (!isLoggedIn || !user) {
      alert("Lütfen giriş yapınız!");
      router.push('/giris');
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

  const filteredIlanlar = ilanlar.filter((i) => {
    const baslik = (i.title || '').toLowerCase();
    const aciklama = (i.desc || '').toLowerCase();
    const searchLower = search.toLowerCase();
    if (!aktifKategori.id) {
      if (aktifKategori.ad !== 'Tümü') return false;
      return baslik.includes(searchLower) || aciklama.includes(searchLower);
    }
    return i.kategori_id === aktifKategori.id && (baslik.includes(searchLower) || aciklama.includes(searchLower));
  });

  const normalIlanlar = filteredIlanlar;

  if (loading) return <p style={{ textAlign: "center", padding: 40 }}>⏳ Yükleniyor...</p>;
  return (
    <>
      <Head>
        <title>80bir - Alıcı</title>
        <meta name="description" content="80bir -En iyi fırsatlar burada" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="force-desktop">
      <div
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
            borderBottom: '1.5px solid var(--border, #e4e9ef)',
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

            {/* MIDDLE */}
            <div className="header-middle" style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
              {/* Kategoriler */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="tap-safe"
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
                  }}
                >
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
                        className="tap-safe"
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
                          className="tap-safe"
                          style={{
                            width: "100%", background: 'none', border: 'none', padding: '10px 19px',
                            color: aktifKategori.id === kat.id ? 'var(--primary)' : 'var(--ink-900)',
                            fontWeight: 700, textAlign: 'left', cursor: 'pointer', fontSize: 15.5,
                            backgroundColor: aktifKategori.id === kat.id ? 'var(--dropdown-active)' : 'transparent',
                            display: 'flex', alignItems: 'center', gap: 10, borderRadius: 7, transition: 'background .14s'
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

              {/* Search */}
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  placeholder="🔍 Ürün ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="tap-safe"
                  style={{
                    width: "100%",
                    border: "1.5px solid var(--border-200, #e2e8f0)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 16,
                    height: isAndroid ? 48 : undefined,
                    background: "var(--surface, #f8fafc)",
                    outline: "none",
                    color: "var(--ink-900, #223555)",
                    zIndex: 50,
                    position: "relative"
                  }}
                />
                {search && (
                  <div
                    style={{
                      position: "absolute",
                      top: "105%",
                      left: 0,
                      width: "100%",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      boxShadow: "0 4px 16px rgba(0,0,0,.1)",
                      zIndex: 100,
                      maxHeight: 300,
                      overflowY: "auto"
                    }}
                  >
                    {ilanlar
                      .filter((i) => (i.title || "").toLowerCase().includes(search.toLowerCase()))
                      .slice(0, 6)
                      .map((i) => (
                        <div
                          key={i.id}
                          className="tap-safe"
                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                          onClick={() => gotoProduct(i.id, 'search')}
                          onKeyDown={(e) => { if (e.key === 'Enter') gotoProduct(i.id, 'search'); }}
                          role="link"
                          tabIndex={0}
                        >
                          {i.title}
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
                className="tap-safe"
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
                <FiShoppingCart size={26} color="var(--accent, #1bbd8a)" />
                {cartItems.length > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -4, right: -7, fontSize: 12, fontWeight: 800, color: "#fff",
                    background: "var(--success-500, #22c55e)", borderRadius: 16, padding: "2px 6px", minWidth: 18, textAlign: "center"
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
                      className="tap-safe"
                      style={{ background: 'var(--primary, #2563eb)', color: '#fff', padding: '8px 14px',
                               borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
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
                          onClick={() => router.push('/giris')}
                          className="tap-safe"
                          style={{ display: "block", width: "100%", padding: "10px 14px", background: "none",
                                   border: "none", textAlign: "left", cursor: "pointer",
                                   fontWeight: 600, fontSize: 14, color: "#223555" }}
                        >
                          👤 Alıcı Giriş
                        </button>
                        <button
                          onClick={() => router.push('/giris-satici')}
                          className="tap-safe"
                          style={{ display: "block", width: "100%", padding: "10px 14px", background: "none",
                                   border: "none", textAlign: "left", cursor: "pointer",
                                   fontWeight: 600, fontSize: 14, color: "#223555" }}
                        >
                          🛒 Satıcı Giriş
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => router.push('/kayit')}
                    className="tap-safe"
                    style={{ background: 'var(--accent, #1bbd8a)', color: '#fff', padding: '8px 14px',
                             borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    Kaydol
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/profil2')}
                    className="tap-safe"
                    style={{ background: 'var(--surface, #f3f4f6)', color: 'var(--primary, #2563eb)',
                             border: '1px solid rgba(37,99,235,.15)', padding: '8px 14px', borderRadius: 10,
                             fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    👤 Profilim
                  </button>
                  <button
                    onClick={handleLogout}
                    className="tap-safe"
                    style={{ background: 'var(--danger, #e11d48)', color: '#fff',
                             padding: '8px 14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    Çıkış
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <SloganBar />

        {/* === HERO === */}
        <section
          id="hero"
          style={{
            maxWidth: 1200,
            margin: '16px auto 22px',
            padding: '22px 18px',
            borderRadius: 18,
            background: 'linear-gradient(90deg,#e0f7f4 0%, #fef3c7 100%)',
            border: '1.5px solid #e8efe8',
            boxShadow: '0 8px 26px rgba(0,0,0,.06)'
          }}
        >
          <div className="hero-grid" style={{ display:'grid', gridTemplateColumns:'1.2fr .8fr', gap:18, alignItems:'center' }}>
            <div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                <span className="chip">Ücretsiz İade</span>
                <span className="chip">Güvenli Ödeme</span>
                <span className="chip">Hızlı Teslimat</span>
              </div>
              <h1 className="hero-title" style={{ fontSize:28, fontWeight:900, color:'#0f172a', lineHeight:1.15, margin:'0 0 8px' }}>
                Binlerce üründe <span style={{ color:'#16a34a' }}>fırsatlar</span> ve <span style={{ color:'#ef4444' }}>indirimler</span> seni bekliyor!
              </h1>
              <p style={{ color:'#334155', fontWeight:600, margin:'6px 0 14px' }}>
                Popüler ürünler, yeni eklenenler ve öne çıkanlar tek ekranda.
              </p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <a href="#featured" className="tap-safe" style={{ background:'#16a34a', color:'#fff', padding:'10px 16px', borderRadius:10, fontWeight:800, textDecoration:'none', boxShadow:'0 2px 10px rgba(22,163,74,.24)' }}>🚀 Fırsatları Göster</a>
                <a href="#yeni" className="tap-safe" style={{ background:'#fff', color:'#111827', padding:'10px 16px', borderRadius:10, fontWeight:800, textDecoration:'none', border:'1.5px solid #e5e7eb' }}>🆕 Yeni Eklenenler</a>
              </div>
            </div>
            <div style={{ display:'none' }} />
          </div>
        </section>

        {/* === Güven Rozetleri === */}
        <section
          style={{
            maxWidth:1200, margin:'0 auto 18px', display:'grid',
            gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, padding:'0 8px'
          }}
        >
          {[
            {t:'Kolay İade', s:'14 gün içinde değişim/iade'},
            {t:'Canlı Destek', s:'7/24 desteğe bağlan'},
            {t:'Güvenli Ödeme', s:'3D Secure ile koruma'},
            {t:'Hızlı Teslimat', s:'Aynı gün kargo seçenekleri'},
          ].map((b, i)=>(
            <div key={i} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 14px', boxShadow:'0 2px 10px rgba(0,0,0,.04)' }}>
              <div style={{ fontWeight:800, color:'#0f172a', marginBottom:4 }}>{b.t}</div>
              <div style={{ color:'#64748b', fontWeight:600, fontSize:13.5 }}>{b.s}</div>
            </div>
          ))}
        </section>

        {/* === 3 kolon düzen === */}
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
              width: 150, minWidth: 100, maxWidth: 170, height: 280,
              background: 'var(--surface, #f8fafc)', padding: 13, borderRadius: 14,
              boxShadow: '0 4px 12px var(--primary, #2563eb)09',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'sticky', top: 92, zIndex: 10
            }}>
              <span style={{ marginBottom: 8, fontSize: 13, color: 'var(--slate-600, #475569)', fontWeight: 600, textAlign:'center' }}>
                Sponsorlu Reklam
              </span>
              <img src="/300x250.png" alt="Reklam" style={{ width:'100%', height:'100%', borderRadius:10, objectFit:'cover', boxShadow:'0 2px 9px var(--brand-700, #1648b0)18' }} />
            </aside>
          )}

          {/* ANA İÇERİK */}
          <main className="main-col" style={{ maxWidth: 950, width: "100%", padding: '0 10px', flexGrow: 1 }}>
            {/* Trend Kategoriler */}
            {trendKategoriler.length > 0 && (
              <section className="section-block" style={{
                background:'#fff', borderRadius:18, padding:'20px 16px', marginBottom:24,
                border:'1.5px solid var(--border-200, #e2e8f0)', boxShadow:'0 2px 14px rgba(0,0,0,.04)'
              }}>
                <h2 style={{ fontSize:22, fontWeight:900, color:'#0f172a', marginBottom:12 }}>🔥 Trend Kategoriler</h2>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
                  {trendKategoriler.map(k=>(
                    <button
                      key={k.id}
                      onClick={()=> setAktifKategori({ ad: k.ad, id: k.id })}
                      className="tap-safe"
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                               background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12,
                               cursor:'pointer', textAlign:'left' }}
                    >
                      <span>{iconMap[k.ad] || <FiMoreHorizontal size={20} />}</span>
                      <span style={{ fontWeight:800, color:'#0f172a' }}>{k.ad}</span>
                      <span style={{ marginLeft:'auto', fontWeight:800, color:'#2563eb' }}>{k.count}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ÖNE ÇIKANLAR */}
            <section id="featured"
              style={{ background:'#fff', padding:'30px 24px', borderRadius:18, marginBottom:42,
                       boxShadow:'0 4px 22px var(--warning, #f59e0b)09', border:'1.5px solid var(--border-200, #e2e8f0)' }}
            >
              <h2 style={{ fontSize: 23, fontWeight: 800, color: 'var(--amber-700, #b45309)', marginBottom: 20, letterSpacing: ".2px" }}>
                🚀 Öne Çıkanlar
              </h2>
              {dopedIlanlar.length === 0 ? (
                <div style={{ background:'#fef9c3', padding:40, textAlign:'center', borderRadius:13, color:'#92400e', fontWeight:500, fontSize:16 }}>
                  Şu anda öne çıkarılan bir ilan yok.
                </div>
              ) : (
                <div className="featuredGrid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(235px, 1fr))', gap:23 }}>
                  {dopedIlanlar.map((product) => (
                    <div
                      key={product.id}
                      className="product-card featured tap-safe"
                      style={{
                        background: '#fef08a',
                        borderRadius: 15,
                        padding: 15,
                        boxShadow: '0 4px 17px #eab30817',
                        transition: 'transform 0.15s, box-shadow 0.18s',
                        cursor: 'pointer',
                        border: "1.5px solid #fbe192"
                      }}
                      onClick={() => gotoProduct(product.id, 'index2')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') gotoProduct(product.id, 'index2'); }}
                      role="link"
                      tabIndex={0}
                    >
                      <img
                        src={Array.isArray(product.resim_url) ? product.resim_url[0] || '/placeholder.jpg' : product.resim_url || '/placeholder.jpg'}
                        alt={product.title}
                        style={{ width:'100%', height:160, objectFit:'cover', borderRadius:10, marginBottom:12, border:"1.5px solid #fae27a" }}
                      />
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#78350f', marginBottom: 6 }}>{product.title}</h3>
                      <FirmaBilgiSatiri email={product.user_email} firmaAdMap={firmaAdMap} onYorumClick={() => router.push(`/firma-yorumlar/${product.user_email}`)} />
                      {typeof product.ortalamaPuan !== 'undefined' && (
                        <span style={{ display:"flex", alignItems:"center", gap:4, marginBottom:5 }}>
                          {renderStars(product.ortalamaPuan ?? 0)}
                          <span style={{ color:"#64748b", fontSize:13, marginLeft:5 }}>({(product.ortalamaPuan ?? 0).toFixed(1)})</span>
                        </span>
                      )}
                      <div style={{ fontSize:16, fontWeight:600, color: product.indirimli_fiyat ? "#ef4444" : "#16a34a", marginBottom:4 }}>
                        {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                          <>
                            <span style={{ textDecoration:"line-through", color:"#d1d5db", fontWeight:500, marginRight:7 }}>{product.price} ₺</span>
                            <span style={{ color:"#ef4444", fontWeight:700 }}>{product.indirimli_fiyat} ₺</span>
                          </>
                        ) : `${product.price} ₺`}
                      </div>
                      <div style={{ fontSize:13, color:'#555', marginTop:4 }}>{getRemainingTime(product.doped_expiration)}</div>
                      <span style={{ fontSize:14, color:'#a16207' }}>{findKategoriAd(product.kategori_id)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Yeni Eklenenler */}
            {yeniEklenenler.length > 0 && (
              <section id="yeni" className="section-block" style={{ background:'#fff', borderRadius:18, padding:'22px 16px', marginBottom:28, border:'1.5px solid var(--border-200, #e2e8f0)', boxShadow:'0 2px 14px rgba(0,0,0,.04)' }}>
                <h2 style={{ fontSize:22, fontWeight:900, color:'#0f172a', marginBottom:12 }}>🆕 Yeni Eklenenler</h2>
                <div style={{ display:'flex', gap:16, overflowX:'auto', paddingBottom:6 }}>
                  {yeniEklenenler.map((p)=>(
                    <div key={p.id}
                      onClick={()=> gotoProduct(p.id, 'yeni')}
                      role="link" tabIndex={0}
                      onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') gotoProduct(p.id,'yeni'); }}
                      className="tap-safe"
                      style={{ minWidth:220, maxWidth:240, cursor:'pointer', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 10px' }}
                    >
                      <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"} alt={p.title}
                           style={{ width:'100%', height:110, objectFit:'cover', borderRadius:8, border:'1px solid #e5e7eb' }}/>
                      <div style={{ fontWeight:800, color:'#0f172a', marginTop:6, fontSize:15 }}>{p.title}</div>
                      <div style={{ fontWeight:700, marginTop:2, color:'#16a34a' }}>{p.indirimli_fiyat ? p.indirimli_fiyat : p.price} ₺</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* En Çok Görüntülenenler */}
            {cokGoruntulenenler.length > 0 && (
              <section id="trend" className="section-block" style={{ background:'#fff', borderRadius:18, padding:'22px 16px', marginBottom:28, border:'1.5px solid var(--border-200, #e2e8f0)', boxShadow:'0 2px 14px rgba(0,0,0,.04)' }}>
                <h2 style={{ fontSize:22, fontWeight:900, color:'#0f172a', marginBottom:12 }}>📈 En Çok Görüntülenenler</h2>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:16 }}>
                  {cokGoruntulenenler.map((p)=>(
                    <div key={p.id}
                      onClick={()=> gotoProduct(p.id, 'views')}
                      role="link" tabIndex={0}
                      onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') gotoProduct(p.id,'views'); }}
                      className="tap-safe"
                      style={{ cursor:'pointer', background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:12, padding:12, boxShadow:'0 2px 12px rgba(0,0,0,.03)' }}
                    >
                      <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"} alt={p.title}
                           style={{ width:'100%', height:130, objectFit:'cover', borderRadius:10, border:'1px solid #eef2f7' }}/>
                      <div style={{ fontWeight:800, color:'#0f172a', marginTop:6, fontSize:15 }}>{p.title}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, color:'#2563eb', fontWeight:800, marginTop:2 }}>
                        👀 {(p.views || 0).toLocaleString('tr-TR')}
                        <span style={{ marginLeft:'auto', color:'#16a34a' }}>{p.indirimli_fiyat ? p.indirimli_fiyat : p.price} ₺</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* EN POPÜLER */}
            {populerIlanlar.length > 0 && (
              <section className="section-block" style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1d8cf8', marginBottom: 12, letterSpacing: ".2px" }}>
                  ⭐ EN POPÜLER ÜRÜNLER
                </h2>
                <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 7 }}>
                  {populerIlanlar.map((product, idx) => (
                    <div key={idx}
                      onClick={()=> gotoProduct(product.id, 'populer')}
                      role="link" tabIndex={0}
                      onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') gotoProduct(product.id,'populer'); }}
                      className="tap-safe"
                      style={{
                        minWidth: 200, maxWidth: 220, background: "var(--surface-200, #f1f5f9)",
                        borderRadius: 13, boxShadow: "0 2px 13px #1d8cf80b", border: "1.5px solid var(--border, #e4e9ef)",
                        marginRight: 5, cursor: "pointer", padding: "13px 9px", position: "relative"
                      }}
                    >
                      <img src={Array.isArray(product.resim_url) ? product.resim_url[0] || "/placeholder.jpg" : product.resim_url || "/placeholder.jpg"}
                           alt={product.title}
                           style={{ width:"100%", height:92, objectFit:"cover", borderRadius:8, border:"1px solid var(--border-soft, #e0e7ef)" }}/>
                      <div style={{ fontWeight:700, fontSize:15, color:"var(--ink-900, #223555)", marginTop:5 }}>{product.title}</div>
                      <div style={{ color:"#f59e0b", fontWeight:600, fontSize:18 }}>
                        {renderStars(product.ortalamaPuan ?? 0)}
                        <span style={{ fontWeight:500, fontSize:14, color:"#64748b", marginLeft:5 }}>({(product.ortalamaPuan ?? 0).toFixed(1)})</span>
                      </div>
                      <div style={{ fontSize:16, fontWeight:600, color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "#ef4444" : "#16a34a", marginBottom:4 }}>
                        {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                          <>
                            <span style={{ textDecoration:"line-through", color:"#d1d5db", fontWeight:500, marginRight:7 }}>{product.price} ₺</span>
                            <span style={{ color:"#ef4444", fontWeight:700 }}>{product.indirimli_fiyat} ₺</span>
                          </>
                        ) : `${product.price} ₺`}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* POPÜLER & FIRSAT ÜRÜNLERİ */}
            <section className="section-block" style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--danger, #e11d48)', marginBottom: 8, letterSpacing: ".2px", display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{fontSize: 28, marginTop: -4}}>🔥</span>
                Ayın İndirimleri Başladı!
                <span style={{ background: "#22c55e", color: "#fff", borderRadius: 7, fontSize: 14, padding: "2px 12px", marginLeft: 8, fontWeight: 700 }}>
                  Haftanın Fırsatları
                </span>
              </h2>
              <p style={{ fontWeight: 600, fontSize: 15.5, color: '#444', marginBottom: 12, marginLeft: 3 }}>
                Sezonun en popüler ve indirimli ürünleri burada! Acele et, stoklar sınırlı.
              </p>
              <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 7 }}>
                {ilanlar.filter(x => x.indirimli_fiyat && x.indirimli_fiyat !== x.price).slice(0, 6).map((p, idx) => (
                  <div key={idx}
                    onClick={()=> gotoProduct(p.id, 'populer')}
                    role="link" tabIndex={0}
                    onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') gotoProduct(p.id,'populer'); }}
                    className="product-card discount tap-safe"
                    style={{ minWidth:200, maxWidth:220, background:"#fff6", borderRadius:13, boxShadow:"0 2px 13px #f871710b",
                             border:"1.5px solid var(--border, #e4e9ef)", marginRight:5, cursor:"pointer", padding:"13px 9px", position:"relative" }}
                  >
                    {p.indirimli_fiyat && (
                      <span style={{ position:"absolute", top:11, left:11, background:"#ef4444", color:"#fff", fontWeight:800, fontSize:12, borderRadius:7, padding:"2px 10px", boxShadow:"0 1px 5px #ef444415" }}>
                        İNDİRİMDE
                      </span>
                    )}
                    {idx < 3 && (
                      <span style={{ position:"absolute", top:11, right:11, background:"#f59e0b", color:"#fff", fontWeight:800, fontSize:12, borderRadius:7, padding:"2px 10px" }}>
                        Çok Satan
                      </span>
                    )}
                    <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                         alt={p.title}
                         style={{ width:"100%", height:92, objectFit:"cover", borderRadius:8, border:"1px solid #fde68a" }}/>
                    <div style={{ fontWeight:700, fontSize:15, color:"#e11d48", marginTop:5 }}>{p.title}</div>
                    <div style={{ fontWeight:700, fontSize:15, color:"#22c55e" }}>
                      {p.indirimli_fiyat ? (
                        <>
                          <span style={{ textDecoration:"line-through", color:"#d1d5db", fontWeight:600, marginRight:4 }}>{p.price}₺</span>
                          <span style={{ color:"#ef4444" }}>{p.indirimli_fiyat}₺</span>
                        </>
                      ) : `${p.price}₺`}
                    </div>
                    {p.stok && p.stok < 5 && (
                      <div style={{ color:"#e11d48", fontWeight:700, fontSize:13, marginTop:2 }}>
                        Son {p.stok} ürün!
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
            {/* Standart İlan Kartları */}
            <section className="section-block">
              <h2 style={{ fontSize: 23, fontWeight: 800, color: 'var(--ink-900, #223555)', marginBottom: 20 }}>
                {aktifKategori.ad === 'Tümü' ? 'Tüm İlanlar' : `${aktifKategori.ad} İlanları`}
              </h2>

              {normalIlanlar.length === 0 ? (
                <div style={{ background: 'var(--surface, #f8fafc)', padding: 40, textAlign: 'center', borderRadius: 13, color: 'var(--ink-500, #64748b)', fontWeight: 500, fontSize: 16 }}>
                  {aktifKategori.ad === 'Tümü' ? 'Henüz eklenmiş ilan yok.' : `${aktifKategori.ad} kategorisinde ilan bulunamadı.`}
                </div>
              ) : (
                <div className="ilanGrid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(235px, 1fr))', gap:23 }}>
                  {normalIlanlar.map((product) => {
                    const sepette = sepetteVarMi(product.id);
                    return (
                      <div
                        key={product.id}
                        className="tap-safe"
                        style={{
                          background: '#fff',
                          borderRadius: 15,
                          padding: 15,
                          boxShadow: '0 3px 16px var(--success, #16a34a)14',
                          transition: 'transform 0.16s',
                          cursor: 'pointer',
                          position: 'relative',
                          border: "1.5px solid var(--border, #e4e9ef)"
                        }}
                        onClick={() => gotoProduct(product.id, 'index2')}
                        onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') gotoProduct(product.id,'index2'); }}
                        role="link"
                        tabIndex={0}
                      >
                        {isYeni(product.created_at) && (
                          <span style={{ position: 'absolute', top: 13, left: 13, background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 8, padding: '4px 13px', boxShadow: '0 2px 8px #16a34a15', zIndex: 1 }}>
                            Yeni
                          </span>
                        )}

                        <span
                          onClick={e => { e.stopPropagation(); toggleFavori(product.id); }}
                          title={favoriler.includes(product.id) ? "Favorilerden çıkar" : "Favorilere ekle"}
                          style={{ position:'absolute', top:12, right:14, fontSize:22, color: favoriler.includes(product.id) ? "#fb8500" : "#bbb", cursor:'pointer', userSelect:'none', zIndex:2, transition:'color 0.2s' }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); e.stopPropagation(); toggleFavori(product.id); } }}
                        >
                          {favoriler.includes(product.id) ? "❤️" : "🤍"}
                        </span>

                        <img
                          src={Array.isArray(product.resim_url) ? product.resim_url[0] || '/placeholder.jpg' : product.resim_url || '/placeholder.jpg'}
                          alt={product.title}
                          style={{ width:'100%', height:155, objectFit:'cover', borderRadius:10, marginBottom:12, background:'#f0fdf4', border:"1px solid var(--border, #e4e9ef)" }}
                        />

                        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-800, #1e293b)', marginBottom: 6 }}>
                          {product.title}
                        </h3>

                        <FirmaBilgiSatiri email={product.user_email} firmaAdMap={firmaAdMap} onYorumClick={() => router.push(`/firma-yorumlar/${product.user_email}`)} />

                        <div style={{ fontSize:16, fontWeight:600, color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "#ef4444" : "#16a34a", marginBottom:4 }}>
                          {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
                            <>
                              <span style={{ textDecoration:"line-through", color:"#d1d5db", fontWeight:500, marginRight:7 }}>{product.price} ₺</span>
                              <span style={{ color:"#ef4444", fontWeight:700 }}>{product.indirimli_fiyat} ₺</span>
                            </>
                          ) : `${product.price} ₺`}
                        </div>

                        <span style={{ fontSize: 14, color: 'var(--ink-500, #64748b)' }}>{findKategoriAd(product.kategori_id)}</span>

                        {!sepette ? (
                          <button
                            className="tap-safe"
                            style={{ marginTop: 13, background: 'linear-gradient(90deg, var(--accent, #1bbd8a) 0%, var(--success, #16a34a) 90%)', color:'#fff', padding:'10px 0', borderRadius: 10, border:'none', fontWeight:700, fontSize:15, cursor:'pointer', width:'100%', boxShadow:'0 2px 8px #fb850022', letterSpacing:.5 }}
                            onClick={async e => { e.stopPropagation(); await sepeteEkle(product); }}
                          >
                            🛒 Sepete Ekle
                          </button>
                        ) : (
                          <button
                            className="tap-safe"
                            style={{ marginTop: 13, background: 'linear-gradient(90deg, #fb8500 0%, #ffbc38 80%)', color:'#fff', padding:'10px 0', borderRadius: 10, border:'none', fontWeight:700, fontSize:15, cursor:'pointer', width:'100%', boxShadow:'0 2px 8px #fb850022', letterSpacing:.5 }}
                            onClick={e => { e.stopPropagation(); sepeteGit(); }}
                          >
                            Sepete Git
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </main>

          {/* SAĞ REKLAM */}
          {!isAndroid && (
            <aside className="ads-right" style={{
              width: 150, minWidth: 100, maxWidth: 170, height: 280, background: 'var(--surface, #f8fafc)', padding: 13, borderRadius: 14,
              boxShadow: '0 4px 12px var(--primary, #2563eb)09', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'sticky', top: 92, zIndex: 10
            }}>
              <span style={{ marginBottom: 8, fontSize: 13, color: 'var(--slate-600, #475569)', fontWeight: 600, textAlign: 'center' }}>
                Sponsorlu Reklam
              </span>
              <img src="/300x250.png" alt="Reklam" style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover', boxShadow: '0 2px 9px var(--brand-700, #1648b0)18' }} />
            </aside>
          )}
        </div>

        {/* ===== Responsive ve mobil optimizasyonlar ===== */}
        <style jsx global>{`
  /* Güvenli alan */
  body { padding-bottom: env(safe-area-inset-bottom); }
  .pwa-header{ padding-top: env(safe-area-inset-top); min-height: calc(70px + env(safe-area-inset-top)); }
  .chip{ background:#fff; border:1px solid #e5e7eb; padding:4px 10px; border-radius:999px; font-weight:800; font-size:12px; color:#0f766e }

  /* Tap hedeflerini büyüt (mobil daha rahat) */
  .tap-safe{ touch-action: manipulation; -webkit-tap-highlight-color: transparent; }

  /* Tablet ve aşağısı */
  @media (max-width: 1024px) {
    .layout-3col { flex-direction: column !important; gap: 12px !important; padding: 0 !important; width: 100% !important; }
    .ads-left, .ads-right { display: none !important; }
    .ilanGrid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
    header input[type="text"] { width: 100% !important; max-width: none !important; }
  }

  /* Telefon */
  @media (max-width: 640px) {
    .header-left{ display:none !important; }
    .header-inner{ max-width: none !important; width: 100% !important; padding: 0 12px !important; grid-template-columns: 1fr !important; min-height:56px !important; }
    .header-middle{ width:100% !important; gap:8px !important; }
    .header-actions{ gap:8px !important; }
    .header-actions button{ padding:6px 10px !important; font-size:13px !important; }
    .main-col{ max-width: none !important; padding: 0 !important; }
    .main-col > section{ margin-left:0 !important; margin-right:0 !important; border-radius:0 !important; padding-left:16px !important; padding-right:16px !important; }
    .ilanGrid { grid-template-columns: 1fr !important; }
    .product-card img{ height:140px !important; object-fit:cover !important; }

    /* HERO hizalama ve başlık kırpma */
    .hero-grid{ grid-template-columns: 1fr !important; }
    .hero-title{ 
      font-size: clamp(18px, 5.4vw, 24px) !important;
      line-height: 1.2 !important;
      display: -webkit-box;
      -webkit-line-clamp: 2; /* en fazla 2 satır */
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  /* Çok küçük telefonlar: tek satıra sığdır, taşanı "..." yap */
  @media (max-width: 420px){
    .header-middle{ flex-direction: column !important; gap:8px !important; }
    .hero-title{
      -webkit-line-clamp: 1 !important;
      white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
      font-size: 17px !important;
    }
  }

  /* Orta telefon: 2 sütun gridler */
  @media (min-width: 481px) and (max-width: 640px){
    .featuredGrid, .ilanGrid{ grid-template-columns: repeat(2, minmax(0,1fr)) !important; gap:12px !important; }
  }

  /* Android özel dokunuşlar */
  .is-android .ads-left, .is-android .ads-right{ display:none !important; }
  .is-android .layout-3col{ display:block !important; max-width:none !important; }
  .is-android .main-col{ width:100% !important; max-width:none !important; padding:0 6px !important; }
  .is-android .main-col > .section-block{ padding:14px 8px !important; margin:0 0 16px !important; border-radius:10px !important; }
  .is-android .featuredGrid, .is-android .ilanGrid{ gap:12px !important; }
  .is-android .product-card img{ height:150px !important; object-fit:cover !important; border-radius:10px !important; }

  html, body { max-width: 100vw; overflow-x: hidden; }
  img, video { max-width: 100%; height: auto; display: block; }
        `}</style>
      </div>
      </div>
    </>
  );
};

export default Index2;
