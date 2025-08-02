import ReklamFormModal from '../components/ReklamFormModal';
import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FiShoppingCart, FiSmartphone, FiHome, FiBook, FiUsers, FiBox, FiHeart, FiTag, FiMoreHorizontal } from 'react-icons/fi';
import { FaCar, FaTshirt } from 'react-icons/fa';

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

const Home: NextPage = () => {
  
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
const [reklamModalOpen, setReklamModalOpen] = useState(false);
  useEffect(() => {
    async function fetchUserAndCart() {
      const { data: userData } = await supabase.auth.getUser();
      const userRole = userData?.user?.role || null;

      setIsLoggedIn(!!userData?.user);
      setUser(userData?.user || null);

      if (userData?.user) {
        if (userRole === "satici") {
          window.location.href = "/index2";
          return;
        }
        const { data: cartData } = await supabase
          .from("cart")
          .select("id, adet, product_id")
          .eq("user_id", userData.user.id);
        setCartItems(cartData || []);
      } else {
        setCartItems([]);
      }
    }
    fetchUserAndCart();
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
    window.location.href = '/sepet';
  };

  const toggleFavori = (id: number) => {
    setFavoriler(favs =>
      favs.includes(id) ? favs.filter(fid => fid !== id) : [...favs, id]
    );
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUser(null);
    window.location.href = '/';
  };

  const findKategoriAd = (id: number | undefined) => {
    return dbKategoriler.find((k) => k.id === id)?.ad || '';
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

  return (
    <>
      <Head>
        <title>Aldın Aldın</title>
        <meta name="description" content="Aldın Aldın: İkinci el ve sıfır ürünleri keşfet!" />
      </Head>
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e6f3f1 100%)',
        }}
      >
        {/* HEADER */}
        <header
          style={{
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            position: 'sticky',
            top: 0,
            zIndex: 999,
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              padding: '20px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Image src="/logo.png" alt="Aldın Aldın Logo" width={40} height={40} />
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a', letterSpacing: 1, cursor: 'pointer' }}
                onClick={() => window.location.href = '/'}
              >
                Aldın Aldın
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input
                type="text"
                placeholder="🔍 Ürün ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '8px 18px',
                  fontSize: 15,
                  background: '#f8fafc',
                  outline: 'none',
                  color: '#1a1a1a',
                  width: 220,
                  boxShadow: '0 2px 10px #1bbd8a07'
                }}
              />

              {/* SEPET İKONU */}
              <div
                onClick={sepeteGit}
                style={{
                  position: "relative",
                  cursor: "pointer",
                  padding: 6,
                  background: "#f8fafc",
                  borderRadius: 8,
                  boxShadow: "0 1px 6px #1bbd8a08",
                  display: "flex",
                  alignItems: "center"
                }}
                title="Sepetim"
              >
                <FiShoppingCart size={26} color="#1bbd8a" />
                {cartItems.length > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#fff",
                    background: "#22c55e",
                    borderRadius: 16,
                    padding: "2px 7px",
                    minWidth: 20,
                    textAlign: "center"
                  }}>
                    {cartItems.reduce((top, c) => top + (c.adet || 1), 0)}
                  </span>
                )}
              </div>

              {isLoggedIn ? (
                <>
                  <button
                    onClick={() => (window.location.href = '/profil')}
                    style={{
                      background: '#f3f4f6',
                      color: '#2563eb',
                      border: '1px solid #2563eb22',
                      padding: '9px 18px',
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 1px 6px #2563eb09'
                    }}
                  >
                    👤 Hesabım
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{
                      background: '#e11d48',
                      color: '#fff',
                      padding: '9px 20px',
                      borderRadius: 10,
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px #e11d4811'
                    }}
                  >
                    Çıkış Yap
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => window.location.href = '/rol-secim'}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      padding: '9px 20px',
                      borderRadius: 10,
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
                    onClick={() => (window.location.href = '/kayit')}
                    style={{
                      background: '#1bbd8a',
                      color: '#fff',
                      padding: '9px 20px',
                      borderRadius: 10,
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
              )}
            </div>
          </div>
        </header>

        {/* RESPONSIVE STYLE */}
        <style jsx global>{`
          @media (max-width: 900px) {
            aside { display: none !important; }
            main { padding: 0 3vw !important; }
          }
          @media (max-width: 600px) {
            .kategoriGrid { grid-template-columns: 1fr 1fr !important; }
            .ilanGrid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <div
          style={{
            display: 'flex',
            width: '100%',
            maxWidth: 1440,
            margin: '0 auto',
            position: 'relative',
            gap: 16
          }}
        >
          {/* SOL REKLAM */}
          <aside
            style={{
              width: 160,
              minWidth: 140,
              maxWidth: 170,
              height: 300,
              background: '#f8fafc',
              padding: 12,
              borderRadius: 12,
              boxShadow: '0 4px 12px #2563eb07',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'sticky',
              top: 80,
              zIndex: 10
            }} onClick={() => setReklamModalOpen(true)}
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
              Reklam Vermek İçin Tıklayın
            </span>
            <img
              src="/300x250.png"
              alt="Reklam"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 10,
                objectFit: 'cover',
                boxShadow: '0 3px 8px #2563eb14'
              }}
            />
          </aside>

          {/* ANA İÇERİK */}
          <main style={{ maxWidth: 1100, padding: '0 20px', flexGrow: 1 }}>
            {/* KATEGORİLER */}
            <section style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: '#223555',
                  marginBottom: 20
                }}
              >
                Kategorileri Keşfet
              </h2>
              <div
                className="kategoriGrid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 20
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
                        aktifKategori.ad === kat.ad ? kat.color : '#fff',
                      color:
                        aktifKategori.ad === kat.ad ? '#fff' : '#223555',
                      borderRadius: 20,
                      padding: '20px 10px',
                      textAlign: 'center',
                      boxShadow:
                        aktifKategori.ad === kat.ad
                          ? '0 8px 22px #1bbd8a28'
                          : '0 2px 8px #2563eb08',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        margin: '0 auto 12px',
                        borderRadius: '50%',
                        background:
                          aktifKategori.ad === kat.ad
                            ? '#ffffff33'
                            : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28
                      }}
                    >
                      {kat.icon}
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        letterSpacing: 0.4
                      }}
                    >
                      {kat.ad}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ÖNE ÇIKANLAR */}
            <section
              style={{
                background: '#fff',
                padding: '30px 24px',
                borderRadius: 16,
                marginBottom: 48,
                boxShadow: '0 4px 14px #f59e0b11',
                border: '1px solid #e2e8f0'
              }}
            >
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: '#b45309',
                  marginBottom: 20
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
                    borderRadius: 12,
                    color: '#92400e',
                    fontWeight: 500
                  }}
                >
                  Şu anda öne çıkarılan bir ilan yok.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 20
                  }}
                >
                  {dopedIlanlar.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        background: '#fef08a',
                        borderRadius: 16,
                        padding: 15,
                        boxShadow: '0 3px 14px #eab30818',
                        transition: 'transform 0.2s',
                        cursor: 'pointer'
                      }}
                      // GÜNCELLENEN SATIR ↓↓↓↓↓
                      onClick={() => window.location.href = `/urun/${product.id}?from=index`}
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
                          marginBottom: 12
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

            {/* İLAN KARTLARI */}
            <section>
              <h2
                style={{
                  fontSize: 24,
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
                    borderRadius: 12,
                    color: '#64748b',
                    fontWeight: 500
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
                      'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 20
                  }}
                >
                  {normalIlanlar.map((product) => {
                    const sepette = sepetteVarMi(product.id);

                    return (
                      <div
                        key={product.id}
                        style={{
                          background: '#fff',
                          borderRadius: 16,
                          padding: 15,
                          boxShadow: '0 3px 13px #16a34a0f',
                          transition: 'transform 0.2s',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        // GÜNCELLENEN SATIR ↓↓↓↓↓
                        onClick={() => window.location.href = `/urun/${product.id}?from=index`}
                      >
                        {/* YENİ ETİKETİ */}
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

                        {/* FAVORİ KALP */}
                        <span
                          onClick={() => toggleFavori(product.id)}
                          title={favoriler.includes(product.id) ? "Favorilerden çıkar" : "Favorilere ekle"}
                          style={{
                            position: 'absolute',
                            top: 12, right: 14,
                            fontSize: 23,
                            color: favoriler.includes(product.id) ? "#fb8500" : "#bbb",
                            cursor: 'pointer',
                            userSelect: 'none',
                            zIndex: 2,
                            transition: 'color 0.22s'
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
                            height: 160,
                            objectFit: 'cover',
                            borderRadius: 10,
                            marginBottom: 12,
                            background: '#f0fdf4'
                          }}
                        />
                        <h3
                          style={{
                            fontSize: 18,
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

                        {/* Sepete Ekle veya Sepete Git */}
                        {!sepette ? (
                          <button
                            style={{
                              marginTop: 12,
                              background: 'linear-gradient(90deg, #1bbd8a 0%, #16a34a 80%)',
                              color: '#fff',
                              padding: '9px 0',
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
                              marginTop: 12,
                              background: 'linear-gradient(90deg, #fb8500 0%, #ffbc38 80%)',
                              color: '#fff',
                              padding: '9px 0',
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
              width: 160,
              minWidth: 140,
              maxWidth: 170,
              height: 300,
              background: '#f8fafc',
              padding: 12,
              borderRadius: 12,
              boxShadow: '0 4px 12px #2563eb07',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'sticky',
              top: 80,
              zIndex: 10
            }}  onClick={() => setReklamModalOpen(true)}
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
             Reklam Vermek İçin Tıklayın
            </span>
            <img
              src="/300x250.png"
              alt="Reklam"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 10,
                objectFit: 'cover',
                boxShadow: '0 3px 8px #2563eb14'
              }}
            />
          </aside>
        </div>
<ReklamFormModal open={reklamModalOpen} onClose={() => setReklamModalOpen(false)} />
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

export default Home;
