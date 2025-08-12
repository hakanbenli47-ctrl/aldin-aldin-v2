
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
import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import React, { ReactNode } from 'react';
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
} 
from 'react-icons/fi';
import { FaCar } from 'react-icons/fa';
// ad’a göre icon ataması
const iconMap: Record<string, ReactNode> = {
  'Tümü': null,
  'Elektronik': <FiSmartphone size={28} />,
  'Araçlar':     <FaCar size={28} />,
  'Giyim':       <FiMoreHorizontal size={20}/>,
  'Ev Eşyaları':         <FiMoreHorizontal size={20}/>,
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

const Index2: NextPage = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
 const [firmaAdMap, setFirmaAdMap] = useState<Record<string, FirmaInfo>>({});
  const [dbKategoriler, setDbKategoriler] = useState<Kategori[]>([]);
  const [populerIlanlar, setPopulerIlanlar] = useState<Ilan[]>([]);
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState('');
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
}, [kategori, dbKategoriler])
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

    const { data: ilanData } = await supabase.from('ilan').select('*');
    const ilanlarWithAvg = await ilanlaraOrtalamaPuanEkle(ilanData || []);
    setIlanlar(ilanlarWithAvg);

    // --- BURASI YENİ EKLENDİ ---
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

  const sepeteEkle = async (urun: Ilan) => {
    if (!isLoggedIn || !user) {
      alert("Lütfen giriş yapınız!");
      window.location.href = "/giris";
      return;
    }

    const sepette = sepetteVarMi(urun.id);
    if (sepette) {
      await supabase
        .from("cart")
        .update({ adet: sepette.adet + 1 })
        .eq("id", sepette.id);
    } else {
      await supabase
        .from("cart")
        .insert([{ user_id: user.id, product_id: urun.id, adet: 1 }]);
    }
    const { data: cartData } = await supabase
      .from("cart")
      .select("id, adet, product_id")
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

  const filteredIlanlar = ilanlar.filter((i) => {
    const baslik = (i.title || '').toLowerCase();
    const aciklama = (i.desc || '').toLowerCase();
    const searchLower = search.toLowerCase();
    if (!aktifKategori.id) {
      if (aktifKategori.ad !== 'Tümü') return false;
      return baslik.includes(searchLower) || aciklama.includes(searchLower);
    }
    return (
      i.kategori_id === aktifKategori.id &&
      (baslik.includes(searchLower) || aciklama.includes(searchLower))
    );
  });

  const normalIlanlar = filteredIlanlar;


  // İndirimli ürünleri belirle
  const indirimliUrunler = ilanlar.filter(x => x.indirimli_fiyat && x.indirimli_fiyat !== x.price).slice(0, 5);

  // Görselliği mobile uygunlaştır
  if (loading) return <p style={{ textAlign: "center", padding: 40 }}>⏳ Yükleniyor...</p>;

  return (
    <>
      <Head>
        <title>Aldın Aldın - Alıcı</title>
        <meta name="description" content="Aldın Aldın Alıcı Sayfası" />
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

    {/* MIDDLE: Categories + Search (fills space on mobile) */}
    <div className="header-middle" style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
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
            fontSize: 14,
            padding: '8px 12px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            outline: 'none',
            transition: 'all .19s cubic-bezier(.55,.01,.48,1.05)',
            position: 'relative'
          }}
        >
          <FiTag size={18} />
          <span style={{ fontWeight:800, letterSpacing:'.4px' }}>Kategoriler</span>
          <FiChevronDown size={16} style={{ transform: dropdownOpen ? 'rotate(-180deg)' : 'none' }} />
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

      {/* Search input fills remaining space */}
      <input
        type="text"
        placeholder="🔍 Ürün ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          flex: 1,
          border: '1.5px solid var(--border-200, #e2e8f0)',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 16,
          background: 'var(--surface, #f8fafc)',
          outline: 'none',
          color: 'var(--ink-900, #223555)',
          minWidth: 0
        }}
      />
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
        <FiShoppingCart size={26} color="var(--accent, #1bbd8a)" />
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
          <button
            onClick={() => window.location.href = '/giris'}
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
          <button
            onClick={() => window.location.href = '/kayit'}
            style={{
              background: 'var(--accent, #1bbd8a)',
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
                border: '1.5px solid var(--border-200, #e2e8f0)'
              }}
            >
              <h2
                style={{
                  fontSize: 23,
                  fontWeight: 800,
                  color: 'var(--amber-700, #b45309)',
                  marginBottom: 20,
                  letterSpacing: ".2px"
                }}
              >
                🚀 Öne Çıkanlar
              </h2>
              {dopedIlanlar.length === 0 ? (
                <div
                  style={{
                    background: 'var(--note-bg, #fef9c3)',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: 'var(--note-fg, #92400e)',
                    fontWeight: 500,
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
                        background: 'var(--highlight, #fef08a)',
                        borderRadius: 15,
                        padding: 15,
                        boxShadow: '0 4px 17px var(--highlight-600, #eab308)17',
                        transition: 'transform 0.15s, box-shadow 0.18s',
                        cursor: 'pointer',
                        border: "1.5px solid var(--highlight-border, #fbe192)"
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
                          border: "1.5px solid var(--highlight-img-border, #fae27a)"
                        }}
                      />
                      <h3
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: 'var(--amber-900, #78350f)',
                          marginBottom: 6
                        }}
                      >
                        {product.title}
                      </h3>
                      <FirmaBilgiSatiri
  email={product.user_email}
  firmaAdMap={firmaAdMap}
  onYorumClick={() => window.location.href = `/firma-yorumlar/${product.user_email}`}
