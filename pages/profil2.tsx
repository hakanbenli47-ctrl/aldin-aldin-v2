import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabaseClient";

// ---- KART DOĞRULAMA (gerekirse kaldırabilirsin)
function isValidCardNumber(number: string) {
  number = number.replace(/\D/g, "");
  let sum = 0, shouldDouble = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number.charAt(i));
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return (sum % 10) === 0 && number.length === 16;
}
function isValidExpiry(exp: string) {
  if (!/^\d{2}\/\d{2}$/.test(exp)) return false;
  const [month, year] = exp.split("/").map(Number);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const expDate = new Date(2000 + year, month);
  return expDate > now;
}
function isValidCVV(cvv: string) {
  return /^\d{3,4}$/.test(cvv);
}

export default function Profil2() {
  // --- State'ler ---
  const [selectedMenu, setSelectedMenu] = useState("profilim");
  const [favoriIlanlar, setFavoriIlanlar] = useState<any[]>([]);
  const [loadingFavoriler, setLoadingFavoriler] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [showProfileForm, setShowProfileForm] = useState(false);

  // Profil formu
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: ""
  });

  // Siparişler
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // Menü dizileri
  const menuItems = [
    { id: "profilim", label: "Profilim" },
    { id: "siparislerim", label: "Siparişlerim" },
    { id: "degerlendirmelerim", label: "Değerlendirmelerim" },
    { id: "saticiMesajlarim", label: "Satıcı Mesajlarım" },
    { id: "tekrarSatinAl", label: "Tekrar Satın Al" }
  ];
  const specialItems = [
    { id: "indirimKuponlarim", label: "İndirim Kuponlarım" },
    { id: "favoriIlanlar", label: "Favori İlanlar" },
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

  // --- TÜM BİLGİLERİ ÇEK ---
  useEffect(() => {
    async function fetchAll() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);

      if (userData?.user) {
        const userId = userData.user.id;
        // PROFİL
        const { data: profData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", userId)
          .single();
        setProfile(profData);
        setProfileForm({
          first_name: profData?.first_name || "",
          last_name: profData?.last_name || "",
          phone: profData?.phone || ""
        });

        // TÜM ADRESLER
        const { data: addrData } = await supabase
          .from("user_addresses")
          .select("*")
          .eq("user_id", userId)
          .order("id", { ascending: true });
        setAddresses(addrData || []);

        // TÜM KARTLAR
        const { data: cardData } = await supabase
          .from("user_cards")
          .select("*")
          .eq("user_id", userId)
          .order("id", { ascending: true });
        setCards(cardData || []);

        // FAVORİLER
        setLoadingFavoriler(true);
        const { data: favoriData, error: favError } = await supabase
          .from("favoriler")
          .select("ilan_id")
          .eq("user_id", userId);

        if (!favError && favoriData) {
          const ilanIds = favoriData.map(f => f.ilan_id);
          const { data: ilanlarData, error: ilanError } = await supabase
            .from("ilan")
            .select("*")
            .in("id", ilanIds);
          if (!ilanError && ilanlarData) setFavoriIlanlar(ilanlarData);
          else setFavoriIlanlar([]);
        } else setFavoriIlanlar([]);
        setLoadingFavoriler(false);

        // SİPARİŞLER
        const { data: ordersData } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        setOrders(ordersData || []);
      }
    }
    fetchAll();
  }, []);

  // --- PROFİLİ KAYDET ---
  const handleProfileSave = async (e: any) => {
    e.preventDefault();
    if (!user) return;
    const userId = user.id;
    if (profile) {
      await supabase
        .from("user_profiles")
        .update({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone,
          updated_at: new Date()
        })
        .eq("user_id", userId);
    } else {
      await supabase
        .from("user_profiles")
        .insert([{
          user_id: userId,
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone
        }]);
    }
    setShowProfileForm(false);
    setProfile({ ...profile, ...profileForm });
  };

  // --- PROFİL KUTUSU VE FORMU ---
  const renderProfileBox = () => {
    if (showProfileForm || !profile) {
      return (
        <form
          onSubmit={handleProfileSave}
          style={{
            maxWidth: 430,
            margin: "auto",
            background: "#f5f7fa",
            padding: "36px 32px 24px 32px",
            borderRadius: 16,
            boxShadow: "0 1px 8px rgba(30,41,59,0.09)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            color: "#222e3a"
          }}
        >
          <h2 style={{ color: "#1e293b", margin: 0, marginBottom: 12, fontWeight: 700 }}>
            Profil Bilgileri
          </h2>
          <label style={{ color: "#222e3a", fontSize: 14, fontWeight: 600 }}>
            İsim
            <input
              type="text"
              required
              placeholder="Adınızı giriniz"
              value={profileForm.first_name}
              onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 8, border: "1.5px solid #bae6fd", background: "#fff", marginTop: 3, color: "#222e3a" }}
            />
          </label>
          <label style={{ color: "#222e3a", fontSize: 14, fontWeight: 600 }}>
            Soyisim
            <input
              type="text"
              required
              placeholder="Soyadınızı giriniz"
              value={profileForm.last_name}
              onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 8, border: "1.5px solid #bae6fd", background: "#fff", marginTop: 3, color: "#222e3a" }}
            />
          </label>
          <label style={{ color: "#222e3a", fontSize: 14, fontWeight: 600 }}>
            Telefon
            <input
              type="tel"
              required
              placeholder="05xx xxx xx xx"
              value={profileForm.phone}
              onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 8, border: "1.5px solid #bae6fd", background: "#fff", marginTop: 3, color: "#222e3a" }}
            />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", fontWeight: 700, fontSize: 16, flex: 1, cursor: "pointer" }}
            >
              Kaydet
            </button>
            {profile && (
              <button
                type="button"
                onClick={() => setShowProfileForm(false)}
                style={{ background: "#fff", color: "#223555", border: "1.5px solid #c7dbe8", borderRadius: 8, padding: "14px 0", fontWeight: 600, fontSize: 16, flex: 1, cursor: "pointer" }}
              >
                Vazgeç
              </button>
            )}
          </div>
        </form>
      );
    }

    // Profil bilgisi kutusu (düzenleme yoksa)
    return (
      <div style={{
        maxWidth: 430,
        margin: "auto",
        background: "#f5f7fa",
        borderRadius: 16,
        boxShadow: "0 1px 8px rgba(30,41,59,0.09)",
        padding: "38px 32px",
        color: "#222e3a"
      }}>
        <h2 style={{ color: "#1e293b", margin: 0, marginBottom: 18, fontWeight: 700 }}>
          Profil Bilgileri
        </h2>
        <div style={{ fontSize: 16, marginBottom: 9 }}>
          <b>İsim:</b> {profile?.first_name}
        </div>
        <div style={{ fontSize: 16, marginBottom: 9 }}>
          <b>Soyisim:</b> {profile?.last_name}
        </div>
        <div style={{ fontSize: 16, marginBottom: 22 }}>
          <b>Telefon:</b> {profile?.phone}
        </div>
        <button
          onClick={() => setShowProfileForm(true)}
          style={{
            background: "#2563eb", color: "#fff", border: "none",
            borderRadius: 8, padding: "13px 0", fontWeight: 700, width: "100%",
            fontSize: 16, cursor: "pointer"
          }}
        >
          Düzenle
        </button>
      </div>
    );
  };

  // ----------- ANA İÇERİK -----------
  const renderContent = () => {
    if (selectedMenu === "profilim") return renderProfileBox();

    if (profile) {
      if (selectedMenu === "siparislerim") {
        if (!orders.length) {
          return <p style={{ color: "#64748b" }}>Henüz hiç sipariş vermediniz.</p>;
        }
        return (
          <div>
            <h2 style={{ color: "#223555", marginBottom: 18, fontWeight: 700 }}>Siparişlerim</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {orders.map((order) => (
                <li
                  key={order.id}
                  style={{
                    background: "#f5f7fa",
                    borderRadius: 12,
                    marginBottom: 17,
                    boxShadow: "0 1px 7px #e5e7eb29",
                    padding: "16px 20px",
                    color: "#222e3a",
                    transition: "box-shadow .2s"
                  }}
                >
                  <div
                    onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                    title="Siparişi detaylı görüntüle/gizle"
                  >
                    <div>
                      <b>Sipariş No:</b> #{order.id}
                      <span style={{ color: "#0ea5e9", fontWeight: 600, marginLeft: 10 }}>
                        {new Date(order.created_at).toLocaleString("tr-TR")}
                      </span>
                    </div>
                    <span style={{
                      background: order.status === "Teslim Edildi"
                        ? "#22c55e"
                        : order.status === "İptal"
                          ? "#ef4444"
                          : "#eab308",
                      color: "#fff",
                      borderRadius: 9,
                      padding: "4px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      minWidth: 80,
                      textAlign: "center",
                      boxShadow: "0 1px 3px #aaa1"
                    }}>
                      {order.status || "Hazırlanıyor"}
                    </span>
                  </div>
                  {/* Sipariş Detayı: Accordion */}
                  {expandedOrderId === order.id && (
                    <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#2563eb", marginBottom: 4 }}>Ürünler</div>
                        <ul style={{ margin: "0 0 8px 0", padding: 0 }}>
                          {Array.isArray(order.cart_items) ? (
                            order.cart_items.map((item: any, i: number) => (
                              <li key={i} style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
                                <img src={item.resim_url || "/placeholder.jpg"} width={38} height={38} style={{ borderRadius: 7, marginRight: 10, background: "#fff" }} alt="" />
                                <span style={{ fontWeight: 600, color: "#223555", fontSize: 15 }}>{item.title}</span>
                                <span style={{ marginLeft: 11, color: "#16a34a", fontWeight: 700 }}>{item.price} ₺</span>
                                <span style={{ marginLeft: 10, color: "#64748b" }}>Adet: {item.adet}</span>
                              </li>
                            ))
                          ) : order.cart_items && typeof order.cart_items === "object" ? (
                            <li style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
                              <img src={order.cart_items.resim_url || "/placeholder.jpg"} width={38} height={38} style={{ borderRadius: 7, marginRight: 10, background: "#fff" }} alt="" />
                              <span style={{ fontWeight: 600, color: "#223555", fontSize: 15 }}>{order.cart_items.title}</span>
                              <span style={{ marginLeft: 11, color: "#16a34a", fontWeight: 700 }}>{order.cart_items.price} ₺</span>
                              <span style={{ marginLeft: 10, color: "#64748b" }}>Adet: {order.cart_items.adet}</span>
                            </li>
                          ) : (
                            <li>Ürün bulunamadı</li>
                          )}
                        </ul>
                      </div>
                      <div style={{ marginTop: 9, fontSize: 15 }}>
                        <b style={{ color: "#0ea5e9" }}>Adres:</b>
                        <span style={{ marginLeft: 7, color: "#223555" }}>
                          {order.custom_address
                            ? `${order.custom_address.title} - ${order.custom_address.address}, ${order.custom_address.city} (${order.custom_address.country})`
                            : (() => {
                                const addr = addresses.find(a => a.id === order.address_id);
                                return addr
                                  ? `${addr.title} - ${addr.address}, ${addr.city} (${addr.country})`
                                  : "Adres bilgisi bulunamadı.";
                              })()
                          }
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 15 }}>
                        <b style={{ color: "#0ea5e9" }}>Kart:</b>
                        <span style={{ marginLeft: 7, color: "#223555" }}>
                          {order.custom_card
                            ? `${order.custom_card.title} - **** **** **** ${order.custom_card.card_number?.slice(-4)}`
                            : (() => {
                                const card = cards.find(c => c.id === order.card_id);
                                return card
                                  ? `${card.title} - **** **** **** ${card.card_number.slice(-4)}`
                                  : "Kart bilgisi bulunamadı.";
                              })()
                          }
                        </span>
                      </div>
                      <div style={{
                        marginTop: 10,
                        fontWeight: 700,
                        color: "#1bbd8a",
                        fontSize: 17
                      }}>
                        Toplam Tutar: {order.total_price?.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
                      </div>
                      {/* ---- KARGO TAKİP NO GÖSTER ---- */}
                      {order.kargo_takip_no && (
                        <div style={{ marginTop: 9, fontWeight: 600, color: "#2563eb", fontSize: 16 }}>
                          <span style={{ color: "#0ea5e9" }}>Kargo Takip No:</span>
                          <span style={{ marginLeft: 10, color: "#223555", letterSpacing: 1 }}>{order.kargo_takip_no}</span>
                        </div>
                      )}
                      {order.status === "Kargoya Verildi" && !order.kargo_takip_no && (
                        <div style={{ marginTop: 9, color: "#f59e42", fontWeight: 600, fontSize: 15 }}>
                          Kargo takip numarası henüz eklenmemiş.
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div style={{ color: "#888", fontSize: 14, marginTop: 18 }}>
              Not: Sipariş durumu admin tarafından güncellendikçe buraya yansır.
            </div>
          </div>
        );
      }
      // Favori ilanlar ve diğer menüler aynı şekilde ekle
      // ...
    }

    return <p style={{ color: "#64748b" }}>Profil verisi bulunamadı.</p>;
  };

  // --- RETURN (GÖRÜNTÜ) ---
  return (
    <div style={{ minHeight: "100vh", background: "#eef2f6", fontFamily: "Arial, sans-serif" }}>
      <header style={{
        background: "rgba(0,0,0,0.05)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)", position: "sticky", top: 0, zIndex: 1000, userSelect: "none"
      }}>
        <div
          onClick={() => window.location.href = "/index2"}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          title="Anasayfa"
        >
          <Image src="/logo.png" alt="Aldın Aldın Logo" width={42} height={42} />
          <span style={{ fontWeight: 700, fontSize: 21, color: "#223555", letterSpacing: 1, marginLeft: 2, userSelect: "none" }}>
            Aldın Aldın
          </span>
        </div>
      </header>
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
            marginBottom: 12, fontWeight: "700", fontSize: 17, color: "#1e293b", wordBreak: "break-word"
          }}>
            {profile?.first_name || ""} {profile?.last_name || ""}
          </div>
          <nav>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 30 }}>
              {menuItems.map((item) => (
                <li
                  key={item.id}
                  onClick={() => { setSelectedMenu(item.id); setShowProfileForm(false); }}
                  style={{
                    cursor: "pointer", padding: "10px 15px", marginBottom: 8, background: selectedMenu === item.id ? "#d1fae5" : "transparent",
                    borderRadius: 8, fontWeight: selectedMenu === item.id ? "700" : "400", color: selectedMenu === item.id ? "#16a34a" : "#475569",
                    transition: "background-color 0.2s"
                  }}
                >
                  {item.label}
                </li>
              ))}
            </ul>
            <h3 style={{ fontWeight: "700", fontSize: 16, marginBottom: 10, color: "#334155" }}>Sana Özel</h3>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 30 }}>
              {specialItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: "8px 15px", marginBottom: 8, cursor: "pointer", color: "#475569",
                    fontWeight: "500", borderRadius: 6, transition: "background-color 0.15s"
                  }}
                  onClick={() => setSelectedMenu(item.id)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdfa"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {item.label}
                </li>
              ))}
            </ul>
            <h3 style={{ fontWeight: "700", fontSize: 16, marginBottom: 10, color: "#334155" }}>Hizmetlerim</h3>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 30 }}>
              {servicesItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: "8px 15px", marginBottom: 8, cursor: "pointer", color: "#475569", fontWeight: "500", borderRadius: 6,
                    display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background-color 0.15s"
                  }}
                  onClick={() => setSelectedMenu(item.id)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdfa"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      background: item.badge === "YENİ" ? "#ef4444" : "#f97316",
                      color: "white", borderRadius: 6, padding: "0 6px", fontSize: 11, fontWeight: "700"
                    }}>{item.badge}</span>
                  )}
                </li>
              ))}
            </ul>
            <h3 style={{ fontWeight: "700", fontSize: 16, marginBottom: 10, color: "#334155" }}>Hesabım & Yardım</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {accountHelpItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: "8px 15px", marginBottom: 8, cursor: "pointer", color: "#475569",
                    fontWeight: "500", borderRadius: 6, transition: "background-color 0.15s"
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
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
          color: "#222e3a"
        }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
