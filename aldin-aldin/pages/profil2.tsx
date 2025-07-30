import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabaseClient";

export default function Profil2() {
  const [selectedMenu, setSelectedMenu] = useState("siparislerim");
  const [favoriIlanlar, setFavoriIlanlar] = useState<any[]>([]);
  const [loadingFavoriler, setLoadingFavoriler] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Örnek email, bunu supabase’den gerçek kullanıcıdan almalısın
  const userEmail = "hakanbenli47@gmail.com";

  // Menü öğeleri ("Önceden Gezdiklerim" yerine "Favori İlanlar")
  const menuItems = [
    { id: "siparislerim", label: "Siparişlerim" },
    { id: "degerlendirmelerim", label: "Değerlendirmelerim" },
    { id: "saticiMesajlarim", label: "Satıcı Mesajlarım" },
    { id: "tekrarSatinAl", label: "Tekrar Satın Al" }
  ];

  const specialItems = [
    { id: "indirimKuponlarim", label: "İndirim Kuponlarım" },
    { id: "favoriIlanlar", label: "Favori İlanlar" }, // Değişiklik burada
    { id: "takipEttigimMagazalar", label: "Takip Ettiğim Mağazalar" },
    { id: "trendyolElite", label: "Trendyol Elite" }
  ];

  const servicesItems = [
    { id: "krediler", label: "Krediler", badge: "%0 Faiz Fırsatı" },
    { id: "sansliCekilis", label: "Şanslı Çekiliş", badge: "YENİ" },
    { id: "qnbTrendyol", label: "QNB Trendyol", badge: "YENİ" }
  ];

  const accountHelpItems = [
    { id: "hesapBilgilerim", label: "Hesap Bilgilerim" },
    { id: "guvenlikAyarlarim", label: "Güvenlik Ayarlarım" },
    { id: "yardim", label: "Yardım" }
  ];

  // Kullanıcıyı ve favori ilanları yükle
  useEffect(() => {
    async function fetchUserAndFavorites() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);

      if (userData?.user) {
        setLoadingFavoriler(true);
        const userId = userData.user.id;

        // Favori ilanların ilan_id’lerini çek
        const { data: favoriData, error: favError } = await supabase
          .from("favoriler")
          .select("ilan_id")
          .eq("user_id", userId);

        if (!favError && favoriData) {
          const ilanIds = favoriData.map(f => f.ilan_id);

          // Favori ilanların detaylarını ilan tablosundan çek
          const { data: ilanlarData, error: ilanError } = await supabase
            .from("ilan")
            .select("*")
            .in("id", ilanIds);

          if (!ilanError && ilanlarData) {
            setFavoriIlanlar(ilanlarData);
          } else {
            setFavoriIlanlar([]);
          }
        } else {
          setFavoriIlanlar([]);
        }
        setLoadingFavoriler(false);
      }
    }
    fetchUserAndFavorites();
  }, []);

  // İçerik gösterimi
  const renderContent = () => {
    switch(selectedMenu) {
      case "siparislerim":
        return <p>Burada Siparişlerin gösterilecek.</p>;
      case "degerlendirmelerim":
        return <p>Burada Değerlendirmeler listelenecek.</p>;
      case "saticiMesajlarim":
        return <p>Satıcı mesajları burada.</p>;
      case "tekrarSatinAl":
        return <p>Tekrar satın alma seçenekleri burada.</p>;

      case "favoriIlanlar":
        if (loadingFavoriler) return <p>Favoriler yükleniyor...</p>;
        return (
          <div>
            <h2 style={{ marginBottom: 16, color: "#223555" }}>Favori İlanlarım</h2>
            {favoriIlanlar.length === 0 ? (
              <p style={{ color: "#64748b" }}>Henüz favori ilan eklenmedi.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {favoriIlanlar.map((ilan) => (
                  <li key={ilan.id} style={{
                    background: "#f8fafc",
                    padding: 12,
                    marginBottom: 10,
                    borderRadius: 8,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                    cursor: "pointer"
                  }}
                    onClick={() => window.location.href = `/urun/${ilan.id}`}
                    title={ilan.title}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img
                        src={Array.isArray(ilan.resim_url) ? ilan.resim_url[0] || "/placeholder.jpg" : ilan.resim_url || "/placeholder.jpg"}
                        alt={ilan.title}
                        width={70}
                        height={70}
                        style={{ borderRadius: 8, objectFit: "cover" }}
                      />
                      <div>
                        <h3 style={{ margin: 0, color: "#1e293b" }}>{ilan.title}</h3>
                        <p style={{ margin: "4px 0", color: "#16a34a", fontWeight: "600" }}>{ilan.price} ₺</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      default:
        return <p>Seçili içerik yok.</p>;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
      {/* Üst Banner */}
      <header style={{
        background: "rgba(0,0,0,0.05)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        userSelect: "none"
      }}>
        <div
          onClick={() => window.location.href = "/index2"}
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          title="Anasayfa"
        >
          <Image src="/logo.png" alt="Aldın Aldın Logo" width={42} height={42} />
          <span
            style={{
              fontWeight: 700,
              fontSize: 21,
              color: "#223555",
              letterSpacing: 1,
              marginLeft: 2,
              userSelect: "none"
            }}
          >
            Aldın Aldın
          </span>
        </div>
      </header>

      {/* Ana alan */}
      <div style={{ display: "flex", maxWidth: 1200, margin: "40px auto", gap: 24 }}>
        {/* Sol Menü */}
        <aside style={{
          flexBasis: 280,
          background: "white",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <div style={{
            marginBottom: 40,
            fontWeight: "600",
            fontSize: 14,
            color: "#1e293b",
            wordBreak: "break-word"
          }}>
            {userEmail}
          </div>

          <nav>
            <h3 style={{ fontWeight: "700", fontSize: 16, marginBottom: 10, color: "#334155" }}>
              Siparişlerim
            </h3>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 30 }}>
              {menuItems.map((item) => (
                <li
                  key={item.id}
                  onClick={() => setSelectedMenu(item.id)}
                  style={{
                    cursor: "pointer",
                    padding: "10px 15px",
                    marginBottom: 8,
                    background: selectedMenu === item.id ? "#d1fae5" : "transparent",
                    borderRadius: 8,
                    fontWeight: selectedMenu === item.id ? "700" : "400",
                    color: selectedMenu === item.id ? "#16a34a" : "#475569",
                    transition: "background-color 0.2s"
                  }}
                >
                  {item.label}
                </li>
              ))}
            </ul>

            <h3 style={{ fontWeight: "700", fontSize: 16, marginBottom: 10, color: "#334155" }}>
              Sana Özel
            </h3>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 30 }}>
              {specialItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: "8px 15px",
                    marginBottom: 8,
                    cursor: "pointer",
                    color: "#475569",
                    fontWeight: "500",
                    borderRadius: 6,
                    transition: "background-color 0.15s"
                  }}
                  onClick={() => setSelectedMenu(item.id)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdfa"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {item.label}
                </li>
              ))}
            </ul>

            <h3 style={{ fontWeight: "700", fontSize: 16, marginBottom: 10, color: "#334155" }}>
              Hizmetlerim
            </h3>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 30 }}>
              {servicesItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: "8px 15px",
                    marginBottom: 8,
                    cursor: "pointer",
                    color: "#475569",
                    fontWeight: "500",
                    borderRadius: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "background-color 0.15s"
                  }}
                  onClick={() => setSelectedMenu(item.id)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdfa"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      background: item.badge === "YENİ" ? "#ef4444" : "#f97316",
                      color: "white",
                      borderRadius: 6,
                      padding: "0 6px",
                      fontSize: 11,
                      fontWeight: "700"
                    }}>
                      {item.badge}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <h3 style={{ fontWeight: "700", fontSize: 16, marginBottom: 10, color: "#334155" }}>
              Hesabım & Yardım
            </h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {accountHelpItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: "8px 15px",
                    marginBottom: 8,
                    cursor: "pointer",
                    color: "#475569",
                    fontWeight: "500",
                    borderRadius: 6,
                    transition: "background-color 0.15s"
                  }}
                  onClick={() => setSelectedMenu(item.id)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdfa"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Sağ içerik */}
        <main style={{
          flexGrow: 1,
          background: "white",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