/>{product.ortalamaPuan !== undefined && (
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
    fontWeight: 600,
    color: product.indirimli_fiyat ? "var(--price-discount, #ef4444)" : "var(--success, #16a34a)",
    marginBottom: 4
  }}
>
  {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
    <>
      <span style={{
        textDecoration: "line-through",
        color: "var(--ink-300, #d1d5db)",
        fontWeight: 500,
        marginRight: 7
      }}>
        {product.price} ₺
      </span>
      <span style={{ color: "var(--price-discount, #ef4444)", fontWeight: 700 }}>
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
            border: "1.5px solid var(--border, #e4e9ef)",
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
              border: "1px solid var(--border-soft, #e0e7ef)"
            }} />
          <div style={{
            fontWeight: 700, fontSize: 15,
            color: "var(--ink-900, #223555)", marginTop: 5
          }}>{product.title}</div>
          {/* Ortalama yıldız */}
          <div style={{
            color: "var(--warning, #f59e0b)", fontWeight: 600, fontSize: 18
          }}>
            {renderStars(product.ortalamaPuan ?? 0)}
            <span style={{ fontWeight: 500, fontSize: 14, color: "var(--ink-500, #64748b)", marginLeft: 5 }}>
              ({(product.ortalamaPuan ?? 0).toFixed(1)})
            </span>
          </div>
          {/* Fiyat (indirimli ise aynı mantıkla göster) */}
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "var(--price-discount, #ef4444)" : "var(--success, #16a34a)",
            marginBottom: 4
          }}>
            {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
              <>
                <span style={{
                  textDecoration: "line-through",
                  color: "var(--ink-300, #d1d5db)",
                  fontWeight: 500,
                  marginRight: 7
                }}>
                  {product.price} ₺
                </span>
                <span style={{ color: "var(--price-discount, #ef4444)", fontWeight: 700 }}>
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
              <p style={{
                fontWeight: 600,
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
                      border: "1.5px solid var(--border, #e4e9ef)",
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
                        background: "var(--price-discount, #ef4444)", color: "#fff",
                        fontWeight: 800, fontSize: 12, borderRadius: 7, padding: "2px 10px", boxShadow: "0 1px 5px var(--price-discount, #ef4444)15"
                      }}>İNDİRİMDE</span>}

                    {/* ÇOK SATAN ROZETİ */}
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
                    <div style={{
                      fontWeight: 700, fontSize: 15,
                      color: "var(--danger, #e11d48)", marginTop: 5
                    }}>{p.title}</div>
                    <div style={{
                      fontWeight: 700, fontSize: 15, color: "var(--success-500, #22c55e)"
                    }}>
                      {p.indirimli_fiyat ?
                        <>
                          <span style={{ textDecoration: "line-through", color: "var(--ink-300, #d1d5db)", fontWeight: 600, marginRight: 4 }}>
                            {p.price}₺
                          </span>
                          <span style={{ color: "var(--price-discount, #ef4444)" }}>{p.indirimli_fiyat}₺</span>
                        </>
                        : `${p.price}₺`}
                    </div>
                    {/* Stok azaldı badge örneği */}
                    {p.stok && p.stok < 5 &&
                      <div style={{
                        color: "var(--danger, #e11d48)", fontWeight: 700, fontSize: 13, marginTop: 2
                      }}>
                        Son {p.stok} ürün!
                      </div>
                    }
                  </div>
                ))}
              </div>
            </section>

          
            {/* Standart İlan Kartları */}
            <section className="section-block">
              <h2
                style={{
                  fontSize: 23,
                  fontWeight: 800,
                  color: 'var(--ink-900, #223555)',
                  marginBottom: 20
                }}
              >
                {aktifKategori.ad === 'Tümü'
                  ? 'Tüm İlanlar'
                  : `${aktifKategori.ad} İlanları`}
              </h2>
              {normalIlanlar.length === 0 ? (
                <div
                  style={{
                    background: 'var(--surface, #f8fafc)',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: 'var(--ink-500, #64748b)',
                    fontWeight: 500,
                    fontSize: 16
                  }}
                >
                  {aktifKategori.ad === 'Tümü'
                    ? 'Henüz eklenmiş ilan yok.'
                    : `${aktifKategori.ad} kategorisinde ilan bulunamadı.`}
                </div>
              ) : (
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
                          boxShadow: '0 3px 16px var(--success, #16a34a)14',
                          transition: 'transform 0.16s',
                          cursor: 'pointer',
                          position: 'relative',
                          border: "1.5px solid var(--border, #e4e9ef)"
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
                              background: 'var(--success, #16a34a)',
                              color: '#fff',
                              fontWeight: 800,
                              fontSize: 13,
                              borderRadius: 8,
                              padding: '4px 13px',
                              boxShadow: '0 2px 8px var(--success, #16a34a)15',
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
                            color: favoriler.includes(product.id) ? "var(--attention, #fb8500)" : "#bbb",
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
                            border: "1px solid var(--border, #e4e9ef)"
                          }}
                        />
                        <h3
                          style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: 'var(--ink-800, #1e293b)',
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
    fontWeight: 600,
    color: product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? "var(--price-discount, #ef4444)" : "var(--success, #16a34a)",
    marginBottom: 4
  }}
