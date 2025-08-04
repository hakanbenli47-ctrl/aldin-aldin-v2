import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  FiShoppingCart,
  FiSmartphone,
  FiHome,
  FiBook,
  FiUsers,
  FiBox,
  FiHeart,
  FiTag,
  FiMoreHorizontal
} from 'react-icons/fi';
import { FaCar, FaTshirt } from 'react-icons/fa';

// Kategoriler
const kategorilerUI = [
  { ad: 'Tümü', icon: null, color: '#1bbd8a' },
  { ad: 'Elektronik', icon: <FiSmartphone size={28} />, color: '#2563eb' },
  { ad: 'Araçlar', icon: <FaCar size={28} />, color: '#16a34a' },
  { ad: 'Moda', icon: <FaTshirt size={28} />, color: '#e11d48' },
  { ad: 'Ev & Yaşam', icon: <FiHome size={28} />, color: '#f97316' },
  { ad: 'Kitap & Hobi', icon: <FiBook size={28} />, color: '#7c3aed' },
  { ad: 'Spor & Outdoor', icon: <FiUsers size={28} />, color: '#1d8cf8' },
  { ad: 'Anne & Bebek', icon: <FiHeart size={28} />, color: '#22d3ee' },
  { ad: 'Evcil Hayvan', icon: <FiBox size={28} />, color: '#0ea5e9' },
  { ad: 'Kozmetik', icon: <FiTag size={28} />, color: '#f59e0b' },
  { ad: 'Diğer', icon: <FiMoreHorizontal size={28} />, color: '#334155' }
];

type Ilan = {
  id: number;
  title: string;
  desc: string;
  price: string;
  kategori_id: number;
  resim_url: string[] | null;
  stok?: number;
  created_at?: string;
  doped?: boolean;
  doped_expiration?: string;
  indirimli_fiyat?: string;
  views?: number;
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
  const [dbKategoriler, setDbKategoriler] = useState<Kategori[]>([]);
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dopedIlanlar, setDopedIlanlar] = useState<Ilan[]>([]);
  const [aktifKategori, setAktifKategori] = useState<{ ad: string; id?: number | null }>({
    ad: 'Tümü',
    id: undefined
  });
  const [favoriler, setFavoriler] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

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
      setIlanlar(ilanData || []);
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

  const findKategoriAd = (id: number | undefined) => {
    return dbKategoriler.find((k) => k.id === id)?.ad || '';
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

  const normalIlanlar = filteredIlanlar.filter((i) => !i.doped);

  // İndirimli ürünleri belirle
  const indirimliUrunler = ilanlar.filter(x => x.indirimli_fiyat && x.indirimli_fiyat !== x.price).slice(0, 5);

  // Görselliği mobile uygunlaştır
  if (loading) return <p style={{ textAlign: "center", padding: 40 }}>⏳ Yükleniyor...</p>;

  return (
    <>
      <Head>
        <title>Aldın Aldın - Alıcı</title>
        <meta name="description" content="Aldın Aldın Alıcı Sayfası" />
      </Head>
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(120deg, #f8fafc 0%, #eafcf6 100%)',
        }}
      >
        {/* HEADER */}
      <header
  style={{
    background: '#fff',
    boxShadow: '0 2px 14px #1648b005',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    borderBottom: '1.5px solid #e4e9ef',
    padding: 0
  }}
>
  <div
    style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: '0 18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 70,
    }}
  >
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 13, cursor: "pointer" }}
    >
      <Image src="/logo.png" alt="Aldın Aldın Logo" width={38} height={38} />
      <span style={{ fontWeight: 900, fontSize: 24, color: '#1648b0', letterSpacing: '.5px' }}>
        Aldın Aldın
      </span>
    </div>
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
      <input
        type="text"
        placeholder="🔍 Ürün ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          border: '1.5px solid #e2e8f0',
          borderRadius: 11,
          padding: '10px 21px',
          fontSize: 16,
          background: '#f8fafc',
          outline: 'none',
          color: '#223555',
          width: 340,
          boxShadow: '0 1px 10px #1bbd8a07',
          marginRight: 18,
        }}
      />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        onClick={sepeteGit}
        style={{
          position: "relative",
          cursor: "pointer",
          padding: 8,
          background: "#f8fafc",
          borderRadius: 9,
          boxShadow: "0 1px 7px #1bbd8a09",
          display: "flex",
          alignItems: "center"
        }}
        title="Sepetim"
      >
        <FiShoppingCart size={28} color="#1bbd8a" />
        {cartItems.length > 0 && (
          <span style={{
            position: "absolute",
            top: -4,
            right: -7,
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
            background: "#22c55e",
            borderRadius: 16,
            padding: "2px 7px",
            minWidth: 20,
            textAlign: "center",
            boxShadow: "0 1px 8px #16a34a22"
          }}>
            {cartItems.reduce((top, c) => top + (c.adet || 1), 0)}
          </span>
        )}
      </div>
      {!isLoggedIn ? (
        <>
          <button
            onClick={() => window.location.href = '/rol-secim'}
            style={{
              background: '#2563eb',
              color: '#fff',
              padding: '9px 20px',
              borderRadius: 11,
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 2px 10px #2563eb18'
            }}
          >
            Giriş Yap
          </button>
          <button
            onClick={() => window.location.href = '/kayit'}
            style={{
              background: '#1bbd8a',
              color: '#fff',
              padding: '9px 20px',
              borderRadius: 11,
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 2px 10px #1bbd8a18'
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
              background: '#f3f4f6',
              color: '#2563eb',
              border: '1px solid #2563eb22',
              padding: '9px 20px',
              borderRadius: 11,
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 7px #2563eb0a'
            }}
          >
            👤 Profilim
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: '#e11d48',
              color: '#fff',
              padding: '9px 22px',
              borderRadius: 11,
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 2px 10px #e11d4811'
            }}
          >
            Çıkış Yap
          </button>
        </>
      )}
    </div>
  </div>
