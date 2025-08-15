import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";
import {  useRef } from "react"; 
// ----- MAIL GÖNDERME
async function sendOrderEmails({
  aliciMail,
  saticiMail,
  urunBaslik,
  urunFiyat,
  siparisNo,
}: {
  aliciMail: string;
  saticiMail: string;
  urunBaslik: string;
  urunFiyat: number | string;
  siparisNo: number | string;
}) {
  await fetch("/api/send-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: aliciMail,
      subject: `Siparişiniz Alındı! (#${siparisNo})`,
      text: `Siparişiniz başarıyla oluşturuldu!\nÜrün: ${urunBaslik}\nFiyat: ${urunFiyat}₺\nSipariş No: ${siparisNo}`,
      html: `<h2>Siparişiniz Alındı!</h2><p><b>Ürün:</b> ${urunBaslik}</p><p><b>Fiyat:</b> ${urunFiyat}₺</p><p><b>Sipariş No:</b> #${siparisNo}</p>`,
    }),
  });

  await fetch("/api/send-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: saticiMail,
      subject: `Yeni Sipariş Geldi! (#${siparisNo})`,
      text: `Yeni bir sipariş aldınız!\nÜrün: ${urunBaslik}\nFiyat: ${urunFiyat}₺\nSipariş No: ${siparisNo}`,
      html: `<h2>Yeni Sipariş Geldi!</h2><p><b>Ürün:</b> ${urunBaslik}</p><p><b>Fiyat:</b> ${urunFiyat}₺</p><p><b>Sipariş No:</b> #${siparisNo}</p>`,
    }),
  });
}

export default function Sepet2() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<any>({
  title: "",
  address: "",
  city: "",
  postal_code: "",
  country: ""
});

const [selectedCardId, setSelectedCardId] = useState<string>("");
const [showNewCardForm, setShowNewCardForm] = useState(false);
const [newCard, setNewCard] = useState<any>({
  name_on_card: "",
  card_number: "",
  expiry: "",
  cvv: "",
  title: ""
});

  async function handleNewAddressSave() {
  if (!newAddress.title || !newAddress.address || !newAddress.city || !newAddress.postal_code || !newAddress.country) {
    alert("Lütfen tüm adres alanlarını doldurun!");
    return;
  }

  const { data, error } = await supabase
    .from("user_addresses")
    .insert([
      {
        user_id: currentUser.id,
        title: newAddress.title,
        address: newAddress.address,
        city: newAddress.city,
        postal_code: newAddress.postal_code,
        country: newAddress.country,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
    ])
    .select();

  if (error) {
    console.error("Adres ekleme hatası:", error);
    alert("Adres kaydedilemedi: " + error.message);
    return;
  }

  setAddresses((prev) => [...prev, data[0]]);
  setShowNewAddressForm(false);
  setSelectedAddressId(data[0].id);

  alert("Adres başarıyla kaydedildi ✅");
}
async function handleNewCardSave() {
  if (!newCard.name_on_card || !newCard.card_number || !newCard.expiry || !newCard.cvv || !newCard.title) {
    alert("Lütfen tüm kart alanlarını doldurun!");
    return;
  }

  const { data, error } = await supabase
    .from("user_cards")
    .insert([
      {
        user_id: currentUser.id,
        name_on_card: newCard.name_on_card,
        card_number: newCard.card_number,
        expiry: newCard.expiry,
        cvv: newCard.cvv,
        title: newCard.title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
    ])
    .select();

  if (error) {
    console.error("Kart ekleme hatası:", error);
    alert("Kart kaydedilemedi: " + error.message);
    return;
  }

  setCards((prev) => [...prev, data[0]]);
  setShowNewCardForm(false);
  setSelectedCardId(data[0].id);

  alert("Kart başarıyla kaydedildi ✅");
}

// Mobil odak için:
const emptyStateRef = useRef<HTMLDivElement>(null);
const openModalBtnRef = useRef<HTMLButtonElement>(null);

  function HeaderBar() {
    return (
      <header
        style={{
          background: "#fff",
          height: 62,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid #ececec",
          boxShadow: "0 2px 8px #1bbd8a09",
          position: "sticky",
          top: 0,
          left: 0,
          width: "100%",
          zIndex: 999,
          padding: "0 0",
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <Link
            href="/index2"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 32,
              textDecoration: "none",
              userSelect: "none",
              cursor: "pointer",
            }}
            title="Ana Sayfa"
          >
            <Image src="/logo.png" alt="Aldın Aldın Logo" width={42} height={42} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 21,
                color: "#223555",
                letterSpacing: 1,
                marginLeft: 2,
                userSelect: "none",
              }}
            />
          </Link>
        </div>
        <div style={{ flex: 2, display: "flex", justifyContent: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 21, color: "#223555" }}>
            Sepetim
          </span>
        </div>
        <div style={{ flex: 1 }} />
      </header>
    );
  }