>
  {product.indirimli_fiyat && product.indirimli_fiyat !== product.price ? (
    <>
      <span style={{
        textDecoration: "line-through",
        color: "var(--ink-300, #d1d5db)",
        fontWeight: 500,
        marginRight: 7
      }}>
        {product.price} ₺
      </span>
      <span style={{ color: "var(--price-discount, #ef4444)", fontWeight: 700 }}>
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
                            color: 'var(--ink-500, #64748b)'
                          }}
                        >
                          {findKategoriAd(product.kategori_id)}
                        </span>
                        {!sepette ? (
                          <button
                            style={{
                              marginTop: 13,
                              background: 'linear-gradient(90deg, var(--accent, #1bbd8a) 0%, var(--success, #16a34a) 90%)',
                              color: '#fff',
                              padding: '10px 0',
                              borderRadius: 10,
                              border: 'none',
                              fontWeight: 700,
                              fontSize: 15,
                              cursor: 'pointer',
                              width: '100%',
                              boxShadow: '0 2px 8px var(--attention, #fb8500)22',
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
                              background: 'linear-gradient(90deg, var(--attention, #fb8500) 0%, var(--attention-300, #ffbc38) 80%)',
                              color: '#fff',
                              padding: '10px 0',
                              borderRadius: 10,
                              border: 'none',
                              fontWeight: 700,
                              fontSize: 15,
                              cursor: 'pointer',
                              width: '100%',
                              boxShadow: '0 2px 8px var(--attention, #fb8500)22',
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
              )}
            </section>
          </main>

          {/* SAĞ REKLAM */}
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
        </div>

        {/* Responsive düzen için */}

<style jsx global>{`
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
    /* Header iç divini kenardan kenara yap */
    .header-inner{
      max-width: none !important;
      width: 100% !important;
      padding: 0 12px !important;
    }

    /* Ana kolon: kenar boşluklarını kaldır, full-bleed */
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

    /* Grid: 1 sütun */
    .ilanGrid { grid-template-columns: 1fr !important; }
  }
    /* Genel güvenlik bandı */
html, body { max-width: 100vw; overflow-x: hidden; }
img, video { max-width: 100%; height: auto; display: block; }

/* Tablet ve telefon (<=1024px): masaüstü zorlamasını iptal et,
   reklam kolonlarını gizle, ana kolon tam genişlik olsun */
@media (max-width: 1024px){
  .force-desktop{           /* varsa masaüstü sabitlemesini burada kırıyoruz */
    width:100% !important;
    max-width:none !important;
    min-width:0 !important;
    transform:none !important; /* bazı temalarda ölçek/zoom olabiliyor */
  }

  .layout-3col{
    display:block !important;
    max-width:none !important;
  }

  .ads-left, .ads-right{ display:none !important; }

  .main-col{
    width:100% !important;
    max-width:none !important;
    padding:0 10px !important;
  }

  /* kart ızgaraları 2 sütuna düşsün (sende hangisi varsa çalışır) */
  .featuredGrid,
  .ilanGrid,
  .products,
  .cards{
    grid-template-columns:repeat(2, minmax(0,1fr)) !important;
    gap:12px !important;
  }
}

/* Küçük telefon (<=640px): header tek kolona, grid 1 sütun */
@media (max-width: 640px){
  .header-inner{ grid-template-columns:1fr !important; row-gap:8px; }
  .header-middle, .searchBar{ width:100% !important; }

  .featuredGrid,
  .ilanGrid,
  .products,
  .cards{
    grid-template-columns:1fr !important;
  }

  .product-card.standard{ padding:10px !important; }
}

`}</style>
      </div></div>
    </>
  );
};

export default Index2;
