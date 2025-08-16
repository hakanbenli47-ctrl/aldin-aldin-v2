
import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
type MobileTab = { id: string; label: string };
type Order = {
  id: number;
  status: string;
  iade_durumu?: string;
  iade_kargo_takip_no?: string;
  iade_aciklamasi?: string;
  created_at: string;
  teslim_tarihi?: string | null;
  kargo_firma?: string | null;
  kargo_takip_no?: string | null;
  ilan_id?: number;
  cart_items: any[] | any;
  custom_address?: any;
  address_id?: number;
  custom_card?: any;
  card_id?: number;
  total_price?: number;
};
type Address = {
  id: number;
  title: string;
  address: string;
  city: string;
  country: string;
};
type Card = {
  id: number;
  title: string;
  card_number: string;
    expiry?: string;   // <-- eklendi
  cvv?: string; 
   name_on_card?: string;
};
type UserProfile = {
  first_name: string;
  last_name: string;
  phone: string;
};

// ---- KART DOĞRULAMA
function isValidCardNumber(number: string): boolean {
  number = number.replace(/\D/g, "");
  let sum = 0,
    shouldDouble = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number.charAt(i));
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0 && number.length === 16;
}
function isValidExpiry(exp: string): boolean {
  if (!/^\d{2}\/\d{2}$/.test(exp)) return false;
  const [month, year] = exp.split("/").map(Number);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const expDate = new Date(2000 + year, month);
  return expDate > now;
}
function isValidCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

export default function Profil2() {
  const router = useRouter();

  // --- İADE KARGO TAKİP NO ---
  const [iadeKargoTakipNo, setIadeKargoTakipNo] = useState<{ [orderId: number]: string }>({});
  const [iadeKargoKaydediliyor, setIadeKargoKaydediliyor] = useState<{ [orderId: number]: boolean }>({});
  const [showIadeModal, setShowIadeModal] = useState<number | null>(null);
  const [iadeAciklamasi, setIadeAciklamasi] = useState<string>("");
  const [iadeLoading, setIadeLoading] = useState<boolean>(false);

  const [selectedMenu, setSelectedMenu] = useState<string>("profilim");
  const [favoriIlanlar, setFavoriIlanlar] = useState<any[]>([]);
  const [loadingFavoriler, setLoadingFavoriler] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [showProfileForm, setShowProfileForm] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState<UserProfile>({
    first_name: "",
    last_name: "",
    phone: ""
  });
  const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const onResize = () => setIsMobile(window.innerWidth <= 640);
  onResize(); // ilk açılışta çalıştır
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
// Adres yönetimi
const [showAddAddress, setShowAddAddress] = useState(false);
const [editAddressId, setEditAddressId] = useState<number | null>(null);
const [addressForm, setAddressForm] = useState({ title: "", address: "", city: "", country: "" });

// Kart yönetimi
const [showAddCard, setShowAddCard] = useState(false);
const [editCardId, setEditCardId] = useState<number | null>(null);
const [cardForm, setCardForm] = useState({ title: "", card_number: "",  expiry: "", cvv: "",  name_on_card: ""});
async function reloadFavoriler() {
  if (!user) return;
  setLoadingFavoriler(true);

  const { data: favoriData, error } = await supabase
    .from("favoriler")
    .select("ilan_id")
    .eq("user_id", user.id);

  if (!error && favoriData?.length) {
    const ilanIds = favoriData.map((f: any) => f.ilan_id);
    const { data: ilanlarData } = await supabase
      .from("ilan")
      .select("*")
      .in("id", ilanIds);
    setFavoriIlanlar(ilanlarData || []);
  } else {
    setFavoriIlanlar([]);
  }

  setLoadingFavoriler(false);
}

  // --- İade süresi kontrolü ---
  function iadeSuresiAktif(order: Order): boolean {
    if (order.status === "Kargoya Verildi") return true;
    if (order.status === "Teslim Edildi" && order.teslim_tarihi) {
      const teslim = new Date(order.teslim_tarihi);
      const simdi = new Date();
      const farkMs = simdi.getTime() - teslim.getTime();
      const yediGunMs = 7 * 24 * 60 * 60 * 1000;
      return farkMs <= yediGunMs;
    }
    return false;
  }

  // --- YENİ: Aktif / Geçmiş ayrımı ---
// ✅ Aktif: ne “Teslim Edildi” ne de “İptal”; iade süreci tamamlanmamış
const activeOrders = orders.filter(
  (o: Order) =>
    o.status !== "Teslim Edildi" &&
    o.status !== "İptal" &&
    o.iade_durumu !== "Süreci Tamamlandı"
);

// ✅ Geçmiş: “Teslim Edildi” veya “İptal” veya iade süreci tamamlandı
const historyOrders = orders.filter(
  (o: Order) =>
    o.status === "Teslim Edildi" ||
    o.status === "İptal" ||
    o.iade_durumu === "Süreci Tamamlandı"
);


  // --- MENÜLER ---
  const menuItems = [
    { id: "profilim", label: "Profilim" },
    { id: "siparislerim", label: "Siparişlerim" },
    { id: "degerlendirmelerim", label: "Değerlendirmelerim" },
    { id: "saticiMesajlarim", label: "Satıcı Mesajlarım" },
    { id: "tekrarSatinAl", label: "Tekrar Satın Al" }
    
  ];
  // BURAYA EKLE
menuItems.push({ id: "adreslerim", label: "Adreslerim" });
menuItems.push({ id: "kartlarim", label: "Kartlarım" });
// BİTTİ

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
useEffect(() => {
  if (!user) return;

  // Sayfa ilk açıldığında bir çek
  reloadFavoriler();

  // Realtime ile dinle
  const channel = supabase
    .channel("fav-ch-" + user.id)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "favoriler", filter: `user_id=eq.${user.id}` },
      () => reloadFavoriler()
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [user]);


const allMobileTabs: MobileTab[] = [
  ...menuItems.map(m => ({ id: m.id, label: m.label })),
  ...specialItems.map(m => ({ id: m.id, label: m.label })),
  ...servicesItems.map(m => ({ id: m.id, label: m.label })),   // badge yok sayılıyor
  ...accountHelpItems.map(m => ({ id: m.id, label: m.label })),
];
  // --- VERİ ÇEKME ---
  useEffect(() => {
    async function fetchAll() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);

      if (userData?.user) {
        const userId = userData.user.id;
        // Profil
        const { data: profData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", userId)
          .single();
        setProfile(profData as UserProfile);
        setProfileForm({
          first_name: profData?.first_name || "",
          last_name: profData?.last_name || "",
          phone: profData?.phone || ""
        });
        // Adres
        const { data: addrData } = await supabase
          .from("user_addresses")
          .select("*")
          .eq("user_id", userId)
          .order("id", { ascending: true });
        setAddresses(addrData || []);
        // Kartlar
        const { data: cardData } = await supabase
          .from("user_cards")
          .select("*")
          .eq("user_id", userId)
          .order("id", { ascending: true });
        setCards(cardData || []);
        // Favoriler
        setLoadingFavoriler(true);
        const { data: favoriData, error: favError } = await supabase
          .from("favoriler")
          .select("ilan_id")
          .eq("user_id", userId);
        if (!favError && favoriData) {
          const ilanIds = favoriData.map((f: any) => f.ilan_id);
          const { data: ilanlarData, error: ilanError } = await supabase
            .from("ilan")
            .select("*")
            .in("id", ilanIds);
          setFavoriIlanlar(!ilanError && ilanlarData ? ilanlarData : []);
        } else setFavoriIlanlar([]);
        setLoadingFavoriler(false);
        // Siparişler
        // Satıcı siparişleri
// Alıcının verdiği siparişleri çekiyoruz (orders tablosu)
// Alıcının siparişlerini orders tablosundan al
const { data: ordersData } = await supabase
  .from("orders")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });

if (!ordersData) {
  setOrders([]);
  return;
}

// Her sipariş için seller_orders tablosundan iade bilgilerini al
const orderIds = ordersData.map(o => o.id);

// seller_orders verilerini topluca çek
const { data: sellerData } = await supabase
  .from("seller_orders")
  .select("order_id, iade_durumu, iade_aciklamasi, iade_kargo_takip_no")
  .in("order_id", orderIds);

// seller_orders verisini map'e çevir
const sellerMap = new Map();
(sellerData || []).forEach(s => {
  sellerMap.set(s.order_id, {
    iade_durumu: s.iade_durumu,
    iade_aciklamasi: s.iade_aciklamasi,
    iade_kargo_takip_no: s.iade_kargo_takip_no
  });
});

// orders ile birleştir
const mergedOrders = ordersData.map(order => {
  const sellerInfo = sellerMap.get(order.id);
  return {
    ...order,
    ...(sellerInfo || {})
  };
});

setOrders(mergedOrders);




    }
  }
  fetchAll();
}, []);
// BURAYA EKLE