// KULLANICIYI AL — BUNU EKLE
useEffect(() => {
  async function getUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUser(data?.user || null);
    setLoading(false);
  }
  getUser();
}, []);

  // 1) Kullanıcıyı al
 useEffect(() => {
  if (!currentUser) return;

  const fetchCart = async () => {
    try {
      // 1) cart'tan satırları çek
      const { data: cart, error } = await supabase
        .from("cart")
        .select("id, adet, product_id, user_id, ozellikler")
        .eq("user_id", currentUser.id);

      if (error) throw error;
      if (!cart || cart.length === 0) {
        setCartItems([]);
        return;
      }

      // 2) ürünleri 'ilan' tablosundan topluca çek
      const productIds = Array.from(new Set(cart.map((c: any) => c.product_id).filter(Boolean)));
      const { data: ilanlar, error: perr } = await supabase
  .from("ilan")
  .select("id, title, price, indirimli_fiyat, resim_url, stok, user_email, user_id, ozellikler")
  .in("id", productIds);

      if (perr) throw perr;

      const pMap = new Map((ilanlar || []).map((p: any) => [p.id, p]));

      // 3) firma isimleri (opsiyonel)
      const sellerEmails = Array.from(
        new Set((ilanlar || []).map((p: any) => p.user_email).filter(Boolean))
      );
      let firmMap: Record<string, string> = {};
      if (sellerEmails.length) {
        const { data: firms } = await supabase
          .from("satici_firmalar")
          .select("email,firma_adi")
          .in("email", sellerEmails);
        (firms || []).forEach((f: any) => (firmMap[f.email] = f.firma_adi));
      }

      // 4) cart + ürün birleştir
      const withProduct = (cart || []).map((c: any) => {
        const prod = pMap.get(c.product_id);
        return {
          ...c,
          product: prod
            ? { ...prod, firma_adi: firmMap[prod.user_email] || "(Firma yok)" }
            : null,
        };
      });

      setCartItems(withProduct);
      console.log("Sepet OK, ürün sayısı:", withProduct.length);
    } catch (e) {
      console.error("fetchCart hata:", e);
      setCartItems([]);
    }
  };

  const fetchAddressesAndCards = async () => {
  const { data: addrData } = await supabase
    .from("user_addresses")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("id", { ascending: true });

  setAddresses(addrData || []);

  // 📌 Adres yoksa formu otomatik aç
  if (!addrData || addrData.length === 0) {
    setShowNewAddressForm(true);
  }

  const { data: cardData } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("id", { ascending: true });

  setCards(cardData || []);

  // 📌 Kart yoksa formu otomatik aç
  if (!cardData || cardData.length === 0) {
    setShowNewCardForm(true);
  }
};


  fetchCart();
  fetchAddressesAndCards();
}, [currentUser]);