</header>

        {/* Responsive kategori alanı */}
        <div style={{
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "30px 0 16px 0",
          overflowX: "auto",
        }}>
          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              padding: "0 18px",
              overflowX: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {kategorilerUI.map((kat, idx) => (
              <div
                key={idx}
                onClick={() => {
                  const normalize = (str: string) =>
                    str.replace(/\s+/g, '').toLowerCase();
                  const dbKat = dbKategoriler.find(
                    (k) => normalize(k.ad) === normalize(kat.ad)
                  );
                  setAktifKategori({
                    ad: kat.ad,
                    id: dbKat?.id ?? undefined
                  });
                }}
                style={{
                  background:
                    aktifKategori.ad === kat.ad ? kat.color : '#f5f7fa',
                  color:
                    aktifKategori.ad === kat.ad ? '#fff' : '#223555',
                  borderRadius: 16,
                  padding: '15px 20px',
                  minWidth: 112,
                  textAlign: 'center',
                  boxShadow:
                    aktifKategori.ad === kat.ad
                      ? '0 8px 24px #1bbd8a22'
                      : '0 2px 9px #2563eb06',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: 0.5,
                  display: 'flex',
                  alignItems: "center",
                  gap: 10,
                  border: aktifKategori.ad === kat.ad ? "2px solid #e2e8f0" : "1.5px solid #e7e9ef",
                  transition: 'all 0.17s',
                  userSelect: "none"
                }}
              >
                {kat.icon}
                {kat.ad}
              </div>
            ))}
          </div>
        </div>

        {/* Layout: Sol reklam, ana, sağ reklam */}
        <div
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
          <aside
            style={{
              width: 150,
              minWidth: 100,
              maxWidth: 170,
              height: 280,
              background: '#f8fafc',
              padding: 13,
              borderRadius: 14,
              boxShadow: '0 4px 12px #2563eb09',
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
                color: '#475569',
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
                boxShadow: '0 2px 9px #1648b018'
              }}
            />
          </aside>

          {/* ANA İÇERİK */}
          <main style={{
            maxWidth: 950,
            width: "100%",
            padding: '0 10px',
            flexGrow: 1,
          }}>
            {/* POPÜLER & FIRSAT ÜRÜNLERİ */}
            <section style={{ marginBottom: 32 }}>
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
                  background: "#22c55e",
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
                  <div key={idx}
                    style={{
                      minWidth: 200,
                      maxWidth: 220,
                      background: "#fff6",
                      borderRadius: 13,
                      boxShadow: "0 2px 13px #f871710b",
                      border: "1.5px solid #e4e9ef",
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
                        background: "#ef4444", color: "#fff",
                        fontWeight: 800, fontSize: 12, borderRadius: 7, padding: "2px 10px", boxShadow: "0 1px 5px #ef444415"
                      }}>İNDİRİMDE</span>}

                    {/* ÇOK SATAN ROZETİ */}
                    {idx < 3 &&
                      <span style={{
                        position: "absolute", top: 11, right: 11,
                        background: "#f59e0b", color: "#fff", fontWeight: 800,
                        fontSize: 12, borderRadius: 7, padding: "2px 10px"
                      }}>Çok Satan</span>}

                    <img src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                      alt={p.title}
                      style={{
                        width: "100%",
                        height: 92,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #fde68a"
                      }} />
                    <div style={{
                      fontWeight: 700, fontSize: 15,
                      color: "#e11d48", marginTop: 5
                    }}>{p.title}</div>
                    <div style={{
                      fontWeight: 700, fontSize: 15, color: "#22c55e"
                    }}>
                      {p.indirimli_fiyat ?
                        <>
                          <span style={{ textDecoration: "line-through", color: "#d1d5db", fontWeight: 600, marginRight: 4 }}>
                            {p.price}₺
                          </span>
                          <span style={{ color: "#ef4444" }}>{p.indirimli_fiyat}₺</span>
                        </>
                        : `${p.price}₺`}
                    </div>
                    {/* Stok azaldı badge örneği */}
                    {p.stok && p.stok < 5 &&
                      <div style={{
                        color: "#e11d48", fontWeight: 700, fontSize: 13, marginTop: 2
                      }}>
                        Son {p.stok} ürün!
                      </div>
                    }
                  </div>
                ))}
              </div>
            </section>

            {/* ÖNE ÇIKANLAR */}
            <section
              style={{
                background: '#fff',
                padding: '30px 24px',
                borderRadius: 18,
                marginBottom: 42,
                boxShadow: '0 4px 22px #f59e0b09',
                border: '1.5px solid #e2e8f0'
              }}
            >
              <h2
                style={{
                  fontSize: 23,
                  fontWeight: 800,
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
                    background: '#fef9c3',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: '#92400e',
                    fontWeight: 500,
                    fontSize: 16
                  }}
                >
                  Şu anda öne çıkarılan bir ilan yok.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(235px, 1fr))',
                    gap: 23
                  }}
                >
                  {dopedIlanlar.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        background: '#fef08a',
                        borderRadius: 15,
                        padding: 15,
                        boxShadow: '0 4px 17px #eab30817',
                        transition: 'transform 0.15s, box-shadow 0.18s',
                        cursor: 'pointer',
                        border: "1.5px solid #fbe192"
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
                          fontWeight: 700,
                          color: '#78350f',
                          marginBottom: 6
                        }}
                      >
                        {product.title}
                      </h3>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: '#b45309',
                          marginBottom: 4
                        }}
                      >
                        {product.price} ₺
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

            {/* Standart İlan Kartları */}
            <section>
              <h2
                style={{
                  fontSize: 23,
                  fontWeight: 800,
                  color: '#223555',
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
                    background: '#f8fafc',
                    padding: 40,
                    textAlign: 'center',
                    borderRadius: 13,
                    color: '#64748b',
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
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(235px, 1fr))',
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
                          boxShadow: '0 3px 16px #16a34a14',
                          transition: 'transform 0.16s',
                          cursor: 'pointer',
                          position: 'relative',
                          border: "1.5px solid #e4e9ef"
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
                              background: '#16a34a',
                              color: '#fff',
                              fontWeight: 800,
                              fontSize: 13,
                              borderRadius: 8,
                              padding: '4px 13px',
                              boxShadow: '0 2px 8px #16a34a15',
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
                            border: "1px solid #e4e9ef"
                          }}
                        />
                        <h3
                          style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: '#1e293b',
                            marginBottom: 6
                          }}
                        >
                          {product.title}
                        </h3>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: '#16a34a',
                            marginBottom: 4
                          }}
                        >
                          {product.price} ₺
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
                              background: 'linear-gradient(90deg, #1bbd8a 0%, #16a34a 90%)',
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
                              background: 'linear-gradient(90deg, #fb8500 0%, #ffbc38 80%)',
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
          <aside
            style={{
              width: 150,
              minWidth: 100,
              maxWidth: 170,
              height: 280,
              background: '#f8fafc',
              padding: 13,
              borderRadius: 14,
              boxShadow: '0 4px 12px #2563eb09',
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
                color: '#475569',
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
                boxShadow: '0 2px 9px #1648b018'
              }}
            />
          </aside>
        </div>
        {/* Responsive düzen için */}
        <style jsx global>{`
          @media (max-width: 900px) {
            aside { display: none !important; }
            main { padding: 0 1vw !important; }
          }
          @media (max-width: 700px) {
            .ilanGrid { grid-template-columns: 1fr !important; }
            .kategoriGrid { grid-template-columns: 1fr 1fr !important; }
            .kategori-scroll { flex-wrap: wrap !important; }
          }
          @media (max-width: 500px) {
            header, .footer, aside, main, .ilanGrid { max-width: 99vw !important; }
          }
        `}</style>
        {/* FOOTER */}
        <footer
          style={{
            background: '#f3f4f6',
            padding: 24,
            marginTop: 64,
            textAlign: 'center',
            color: '#64748b',
            fontWeight: 500,
            letterSpacing: 0.2
          }}
        >
          © 2025 Aldın Aldın. Tüm hakları saklıdır.
        </footer>
      </div>
    </>
  );
};

export default Index2;