const renderAddressForm = () => (
  <form
    onSubmit={handleAddressSave}
    style={{
      maxWidth: 400,
      margin: "auto",
      background: "#f1f1f1",
      padding: 24,
      borderRadius: 12,
      boxShadow: "0 1px 8px #0001",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}
  >
    <h3 style={{ margin: 0, fontWeight: 700, color: "#202228" }}>
      {editAddressId ? "Adres Düzenle" : "Yeni Adres Ekle"}
    </h3>
    <input
      placeholder="Başlık"
      value={addressForm.title}
      onChange={e => setAddressForm(f => ({ ...f, title: e.target.value }))}
      style={{
        padding: 10,
        borderRadius: 8,
        border: "1.5px solid #bae6fd",
        background: "#fff",      // Arka plan beyaz
        color: "#222",           // Yazı rengi siyah
      }}
    />
    <input
      placeholder="Adres"
      value={addressForm.address}
      onChange={e => setAddressForm(f => ({ ...f, address: e.target.value }))}
      style={{
        padding: 10,
        borderRadius: 8,
        border: "1.5px solid #bae6fd",
        background: "#fff",
        color: "#222",
      }}
    />
    <input
      placeholder="Şehir"
      value={addressForm.city}
      onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))}
      style={{
        padding: 10,
        borderRadius: 8,
        border: "1.5px solid #bae6fd",
        background: "#fff",
        color: "#222",
      }}
    />
    <input
      placeholder="Ülke"
      value={addressForm.country}
      onChange={e => setAddressForm(f => ({ ...f, country: e.target.value }))}
      style={{
        padding: 10,
        borderRadius: 8,
        border: "1.5px solid #bae6fd",
        background: "#fff",
        color: "#222",
      }}
    />
    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
      <button
        type="submit"
        style={{
          flex: 1,
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "12px 0",
          fontWeight: 700,
        }}
      >
        Kaydet
      </button>
      <button
        type="button"
        onClick={() => {
          setShowAddAddress(false);
          setEditAddressId(null);
          setAddressForm({ title: "", address: "", city: "", country: "" });
        }}
        style={{
          flex: 1,
          background: "#fff",
          color: "#223555",
          border: "1.5px solid #c7dbe8",
          borderRadius: 8,
        }}
      >
        Vazgeç
      </button>
    </div>
  </form>
);
const renderCardForm = () => (
  <form onSubmit={handleCardSave} style={{
    maxWidth: 400,
    margin: "auto",
    background: "#f1f1f1",
    padding: 24,
    borderRadius: 12,
    boxShadow: "0 1px 8px #0001",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  }}>
    <h3 style={{ margin: 0, fontWeight: 700, color: "#202228" }}>
      {editCardId ? "Kart Düzenle" : "Yeni Kart Ekle"}
    </h3>

    <input
      placeholder="Kart Başlığı"
      value={cardForm.title}
      onChange={e => setCardForm(f => ({ ...f, title: e.target.value }))}
      style={{
        padding: 10, borderRadius: 8, border: "1.5px solid #bae6fd",
        background: "#fff", color: "#222",
      }}
    />


<input
  placeholder="Kart Üzerindeki İsim"
  value={cardForm.name_on_card}
  onChange={e => setCardForm(f => ({ ...f, name_on_card: e.target.value }))}
  style={{ padding: 10, borderRadius: 8, border: "1.5px solid #bae6fd", background: "#fff", color: "#222" }}
/>



    <input
      placeholder="Kart Numarası"
      value={cardForm.card_number}
      maxLength={16}
      onChange={e => setCardForm(f => ({ ...f, card_number: e.target.value }))}
      style={{
        padding: 10, borderRadius: 8, border: "1.5px solid #bae6fd",
        background: "#fff", color: "#222",
      }}
    />

    <div style={{ display: "flex", gap: 10 }}>
     <input
  placeholder="AA/YY"
  value={cardForm.expiry}
  maxLength={5}
  onChange={e => {
    let val = e.target.value.replace(/\D/g, ""); // Sadece rakam al
    if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
    setCardForm(f => ({ ...f, expiry: val }));
  }}
  style={{
    padding: 10,
    borderRadius: 8,
    border: "1.5px solid #bae6fd",
    background: "#fff",
    color: "#222",
    width: 120,
    fontSize: 15
  }}
/>

      <input
        placeholder="CVV"
        value={cardForm.cvv}
        maxLength={4}
        onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value }))}
        style={{
          flex: 1, padding: 10, borderRadius: 8, border: "1.5px solid #bae6fd",
          background: "#fff", color: "#222",
        }}
      />
    </div>

    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
      <button
        type="submit"
        style={{
          flex: 1, background: "#2563eb", color: "#fff",
          border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700
        }}>
        Kaydet
      </button>
      <button
        type="button"
        onClick={() => {
          setShowAddCard(false);
          setEditCardId(null);
          setCardForm({ title: "", card_number: "", expiry: "", cvv: "", name_on_card: "" });
        }}
        style={{
          flex: 1, background: "#fff", color: "#223555",
          border: "1.5px solid #c7dbe8", borderRadius: 8
        }}>
        Vazgeç
      </button>
    </div>
  </form>
);