useEffect(() => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (typeof window !== "undefined" && window.innerWidth <= 480);

  // Modal açıkken bu odaklamayı yapma
 if (!isMobile) return;
  const t = setTimeout(() => {
    if (cartItems.length === 0) {
      // Boş sepet: mesajı odakla + ortala
      emptyStateRef.current?.focus();
      emptyStateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      // Dolu sepet: "Sipariş Ver" butonunu odakla + ortala
      openModalBtnRef.current?.focus();
      openModalBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 120);

  return () => clearTimeout(t);
}, []);

  // ADET GÜNCELLEME --->
  const updateAdet = async (cartId: number, yeniAdet: number, stok: number) => {
    if (yeniAdet < 1 || yeniAdet > stok) return;
    await supabase.from("cart").update({ adet: yeniAdet }).eq("id", cartId);
    setCartItems((prev) =>
      prev.map((c) => (c.id === cartId ? { ...c, adet: yeniAdet } : c))
    );
  };

  const removeFromCart = async (cartId: number) => {
    await supabase.from("cart").delete().eq("id", cartId);
    setCartItems((prev) => prev.filter((c) => c.id !== cartId));
  };

  // İNDİRİMLİ FİYATLI TOPLAM!
  const toplamFiyat = cartItems.reduce((acc, item) => {
    const indirimVar =
      item.product?.indirimli_fiyat &&
      item.product?.indirimli_fiyat !== item.product?.price;
    const fiyat = indirimVar
      ? parseFloat(item.product.indirimli_fiyat)
      : typeof item.product?.price === "string"
      ? parseFloat(item.product.price)
      : item.product?.price;
    const adet = item.adet || 1;
    return acc + (fiyat || 0) * adet;
  }, 0);

  // SİPARİŞ VER — aynı satıcıya tek order
  async function handleSiparisVer(siparisBilgi: any,) {
  if (cartItems.length === 0) {
    alert("Sepetiniz boş!");
    return;
  }

  try {
    type Grup = { sellerId: string; sellerEmail: string; firmaAdi?: string; items: any[] };
    const gruplar = new Map<string, Grup>();

    for (const it of cartItems) {
      const sellerId = it?.product?.user_id;
      const sellerEmail = it?.product?.user_email || "";
      const firmaAdi = it?.product?.firma_adi;
      if (!sellerId) continue;
      if (!gruplar.has(sellerId)) gruplar.set(sellerId, { sellerId, sellerEmail, firmaAdi, items: [] });
      gruplar.get(sellerId)!.items.push(it);
    }

    for (const [, grup] of gruplar) {
      const items = grup.items.map((item: any) => {
        const indirimVar =
          item.product?.indirimli_fiyat && item.product?.indirimli_fiyat !== item.product?.price;
        const seciliFiyat = indirimVar ? item.product.indirimli_fiyat : item.product.price;
        return {
          product_id: item.product?.id ?? item.product_id,
          title: item.product?.title,
          price: seciliFiyat,
          adet: item.adet,
          resim_url: item.product?.resim_url,
        };
      });

      const total = items.reduce(
        (acc: number, it: any) => acc + (parseFloat(it.price) || 0) * (it.adet || 1),
        0
      );

      const payload: any = {
        user_id: currentUser.id,
        seller_id: grup.sellerId,
        cart_items: items,
        total_price: total,
        status: "beklemede",
        created_at: new Date(),
      };
if (siparisBilgi.isCustom) {
  payload.custom_address = siparisBilgi.address;

  // ✅ Sadece maske bilgisi gönder (full numara/cvv YOK)
  const maskedCard = siparisBilgi.card
    ? {
        title: (siparisBilgi.card.card_holder_name || "Yeni Kart"),
        name_on_card: (siparisBilgi.card.card_holder_name || ""),
        expiry: (siparisBilgi.card.expiration_date || ""),
        last4: (siparisBilgi.card.card_number || "").slice(-4),
      }
    : null;

  payload.custom_card = maskedCard;
} else {
  payload.address_id = siparisBilgi.addressId;
  payload.card_id = siparisBilgi.cardId;
}


      const { data: inserted, error } = await supabase.from("orders").insert([payload]).select().single();
      if (error) throw error;

      const urunBaslik = items.length > 1 ? `${items[0].title} +${items.length - 1} ürün` : items[0].title;

      await sendOrderEmails({
        aliciMail: currentUser.email,
        saticiMail: grup.sellerEmail,
        urunBaslik,
        urunFiyat: total,
        siparisNo: inserted?.id,
      });
    }

    // Başarı → şimdi sepeti temizle + modalı kapa + mesaj ver
    await supabase.from("cart").delete().eq("user_id", currentUser.id);
    setCartItems([]);
  
    alert("Sipariş(ler) başarıyla oluşturuldu!");

  } catch (err: any) {
    console.error("orders insert error:", err);
    alert("Sipariş kaydedilemedi: " + (err?.message || JSON.stringify(err)));
  }
}


  if (loading) {
    return (
      <p style={{ textAlign: "center", padding: 40 }}>
        ⏳ Kullanıcı bilgisi yükleniyor...
      </p>
    );
  }
  if (!currentUser) {
    return (
      <div>
        <HeaderBar />
        <div style={{ textAlign: "center", marginTop: 70 }}>
          <p style={{ margin: 40, color: "#e11d48" }}>
            ❌ Sepete ürün eklemek için <b>giriş yapmalısınız!</b>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #e6f3f1 100%)",
        padding: 0,
      }}
    >
      <HeaderBar />
      <div
        style={{
          maxWidth: 480,
          margin: "38px auto 0",
          background: "#fff",
          borderRadius: 11,
          border: "1px solid #ececec",
          padding: 25,
          boxShadow: "0 4px 24px #e7e7e71a",
        }}
      >
     {cartItems.length === 0 ? (
  <div
    ref={emptyStateRef}
    tabIndex={-1}
    style={{
      minHeight: "40vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      outline: "none",
      scrollMarginTop: 72, // sticky header için
    }}
  >
    <p
      style={{
        textAlign: "center",
        color: "#64748b",
        fontSize: 17,
        padding: 40,
        margin: 0,
      }}
    >
      Sepetiniz boş.
    </p>
  </div>
) : (
  /* ... mevcut dolu sepet içeriği ... */


          <>
            {cartItems.map((item) => {
              const indirimVar =
                item.product?.indirimli_fiyat &&
                item.product?.indirimli_fiyat !== item.product?.price;
              const stok = item.product?.stok ?? 99;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 14,
                    marginBottom: 16,
                    alignItems: "center",
                  }}
                >
                  <img
                    src={item.product?.resim_url || "/placeholder.jpg"}
                    alt={item.product?.title}
                    width={70}
                    height={70}
                    style={{ borderRadius: 9, background: "#f3f4f6" }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        margin: "0 0 4px",
                        fontWeight: 700,
                        color: "#333",
                      }}
                    >
                      {item.product?.title}
                    </h3>
                    {/* Ürün Özellikleri Gösterimi */}
                    {/* Ürün Özellikleri Düzenleme */}
{/* Ürün özellikleri - Sepette değiştirme */}
{/* Eğer cart.ozellikler yoksa ama product.ozellikler varsa, onları seçilebilir şekilde göster */}
{(
  Object.entries(item.product?.ozellikler || {}).map(([ozellik, secenekler]) => {
  const seciliDeger = item.ozellikler?.[ozellik] || "";
  return [ozellik, seciliDeger];
})
).map(([ozellik, deger]) => (
  <div key={ozellik} style={{ marginBottom: 4 }}>
    <b>{ozellik}:</b>{" "}
    <select
      value={deger as string}
      onChange={async (e) => {
        const yeniDeger = e.target.value;

        // Mevcut cart.ozellikler varsa onları al, yoksa boş nesne başlat
        const mevcutOzellikler =
          item.ozellikler && Object.keys(item.ozellikler).length > 0
            ? item.ozellikler
            : {};

        const yeniOzellikler = { ...mevcutOzellikler, [ozellik]: yeniDeger };

        // Supabase cart tablosunu güncelle
        await supabase
          .from("cart")
          .update({ ozellikler: yeniOzellikler })
          .eq("id", item.id);

        // Local state güncelle
        setCartItems((prev) =>
          prev.map((urun) =>
            urun.id === item.id ? { ...urun, ozellikler: yeniOzellikler } : urun
          )
        );
      }}
    >
      <option value="">Seçiniz</option>
      {(item.product?.ozellikler?.[ozellik] || [deger]).map((secenek: string) => (
        <option key={secenek} value={secenek}>
          {secenek}
        </option>
      ))}
    </select>
  </div>
))}



                    <div>
                      {indirimVar ? (
                        <>
                          <span
                            style={{
                              textDecoration: "line-through",
                              color: "#bbb",
                              marginRight: 5,
                              fontWeight: 600,
                            }}
                          >
                            {item.product.price} ₺
                          </span>
                          <span style={{ color: "#22c55e", fontWeight: 700 }}>
                            {item.product.indirimli_fiyat} ₺
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "#22c55e", fontWeight: 700 }}>
                          {item.product?.price} ₺
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <button
                        style={{
                          border: "1px solid #ddd",
                          background: "#f1f5f9",
                          borderRadius: 7,
                          width: 27,
                          height: 27,
                          fontWeight: 900,
                          fontSize: 20,
                          color: "#22c55e",
                          cursor: "pointer",
                        }}
                        disabled={item.adet <= 1}
                        onClick={() => updateAdet(item.id, item.adet - 1, stok)}
                      >
                        -
                      </button>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                          color: "#334155",
                          minWidth: 18,
                          display: "inline-block",
                          textAlign: "center",
                        }}
                      >
                        {item.adet}
                      </span>
                      <button
                        style={{
                          border: "1px solid #ddd",
                          background: "#f1f5f9",
                          borderRadius: 7,
                          width: 27,
                          height: 27,
                          fontWeight: 900,
                          fontSize: 20,
                          color: "#22c55e",
                          cursor: "pointer",
                        }}
                        disabled={item.adet >= stok}
                        onClick={() => updateAdet(item.id, item.adet + 1, stok)}
                      >
                        +
                      </button>
                      <span style={{ color: "#999", fontSize: 13, marginLeft: 5 }}>
                        Stok: {stok}
                      </span>
                    </div>
                  </div>
                  <button
                    style={{
                      background: "#fff0f0",
                      color: "#e11d48",
                      border: "1px solid #fca5a5",
                      borderRadius: 8,
                      fontSize: 15,
                      padding: 6,
                      cursor: "pointer",
                    }}
                    onClick={() => removeFromCart(item.id)}
                    title="Sepetten sil"
                  >
                    ❌
                  </button>
                </div>
              );
            })}
            
            <div
              style={{
                textAlign: "right",
                fontWeight: 800,
                fontSize: 18,
                marginTop: 10,
                color: "#223555",
              }}
            >
              Toplam:{" "}
              {toplamFiyat.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
            </div>
     {/* Adres Seçim Alanı */}
<div style={{ marginTop: 20, paddingTop: 10, borderTop: "1px solid #ddd" }}>
  <h3
  style={{
    fontSize: 19,
    marginBottom: 10,
    fontWeight: 700,
    color: "#1e293b",
    padding: "6px 0",
    borderBottom: "2px solid #22c55e",
    display: "inline-block",
  }}
>
  📍 Teslimat Adresi
</h3>

  {addresses.length > 0 ? (
    <>
      <select
  style={{
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "1px solid #ccc",
    marginBottom: 10,
  }}
  onChange={(e) => {
    setSelectedAddressId(e.target.value);
    if (e.target.value) setShowNewAddressForm(false); // ✅ Seçim olunca form kapanır
  }}
  value={selectedAddressId}
>

        <option value="">Adres Seçiniz</option>
        {addresses.map((adres) => (
         <option key={adres.id} value={adres.id}>
  {adres.title} - {adres.city}, {adres.country}
</option>

        ))}
      </select>
      <button
        style={{
          background: "#f1f5f9",
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          cursor: "pointer",
          fontSize: 14,
        }}
        onClick={() => setShowNewAddressForm(true)}
      >
        ➕ Yeni Adres Ekle
      </button>
    </>
  ) : (
    <div>
      <p style={{ color: "#555" }}>Kayıtlı adresiniz bulunmuyor.</p>
      <button
        style={{
          background: "#22c55e",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => setShowNewAddressForm(true)}
      >
        ➕ Yeni Adres Oluştur
      </button>
    </div>
  )}

  {showNewAddressForm && (
    <div style={{ marginTop: 15 }}>
   <input
  type="text"
  placeholder="Adres Başlığı"
  style={{
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    marginBottom: "10px",
    outline: "none",
    transition: "0.2s",
  }}
  onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
  onChange={(e) => setNewAddress({ ...newAddress, title: e.target.value })}
/>

<input
  type="text"
  placeholder="Açık Adres"
  style={{
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    marginBottom: "10px",
    outline: "none",
    transition: "0.2s",
  }}
  onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
  onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
/>

<input
  type="text"
  placeholder="Şehir"
  style={{
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    marginBottom: "10px",
    outline: "none",
    transition: "0.2s",
  }}
  onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
/>

<input
  type="text"
  placeholder="Posta Kodu"
  style={{
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    marginBottom: "10px",
    outline: "none",
    transition: "0.2s",
  }}
  onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
  onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
/>

<input
  type="text"
  placeholder="Ülke"
  style={{
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    marginBottom: "10px",
    outline: "none",
    transition: "0.2s",
  }}
  onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
  onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
/>


      <button
        style={{
          background: "#2563eb",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
        onClick={handleNewAddressSave}
      >
        💾 Adresi Kaydet
      </button>
    </div>
    
  )}
  {/* Kart Seçim Alanı */}
<div style={{ marginTop: 20, paddingTop: 10, borderTop: "1px solid #ddd" }}>
  <h3
  style={{
    fontSize: 19,
    marginBottom: 10,
    fontWeight: 700,
    color: "#1e293b",
    padding: "6px 0",
    borderBottom: "2px solid #3b82f6",
    display: "inline-block",
  }}
>
  💳 Ödeme Yöntemi
</h3>


  {cards.length > 0 ? (
    <>
      <select
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 6,
          border: "1px solid #ccc",
          marginBottom: 10,
        }}
        onChange={(e) => {
  setSelectedCardId(e.target.value);
  if (e.target.value) setShowNewCardForm(false); // ✅ Kart seçilince form kapanır
}}
        value={selectedCardId}
      >
        <option value="">Kart Seçiniz</option>
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title} •••• {c.card_number.slice(-4)}
          </option>
        ))}
      </select>
      <button
        style={{
          background: "#f1f5f9",
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          cursor: "pointer",
          fontSize: 14,
        }}
        onClick={() => setShowNewCardForm(true)}
      >
        ➕ Yeni Kart Ekle
      </button>
    </>
  ) : (
    <div>
      <p style={{ color: "#555" }}>Kayıtlı kartınız yok.</p>
      <button
        style={{
          background: "#22c55e",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => setShowNewCardForm(true)}
      >
        ➕ Yeni Kart Oluştur
      </button>
    </div>
  )}

  {showNewCardForm && (
  <div style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: "10px" }}>
    <input
      type="text"
      placeholder="Kart Üstündeki İsim"
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        backgroundColor: "#f9fafb",
        fontSize: "14px",
        transition: "all 0.2s ease",
      }}
      onFocus={(e) => (e.target.style.border = "1px solid #3b82f6")}
      onBlur={(e) => (e.target.style.border = "1px solid #d1d5db")}
      onChange={(e) => setNewCard({ ...newCard, name_on_card: e.target.value })}
    />
    <input
      type="text"
      placeholder="Kart Numarası"
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        backgroundColor: "#f9fafb",
        fontSize: "14px",
        transition: "all 0.2s ease",
      }}
      onFocus={(e) => (e.target.style.border = "1px solid #3b82f6")}
      onBlur={(e) => (e.target.style.border = "1px solid #d1d5db")}
      onChange={(e) => setNewCard({ ...newCard, card_number: e.target.value })}
    />
    <input
      type="text"
      placeholder="Son Kullanma (AA/YY)"
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        backgroundColor: "#f9fafb",
        fontSize: "14px",
        transition: "all 0.2s ease",
      }}
      onFocus={(e) => (e.target.style.border = "1px solid #3b82f6")}
      onBlur={(e) => (e.target.style.border = "1px solid #d1d5db")}
      onChange={(e) => setNewCard({ ...newCard, expiry: e.target.value })}
    />
    <input
      type="text"
      placeholder="CVV"
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        backgroundColor: "#f9fafb",
        fontSize: "14px",
        transition: "all 0.2s ease",
      }}
      onFocus={(e) => (e.target.style.border = "1px solid #3b82f6")}
      onBlur={(e) => (e.target.style.border = "1px solid #d1d5db")}
      onChange={(e) => setNewCard({ ...newCard, cvv: e.target.value })}
    />
    <input
      type="text"
      placeholder="Kart Başlığı"
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        backgroundColor: "#f9fafb",
        fontSize: "14px",
        transition: "all 0.2s ease",
      }}
      onFocus={(e) => (e.target.style.border = "1px solid #3b82f6")}
      onBlur={(e) => (e.target.style.border = "1px solid #d1d5db")}
      onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
    />

    <button
      style={{
        background: "#2563eb",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: 600,
        transition: "background 0.2s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
      onClick={handleNewCardSave}
    >
      💾 Kartı Kaydet
    </button>
  </div>
)}

</div>

</div>


          </>
        )}
      </div>

    

    </div>
  );
}

// ---- Sipariş Modalı