// ADRES ekle/güncelle
async function handleAddressSave(e: React.FormEvent) {
  e.preventDefault();
  if (!user) return;
  if (!addressForm.title || !addressForm.address || !addressForm.city || !addressForm.country) {
    alert("Tüm adres alanlarını doldurun.");
    return;
  }
  if (editAddressId) {
    await supabase.from("user_addresses").update({
      title: addressForm.title,
      address: addressForm.address,
      city: addressForm.city,
      country: addressForm.country,
    }).eq("id", editAddressId);
  } else {
    await supabase.from("user_addresses").insert([{
      user_id: user.id,
      ...addressForm,
    }]);
  }
  setShowAddAddress(false);
  setEditAddressId(null);
  setAddressForm({ title: "", address: "", city: "", country: "" });
  const { data: addrData } = await supabase
    .from("user_addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("id", { ascending: true });
  setAddresses(addrData || []);
}

async function handleDeleteAddress(id: number) {
  if (!window.confirm("Bu adresi silmek istediğinize emin misiniz?")) return;
  await supabase.from("user_addresses").delete().eq("id", id);
  setAddresses(addresses.filter(a => a.id !== id));
}
function handleEditAddress(id: number) {
  const a = addresses.find(x => x.id === id);
  if (!a) return;
  setEditAddressId(id);
  setAddressForm({ title: a.title, address: a.address, city: a.city, country: a.country });
  setShowAddAddress(true);
}

// KART ekle/güncelle
async function handleCardSave(e: React.FormEvent) {
  e.preventDefault();
  if (!user) return;
  if (!cardForm.title || !cardForm.card_number || !cardForm.expiry || !cardForm.cvv) {
    alert("Tüm kart alanlarını doldurun.");
    return;
  }
  if (!isValidCardNumber(cardForm.card_number)) {
    alert("Kart numarası geçersiz.");
    return;
  }
  if (!isValidExpiry(cardForm.expiry)) {
    alert("Son kullanma tarihi geçersiz.");
    return;
  }
  if (!isValidCVV(cardForm.cvv)) {
    alert("CVV geçersiz.");
    return;
  }
  if (editCardId) {
    await supabase.from("user_cards").update({
      title: cardForm.title,
      card_number: cardForm.card_number,
      expiry: cardForm.expiry,
      cvv: cardForm.cvv,
    }).eq("id", editCardId);
  } else {
    await supabase.from("user_cards").insert([{
      user_id: user.id,
      ...cardForm,
    }]);
  }
  setShowAddCard(false);
  setEditCardId(null);
  setCardForm({ title: "", card_number: "", expiry: "", cvv: "",  name_on_card: "",});
  const { data: cardData } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("id", { ascending: true });
  setCards(cardData || []);
}


async function handleDeleteCard(id: number) {
  if (!window.confirm("Bu kartı silmek istediğinize emin misiniz?")) return;
  await supabase.from("user_cards").delete().eq("id", id);
  setCards(cards.filter(a => a.id !== id));
}
function handleEditCard(id: number) {
  const c = cards.find(x => x.id === id);
  if (!c) return;
  setEditCardId(id);
  function handleEditCard(id: number) {
  const c = cards.find(x => x.id === id);
  if (!c) return;
  setEditCardId(id);
  setCardForm({
    title: c.title || "",
    card_number: c.card_number || "",
    expiry: c.expiry || "",
    cvv: c.cvv || "",
     name_on_card: c.name_on_card || "",
  });
  setShowAddCard(true);
}

  setShowAddCard(true);
}

  // --- PROFİL GÜNCELLEME ---
  const handleProfileSave = async (e: React.FormEvent) => {
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

  // --- İADE KARGO TAKİP NO KAYDET ---
  const handleIadeKargoTakipNoKaydet = async (orderId: number) => {
    if (!iadeKargoTakipNo[orderId] || iadeKargoTakipNo[orderId].length < 7) {
      alert("Geçerli bir takip kodu girin.");
      return;
    }
    setIadeKargoKaydediliyor(prev => ({ ...prev, [orderId]: true }));
    const { error } = await supabase
  .from("seller_orders")
  .update({ iade_kargo_takip_no: iadeKargoTakipNo[orderId] })
  .eq("id", orderId);

    setIadeKargoKaydediliyor(prev => ({ ...prev, [orderId]: false }));
    if (!error) {
      alert("Takip kodu kaydedildi!");
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(ordersData || []);
      setIadeKargoTakipNo(prev => ({ ...prev, [orderId]: "" }));
    } else {
      alert("Hata: " + error.message);
    }
  };

  // --- PROFİL KUTUSU ---
  const renderProfileBox = () => {
    if (showProfileForm || !profile) {
      return (
        <form onSubmit={handleProfileSave} style={{ maxWidth: 430, margin: "auto", background: "#f5f7fa", padding: "36px 32px 24px 32px", borderRadius: 16, boxShadow: "0 1px 8px rgba(30,41,59,0.09)", display: "flex", flexDirection: "column", gap: 20, color: "#222e3a" }}>
          <h2 style={{ color: "#1e293b", margin: 0, marginBottom: 12, fontWeight: 700 }}>Profil Bilgileri</h2>
          <label style={{ color: "#222e3a", fontSize: 14, fontWeight: 600 }}>
            İsim
            <input type="text" required placeholder="Adınızı giriniz" value={profileForm.first_name}
              onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 8, border: "1.5px solid #bae6fd", background: "#fff", marginTop: 3, color: "#222e3a" }} />
          </label>
          <label style={{ color: "#222e3a", fontSize: 14, fontWeight: 600 }}>
            Soyisim
            <input type="text" required placeholder="Soyadınızı giriniz" value={profileForm.last_name}
              onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 8, border: "1.5px solid #bae6fd", background: "#fff", marginTop: 3, color: "#222e3a" }} />
          </label>
          <label style={{ color: "#222e3a", fontSize: 14, fontWeight: 600 }}>
            Telefon
            <input type="tel" required placeholder="05xx xxx xx xx" value={profileForm.phone}
              onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 8, border: "1.5px solid #bae6fd", background: "#fff", marginTop: 3, color: "#222e3a" }} />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", fontWeight: 700, fontSize: 16, flex: 1, cursor: "pointer" }}>Kaydet</button>
            {profile && <button type="button" onClick={() => setShowProfileForm(false)} style={{ background: "#fff", color: "#223555", border: "1.5px solid #c7dbe8", borderRadius: 8, padding: "14px 0", fontWeight: 600, fontSize: 16, flex: 1, cursor: "pointer" }}>Vazgeç</button>}
          </div>
        </form>
      );
    }
    return (
      <div style={{ maxWidth: 430, margin: "auto", background: "#f5f7fa", borderRadius: 16, boxShadow: "0 1px 8px rgba(30,41,59,0.09)", padding: "38px 32px", color: "#222e3a" }}>
        <h2 style={{ color: "#1e293b", margin: 0, marginBottom: 18, fontWeight: 700 }}>Profil Bilgileri</h2>
        <div style={{ fontSize: 16, marginBottom: 9 }}><b>İsim:</b> {profile?.first_name}</div>
        <div style={{ fontSize: 16, marginBottom: 9 }}><b>Soyisim:</b> {profile?.last_name}</div>
        <div style={{ fontSize: 16, marginBottom: 22 }}><b>Telefon:</b> {profile?.phone}</div>
        <button onClick={() => setShowProfileForm(true)} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 700, width: "100%", fontSize: 16, cursor: "pointer" }}>Düzenle</button>
      </div>
      
    );
  
  };

  // --- SİPARİŞLER & İADE KARGOSU ---
  const renderOrderCard = (order: Order, isHistory: boolean) => (
    <li key={order.id} style={{ background: "#f5f7fa", borderRadius: 12, marginBottom: 17, boxShadow: "0 1px 7px #e5e7eb29", padding: "16px 20px", color: "#222e3a", transition: "box-shadow .2s" }}>
      <div onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }} title="Siparişi detaylı görüntüle/gizle">
        <div><b>Sipariş No:</b> #{order.id} <span style={{ color: "#0ea5e9", fontWeight: 600, marginLeft: 10 }}>{new Date(order.created_at).toLocaleString("tr-TR")}</span></div>
        <span style={{ background: order.status === "Teslim Edildi" ? "#22c55e" : order.status === "İptal" ? "#ef4444" : "#eab308", color: "#fff", borderRadius: 9, padding: "4px 16px", fontSize: 14, fontWeight: 600, minWidth: 80, textAlign: "center", boxShadow: "0 1px 3px #aaa1" }}>{order.status || "Hazırlanıyor"}</span>
      </div>
      {expandedOrderId === order.id && (
        <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
          {/* Ürünler */}
          <div style={{ fontWeight: 600, color: "#2563eb", marginBottom: 4 }}>Ürünler</div>
          <ul style={{ margin: "0 0 8px 0", padding: 0 }}>
            {Array.isArray(order.cart_items)
              ? order.cart_items.map((item: any, i: number) => (
                <li key={i} style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
                  <img src={item.resim_url || "/placeholder.jpg"} width={38} height={38} style={{ borderRadius: 7, marginRight: 10, background: "#fff" }} alt="" />
                  <span style={{ fontWeight: 600, color: "#223555", fontSize: 15 }}>{item.title}</span>
                  <span style={{ marginLeft: 11, color: "#16a34a", fontWeight: 700 }}>{item.price} ₺</span>
                  <span style={{ marginLeft: 10, color: "#64748b" }}>Adet: {item.adet}</span>
                </li>
              ))
              : order.cart_items && typeof order.cart_items === "object"
                ? (
                  <li style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
                    <img src={order.cart_items.resim_url || "/placeholder.jpg"} width={38} height={38} style={{ borderRadius: 7, marginRight: 10, background: "#fff" }} alt="" />
                    <span style={{ fontWeight: 600, color: "#223555", fontSize: 15 }}>{order.cart_items.title}</span>
                    <span style={{ marginLeft: 11, color: "#16a34a", fontWeight: 700 }}>{order.cart_items.price} ₺</span>
                    <span style={{ marginLeft: 10, color: "#64748b" }}>Adet: {order.cart_items.adet}</span>
                  </li>
                )
                : <li>Ürün bulunamadı</li>
            }
          </ul>
          {/* Adres */}
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
          {/* Kart */}
          <div style={{ marginTop: 4, fontSize: 15 }}>
            <b style={{ color: "#0ea5e9" }}>Kart:</b>
            <span style={{ marginLeft: 7, color: "#223555" }}>
  
   {order.custom_card
      ? `${order.custom_card.title || order.custom_card.name_on_card || "Kart"} - **** **** **** ${order.custom_card.last4 ?? ""}${order.custom_card.expiry ? " (" + order.custom_card.expiry + ")" : ""}`
       : (() => {
         const card = cards.find(c => c.id === order.card_id);
         return card

          ? `${card.title} - **** **** **** ${String(card.card_number).slice(-4)}`
           : "Kart bilgisi bulunamadı.";
       })()
     }

            </span>
          </div>
          {/* Kargo */}
          <div style={{ marginTop: 14 }}>
            <b style={{ color: "#0ea5e9" }}>Kargo:</b>
            {order.kargo_firma && order.kargo_takip_no ? (
              <span style={{ marginLeft: 7, color: "#223555", background: "#f6f7fb", padding: "5px 15px", borderRadius: 8, display: "inline-block", fontWeight: 700, letterSpacing: "0.5px" }}>
                {order.kargo_firma} — <span style={{ color: "#2563eb" }}>{order.kargo_takip_no}</span>
              </span>
            ) : (
              <span style={{ marginLeft: 7, color: "#f59e42", fontWeight: 600 }}>Kargo bilgisi eklenmemiş.</span>
            )}
          </div>
          {/* Toplam */}
          <div style={{ marginTop: 10, fontWeight: 700, color: "#1bbd8a", fontSize: 17 }}>
            Toplam Tutar: {order.total_price?.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
          </div>
          {/* İADE DURUMU */}
          {order.iade_durumu === "Talep Edildi" && (
            <div style={{ marginTop: 12, background: "#fef3c7", color: "#92400e", padding: 10, borderRadius: 8, fontWeight: 700 }}>
              İade Talebi Gönderildi (Satıcı onayı bekleniyor)
            </div>
          )}
          {order.iade_durumu === "Onaylandı" && (
            <div style={{ marginTop: 12, background: "#d1fae5", color: "#065f46", padding: 10, borderRadius: 8, fontWeight: 700 }}>
              İade Süreci Başladı. Kargo ile ürünü geri gönderebilirsiniz!
            </div>
          )}
          {order.iade_durumu === "Süreci Tamamlandı" && (
            <div style={{ marginTop: 12, background: "#dbeafe", color: "#1e40af", padding: 10, borderRadius: 8, fontWeight: 700 }}>
              İade Süreci Tamamlandı
            </div>
          )}
          {order.iade_durumu === "Reddedildi" && (
            <div style={{ marginTop: 12, background: "#fee2e2", color: "#b91c1c", padding: 10, borderRadius: 8, fontWeight: 700 }}>
              İade Talebiniz Reddedildi
            </div>
          )}
          {/* İADE KARGO TAKİP NO GİRİŞ */}
          {order.iade_durumu === "Onaylandı" && !order.iade_kargo_takip_no && (
            <div style={{ marginTop: 18, background: "#f8fafc", borderRadius: 9, padding: 18 }}>
              <div style={{ marginBottom: 8, fontWeight: 600, color: "#223555" }}>
                Ürünü iade kargoya verdiniz mi? Takip kodunu buraya yazın:
              </div>
              <input type="text" placeholder="Kargo Takip Kodu" value={iadeKargoTakipNo[order.id] || ""}
                onChange={e => setIadeKargoTakipNo(prev => ({ ...prev, [order.id]: e.target.value }))}
                style={{ width: 180, padding: 9, borderRadius: 7, border: "1.5px solid #16a34a", fontSize: 16, marginRight: 10 }}
                maxLength={40}
              />
              <button style={{ background: "#16a34a", color: "#fff", fontWeight: 700, borderRadius: 7, padding: "9px 18px", border: "none", cursor: "pointer" }}
                disabled={iadeKargoKaydediliyor[order.id] || (iadeKargoTakipNo[order.id]?.length ?? 0) < 7}
                onClick={() => handleIadeKargoTakipNoKaydet(order.id)}
              >
                {iadeKargoKaydediliyor[order.id] ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          )}
          {/* İADE KARGO NO GÖSTER */}
          {order.iade_kargo_takip_no && (
            <div style={{ marginTop: 16, color: "#16a34a", fontWeight: 700 }}>
              <span style={{ background: "#dcfce7", padding: "6px 15px", borderRadius: 8 }}>
                İade Kargo Takip Kodu: {order.iade_kargo_takip_no}
              </span>
            </div>
          )}
          {/* İADE SÜRECİ: KARGOYA VERİLDİ veya TESLİM EDİLDİ SONRASI 7 GÜN */}
          {order.iade_durumu !== "Talep Edildi" && iadeSuresiAktif(order) && !order.iade_durumu && (
            <div style={{ marginTop: 18 }}>
              <button
                onClick={() => setShowIadeModal(order.id)}
                style={{ background: "#e11d48", color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
                İade Talebi Aç
              </button>
              <span style={{ color: "#64748b", marginLeft: 16, fontSize: 13 }}>
                {order.status === "Kargoya Verildi" && "Ürün kargoda, iade açabilirsiniz."}
                {order.status === "Teslim Edildi" && order.teslim_tarihi &&
                  `Teslimden itibaren 7 gün iade hakkınız var (${order.teslim_tarihi}).`}
              </span>
            </div>
          )}
          {/* TEKRAR SATIN AL BUTONU */}
          {isHistory && expandedOrderId === order.id && (
            <button onClick={() => router.push(`/urun/${order.ilan_id}`)}
              style={{ marginTop: 12, background: "#1bbd8a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer" }}
            >
              Tekrar Satın Al
            </button>
          )}
        </div>
      )}
    </li>
  );

  // --- İçerik ---
  const renderContent = () => {// BURAYA EKLE

if (selectedMenu === "adreslerim") {
  return (
    <div>
      <h2 style={{color:"#223555",marginBottom:18,fontWeight:700}}>Adreslerim</h2>
      <button onClick={()=>{setShowAddAddress(true);setEditAddressId(null);setAddressForm({title:"",address:"",city:"",country:""});}}
        style={{marginBottom:20,background:"#1bbd8a",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontWeight:700,fontSize:15,cursor:"pointer"}}
      >+ Adres Ekle</button>
      {showAddAddress && renderAddressForm()}
      <ul style={{listStyle:"none",padding:0,margin:0}}>
        {addresses.map(addr=>(
          <li key={addr.id} style={{background:"#f5f7fa",borderRadius:9,marginBottom:13,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <b>{addr.title}</b> — {addr.address}, {addr.city} ({addr.country})
            </div>
            <div>
              <button onClick={()=>handleEditAddress(addr.id)} style={{marginRight:10,background:"#2563eb",color:"#fff",border:"none",borderRadius:6,padding:"5px 11px",fontWeight:700,cursor:"pointer"}}>Düzenle</button>
              <button onClick={()=>handleDeleteAddress(addr.id)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:6,padding:"5px 11px",fontWeight:700,cursor:"pointer"}}>Sil</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

if (selectedMenu === "kartlarim") {
  return (
    <div>
      <h2 style={{color:"#223555",marginBottom:18,fontWeight:700}}>Kartlarım</h2>
      <button onClick={()=>{setShowAddCard(true);setEditCardId(null);setCardForm({title:"",card_number:"",expiry: "",
  cvv: "",  name_on_card: "",});}}
        style={{marginBottom:20,background:"#1bbd8a",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontWeight:700,fontSize:15,cursor:"pointer"}}
      >+ Kart Ekle</button>
      {showAddCard && renderCardForm()}
      <ul style={{listStyle:"none",padding:0,margin:0}}>
        {cards.map(card=>(
          <li key={card.id} style={{background:"#f5f7fa",borderRadius:9,marginBottom:13,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <b>{card.title}</b> — **** **** **** {card.card_number.slice(-4)}
            </div>
            <div>
              <button onClick={()=>handleEditCard(card.id)} style={{marginRight:10,background:"#2563eb",color:"#fff",border:"none",borderRadius:6,padding:"5px 11px",fontWeight:700,cursor:"pointer"}}>Düzenle</button>
              <button onClick={()=>handleDeleteCard(card.id)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:6,padding:"5px 11px",fontWeight:700,cursor:"pointer"}}>Sil</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
if (selectedMenu === "favoriIlanlar") {
  return (
    <div>
      <h2 style={{color:"#223555",marginBottom:18,fontWeight:700}}>Favori İlanlarım</h2>

      {loadingFavoriler ? (
        <p style={{ color:"#64748b" }}>Yükleniyor...</p>
      ) : favoriIlanlar.length === 0 ? (
        <p style={{ color:"#64748b" }}>Henüz favoriniz yok.</p>
      ) : (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit, minmax(235px, 1fr))",
          gap: 16
        }}>
          {favoriIlanlar.map((p:any) => (
            <div key={p.id} style={{
              background:"#fff",
              borderRadius:12,
              padding:14,
              border:"1.5px solid #e4e9ef",
              boxShadow:"0 2px 10px #0000000d"
            }}>
              <img
                src={Array.isArray(p.resim_url) ? p.resim_url[0] || "/placeholder.jpg" : p.resim_url || "/placeholder.jpg"}
                alt={p.title}
                style={{ width:"100%", height:130, objectFit:"cover", borderRadius:8, marginBottom:8, border:"1px solid #e5e7eb" }}
              />
              <div style={{ fontWeight:700, color:"#223555", marginBottom:6 }}>{p.title}</div>
              <div style={{ fontWeight:700, color: p.indirimli_fiyat && p.indirimli_fiyat !== p.price ? "#ef4444" : "#16a34a" }}>
                {p.indirimli_fiyat && p.indirimli_fiyat !== p.price ? (
                  <>
                    <span style={{ textDecoration:"line-through", color:"#94a3b8", fontWeight:600, marginRight:6 }}>{p.price} ₺</span>
                    <span>{p.indirimli_fiyat} ₺</span>
                  </>
                ) : `${p.price} ₺`}
              </div>

              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <button
                  onClick={() => window.location.href = `/urun/${p.id}`}
                  style={{ flex:1, background:"#2563eb", color:"#fff", border:"none", borderRadius:8, padding:"9px 0", fontWeight:700, cursor:"pointer" }}
                >
                  Gör
                </button>
                <button
                  onClick={async () => {
                    if (!user) return;
                    await supabase.from("favoriler").delete().eq("user_id", user.id).eq("ilan_id", p.id);
                    await reloadFavoriler();
                  }}
                  style={{ background:"#ef4444", color:"#fff", border:"none", borderRadius:8, padding:"9px 12px", fontWeight:700, cursor:"pointer" }}
                  title="Favorilerden çıkar"
                >
                  ❌
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


    
    if (selectedMenu === "profilim") return renderProfileBox();
    
    if (profile) {
      if (selectedMenu === "siparislerim") {
        if (activeOrders.length === 0) {
          return <p style={{ color: "#64748b" }}>Aktif siparişiniz yok.</p>;
        }
        return (
          <div>
            <h2 style={{ color: "#223555", marginBottom: 18, fontWeight: 700 }}>Aktif Siparişler</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {activeOrders.map((o: Order) => renderOrderCard(o, false))}
            </ul>
            <div style={{ color: "#888", fontSize: 14, marginTop: 18 }}>
              Not: Sipariş durumu admin tarafından güncellendikçe buraya yansır.
            </div>
          </div>
        );
      }
      if (selectedMenu === "tekrarSatinAl") {
        if (historyOrders.length === 0) {
          return <p style={{ color: "#64748b" }}>Geçmiş siparişiniz yok.</p>;
        }
        return (
          <div>
            <h2 style={{ color: "#223555", marginBottom: 18, fontWeight: 700 }}>Geçmiş Siparişler</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {historyOrders.map((o: Order) => renderOrderCard(o, true))}
            </ul>
          </div>
        );
      }
    }
    return <p style={{ color: "#64748b" }}>Profil verisi bulunamadı.</p>;
  };

  // --- İADE MODAL ---
  const renderIadeModal = () => (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.22)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99
    }} onClick={() => setShowIadeModal(null)}>
      <div style={{
        minWidth: 350, maxWidth: 430, background: "#fff", borderRadius: 14,
        boxShadow: "0 4px 28px #2224", padding: "36px 32px 26px 32px",
        position: "relative", color: "#1e293b"
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 13, color: "#e11d48" }}>İade Talebi</h3>
        <div style={{ marginBottom: 17, fontSize: 15 }}>Neden iade etmek istiyorsunuz?</div>
        <textarea
          value={iadeAciklamasi}
          onChange={e => setIadeAciklamasi(e.target.value)}
          placeholder="İade sebebinizi yazınız..."
          style={{
            width: "100%", minHeight: 58, borderRadius: 8, border: "1.5px solid #b6bbc6",
            padding: 12, fontSize: 15, color: "#222e3a", marginBottom: 16, background: "#f8fafc"
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={async () => {
            if (!iadeAciklamasi.trim()) return alert("Açıklama gerekli.");
            setIadeLoading(true);
            await supabase.from("seller_orders").update({
              iade_durumu: "Talep Edildi",
              iade_aciklamasi: iadeAciklamasi
            }).eq("id", showIadeModal!);
            setIadeLoading(false);
            setShowIadeModal(null);
            setIadeAciklamasi("");
            const { data: ordersData } = await supabase
              .from("orders")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false });
            setOrders(ordersData || []);
          }}
            disabled={iadeLoading}
            style={{
              background: "#e11d48", color: "#fff", border: "none", borderRadius: 8, padding: "13px 0",
              fontWeight: 700, flex: 1, fontSize: 16, cursor: "pointer", opacity: iadeLoading ? 0.6 : 1
            }}
          >Talep Gönder</button>
          <button onClick={() => setShowIadeModal(null)} style={{
            background: "#fff", color: "#223555", border: "1.5px solid #c7dbe8",
            borderRadius: 8, padding: "13px 0", fontWeight: 600, flex: 1, fontSize: 16, cursor: "pointer"
          }}>Vazgeç</button>
        </div>
      </div>
    </div>
  );

  // --- RETURN ---
  return (
    <div style={{ minHeight: "100vh", background: "#eef2f6", fontFamily: "Arial, sans-serif" }}>
      {/* HEADER */}
      <header style={{
        background: "rgba(0,0,0,0.05)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)", position: "sticky", top: 0, zIndex: 1000, userSelect: "none"
      }}>
        <div onClick={() => window.location.href = "/index2"} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }} title="Anasayfa">
          <Image src="/logo.png" alt="Aldın Aldın Logo" width={42} height={42} />
          <span style={{ fontWeight: 700, fontSize: 21, color: "#223555", letterSpacing: 1, marginLeft: 2, userSelect: "none" }}>
       
          </span>
        </div>
      </header>
    <div
  style={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row", // ✅ mobilde alt alta
    width: "100%",                              
    maxWidth: "100%",                           // ✅ tam ekran
    margin: isMobile ? "12px auto" : "24px auto",
    gap: isMobile ? 12 : 24,
    paddingLeft: isMobile ? 12 : 24,
    paddingRight: isMobile ? 12 : 24,
    boxSizing: "border-box",
  }}
>


  {/* ASIDE */}
{!isMobile && (
  <aside
    style={{
      flex: "0 0 280px",
      background: "white",
      borderRadius: 12,
      padding: 24,
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
    }}
  >
    <div
      style={{
        marginBottom: 12,
        fontWeight: 700,
        fontSize: 17,
        color: "#1e293b",
        wordBreak: "break-word",
      }}
    >
      {profile?.first_name || ""} {profile?.last_name || ""}
    </div>

    <nav>
      <ul style={{ listStyle: "none", padding: 0, marginBottom: 30 }}>
        {menuItems.map((item) => (
          <li
            key={item.id}
            onClick={() => {
              setSelectedMenu(item.id);
              setShowProfileForm(false);
            }}
            style={{
              cursor: "pointer",
              padding: "10px 15px",
              marginBottom: 8,
              background: selectedMenu === item.id ? "#d1fae5" : "transparent",
              borderRadius: 8,
              fontWeight: selectedMenu === item.id ? "700" : "400",
              color: selectedMenu === item.id ? "#16a34a" : "#475569",
              transition: "background-color 0.2s",
            }}
          >
            {item.label}
          </li>
        ))}
      </ul>

      <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: "#334155" }}>
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
              fontWeight: 500,
              borderRadius: 6,
              transition: "background-color 0.15s",
            }}
            onClick={() => setSelectedMenu(item.id)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdfa")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {item.label}
          </li>
        ))}
      </ul>

      <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: "#334155" }}>
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
              fontWeight: 500,
              borderRadius: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              transition: "background-color 0.15s",
            }}
            onClick={() => setSelectedMenu(item.id)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdfa")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <span>{item.label}</span>
            {item.badge && (
              <span
                style={{
                  background: item.badge === "YENİ" ? "#ef4444" : "#f97316",
                  color: "white",
                  borderRadius: 6,
                  padding: "0 6px",
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {item.badge}
              </span>
            )}
          </li>
        ))}
      </ul>

      <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: "#334155" }}>
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
              fontWeight: 500,
              borderRadius: 6,
              transition: "background-color 0.15s",
            }}
            onClick={() => setSelectedMenu(item.id)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdfa")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </nav>
  </aside>
)}
        {/* MAIN */}
        {isMobile && (
  <div
    style={{
      position: "sticky",
      top: 56,                // header yüksekliğine göre 56–64 deneyebilirsin
      zIndex: 10,
      background: "#eef2f6",
      padding: "8px 0",
      marginBottom: 8,
    }}
  >
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        paddingBottom: 4,
      }}
    >
      {allMobileTabs.map((t) => (
        <button
          key={t.id}
          onClick={() => { setSelectedMenu(t.id); setShowProfileForm(false); }}
          style={{
            whiteSpace: "nowrap",
            border: "1px solid #cfe3ee",
            background: selectedMenu === t.id ? "#d1fae5" : "#fff",
            color: selectedMenu === t.id ? "#16a34a" : "#223555",
            borderRadius: 999,
            padding: "8px 14px",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  </div>
)} 
    <main style={{
  flex: isMobile ? "1 1 auto" : "1 1 0%",      // ✅ masaüstünde kalan alanı kapla
  width: isMobile ? "100%" : "auto",           // ✅ mobilde tam genişlik, masaüstünde otomatik
  background: "#fff",
  borderRadius: 12,
  padding: isMobile ? 16 : 32,
  boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
  color: "#222e3a",
  minWidth: 0,
  boxSizing: "border-box",
}}>


          {renderContent()}
        </main>
      </div>
      {showIadeModal !== null && renderIadeModal()}
    </div>
  );
}
