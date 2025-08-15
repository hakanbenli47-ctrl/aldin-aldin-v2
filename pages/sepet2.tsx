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

  const [showSiparisModal, setShowSiparisModal] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);

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

    const { data: cardData } = await supabase
      .from("user_cards")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("id", { ascending: true });
    setCards(cardData || []);
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
  if (!isMobile || showSiparisModal) return;

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
}, [cartItems.length, showSiparisModal]);

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
    setShowSiparisModal(false);
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
            <button
  ref={openModalBtnRef}
  style={{
    marginTop: 24,
    width: "100%",
    background: "linear-gradient(90deg, #1bbd8a 0%, #16a34a 80%)",
    color: "#fff",
    padding: 13,
    borderRadius: 8,
    border: "none",
    fontWeight: 700,
    fontSize: 17,
    cursor: "pointer",
    letterSpacing: 0.4,
    outline: "none",
       scrollMarginTop: 72, 
  }}
  onClick={() => setShowSiparisModal(true)}
>
  ✅ Sipariş Ver
</button>

          </>
        )}
      </div>

      {showSiparisModal && (
  <div
    style={{
      position: "fixed",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.14)",
      zIndex: 2000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // küçük ekranlar için
      padding: 16,
      overflowY: "auto",
    }}
    onClick={() => setShowSiparisModal(false)}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        // içerik tam merkezde kalsın
        width: "100%",
        maxWidth: 520,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
      }}
    >
      <SiparisModal
  addresses={addresses}
  cards={cards}
  onSiparisVer={handleSiparisVer}
  toplamTutar={toplamFiyat} // ✅ toplam fiyatı prop olarak ekledik
  toplamUrun={cartItems.length} // ✅ ürün sayısını da ekledik
/>

    </div>
  </div>
)}

    </div>
  );
}

// ---- Sipariş Modalı
function SiparisModal({ addresses, cards, onSiparisVer, toplamTutar, toplamUrun }: any) {
  const [useSaved, setUseSaved] = useState(true);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  // Sepet2 içinde, state'lerin hemen altı:
useEffect(() => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (typeof window !== "undefined" && window.innerWidth <= 480);

  if (!isMobile) return;

  const t = setTimeout(() => {
    confirmBtnRef.current?.focus();
    confirmBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 150);

  return () => clearTimeout(t);
}, []); // modal mount olduğunda 1 kez çalışsın


  
// Sadece rakam bırak
const onlyDigits = (v: string) => v.replace(/\D+/g, "");

  // Yeni adres/kart state (güncel alan adları)
  const [customAddress, setCustomAddress] = useState({
    title: "",
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    district: "",
    city: "",
    postal_code: "",
    country: "Türkiye",
    save_address: false,
  });

  const [customCard, setCustomCard] = useState({
    card_holder_name: "",
    card_number: "",
    expiration_date: "",
    cvv: "",
    save_card: false,
  });

  const [selectedAddressId, setSelectedAddressId] = useState(addresses?.[0]?.id ?? null);
  const [selectedCardId, setSelectedCardId] = useState(cards?.[0]?.id ?? null);

  return (
  <div
  style={{
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 1px 12px rgba(30,41,59,0.09)",
    maxWidth: 470,
    width: "100%",
    // ÖNEMLİ: margin 0 olsun, yükseklik kontrolü ekleyelim
    margin: 0,
    boxSizing: "border-box",
    maxHeight: "90vh",
    overflowY: "auto",
    color: "#222e3a",
  }}
>

      <h2 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 18 }}>
        Sipariş Bilgileri
      </h2>

      {/* Kayıtlı / Farklı seçim */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 18 }}>
          <input type="radio" checked={useSaved} onChange={() => setUseSaved(true)} />
          <span style={{ marginLeft: 5 }}>Kayıtlı adres/kart ile sipariş ver</span>
        </label>
        <label>
          <input type="radio" checked={!useSaved} onChange={() => setUseSaved(false)} />
          <span style={{ marginLeft: 5 }}>Farklı adres/kart ile sipariş ver</span>
        </label>
      </div>

      {useSaved ? (
        <>
          {/* Kayıtlı adres/kart seçimi */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Adres Seç</div>
            <select
              value={selectedAddressId ?? ""}
              onChange={(e) => setSelectedAddressId(Number(e.target.value))}
             style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
            >
              {addresses.map((addr: any) => (
                <option key={addr.id} value={addr.id}>
                  {addr.title} - {addr.address} ({addr.city})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Kart Seç</div>
            <select
              value={selectedCardId ?? ""}
              onChange={(e) => setSelectedCardId(Number(e.target.value))}
             style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
            >
              {cards.map((card: any) => (
                <option key={card.id} value={card.id}>
                  {card.title} - **** **** **** {card.card_number.slice(-4)}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          {/* YENİ ADRES */}
          <div style={{ fontWeight: 600, marginTop: 10 }}>Yeni Adres</div>

          <input
  required
  placeholder="Adres başlığı"
  value={customAddress.title}
  onChange={(e) => setCustomAddress((s) => ({ ...s, title: e.target.value }))}
  style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
/>

          <input
            required
            placeholder="Ad Soyad"
            value={customAddress.full_name}
            onChange={(e) => setCustomAddress((s) => ({ ...s, full_name: e.target.value }))}
            style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />
       <input
  required
  placeholder="Telefon (05xxxxxxxxx)"
  inputMode="numeric"
  pattern="\d*"
  maxLength={11}
  value={customAddress.phone}
  onChange={(e) =>
    setCustomAddress((s) => ({
      ...s,
      phone: onlyDigits(e.target.value).slice(0, 11),
      
    }))
  }
  style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
/>

          <input
            required
            placeholder="Adres Satırı 1"
            value={customAddress.address_line1}
            onChange={(e) => setCustomAddress((s) => ({ ...s, address_line1: e.target.value }))}
            style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />
          <input
            placeholder="Adres Satırı 2 (opsiyonel)"
            value={customAddress.address_line2}
            onChange={(e) => setCustomAddress((s) => ({ ...s, address_line2: e.target.value }))}
            style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />
          <input
            required
            placeholder="İlçe"
            value={customAddress.district}
            onChange={(e) => setCustomAddress((s) => ({ ...s, district: e.target.value }))}
           style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />
          <input
            required
            placeholder="Şehir"
            value={customAddress.city}
            onChange={(e) => setCustomAddress((s) => ({ ...s, city: e.target.value }))}
            style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />
          <input
  required
  placeholder="Posta Kodu (5 hane)"
  inputMode="numeric"
  pattern="\d*"
  maxLength={5}
  value={customAddress.postal_code}
  onChange={(e) =>
    setCustomAddress((s) => ({
      ...s,
      postal_code: onlyDigits(e.target.value).slice(0, 5),
    }))
  }
 style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
/>

          <input
            required
            placeholder="Ülke"
            value={customAddress.country}
            onChange={(e) => setCustomAddress((s) => ({ ...s, country: e.target.value }))}
           style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px" }}>
            <input
              type="checkbox"
              checked={customAddress.save_address}
              onChange={(e) =>
                setCustomAddress((s) => ({ ...s, save_address: e.target.checked }))
              }
            />
            <span>Bu adresi kaydet</span>
          </label>

          {/* YENİ KART */}
          <div style={{ fontWeight: 600, marginTop: 10 }}>Yeni Kart</div>

          <input
            required
            placeholder="Kart Üzerindeki İsim"
            value={customCard.card_holder_name}
            onChange={(e) =>
              setCustomCard((s) => ({ ...s, card_holder_name: e.target.value }))
            }
            style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />
          <input
  required
  placeholder="Kart Numarası"
  inputMode="numeric"
  pattern="\d*"
  maxLength={19}         // 19 haneye kadar (AMEX vb. için geniş tuttuk)
  value={customCard.card_number}
  onChange={(e) =>
    setCustomCard((s) => ({
      ...s,
      card_number: onlyDigits(e.target.value).slice(0, 19),
    }))
  }
  style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
/>

          <input
            required
            placeholder="Son Kullanma Tarihi (AA/YY)"
            value={customCard.expiration_date}
            onChange={(e) =>
              setCustomCard((s) => ({ ...s, expiration_date: e.target.value }))
            }
            style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
          />
        <input
  required
  placeholder="CVV"
  inputMode="numeric"
  pattern="\d*"
  maxLength={4}     // 3 çoğu kart, 4 AMEX; 4 bırakmak güvenli
  value={customCard.cvv}
  onChange={(e) =>
    setCustomCard((s) => ({
      ...s,
      cvv: onlyDigits(e.target.value).slice(0, 4),
    }))
  }
 style={{
    width: "100%",
    marginBottom: 6,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#f3f4f6", // gri (beyaza yakın)
    color: "#000",              // yazı rengi siyah
    border: "1px solid #d1d5db"
  }}
/>

          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px" }}>
            <input
              type="checkbox"
              checked={customCard.save_card}
              onChange={(e) =>
                setCustomCard((s) => ({ ...s, save_card: e.target.checked }))
              }
            />
            <span>Bu kartı kaydet</span>
          </label>
        </>
      )}
{/* Sipariş Özeti Kutusu */}
<div
  style={{
    marginTop: "20px",
    padding: "15px",
    background: "#f9fafb",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    lineHeight: "1.5",
  }}
>
  <strong>📦 Sipariş Özeti</strong>
  <div>Ürün sayısı: {toplamUrun}</div>
  <div>Toplam: {toplamTutar} ₺</div>
  <div>
    💳 Kart: {useSaved
      ? "**** **** **** " + cards.find((c: any) => c.id === selectedCardId)?.card_number.slice(-4)
      : "**** **** **** " + customCard.card_number.slice(-4)
    }
  </div>
  <div>
    🏠 Adres: {useSaved
      ? (() => {
          const seciliAdres = addresses.find((a: any) => a.id === selectedAddressId);
          return seciliAdres
            ? `${seciliAdres.full_name}, ${seciliAdres.address} ${seciliAdres.city} ${seciliAdres.postal_code}`
            : "";
        })()
      : `${customAddress.full_name}, ${customAddress.address_line1} ${customAddress.city} ${customAddress.postal_code}`
    }
  </div>
</div>

      {/* TEK BUTON */}
      <button
  style={{
    background: "#fb8500",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 0",
    fontWeight: 700,
    width: "100%",
    fontSize: 16,
    marginTop: 4,
  }}
  onClick={() => {
    // Adres ve kart bilgisi kontrolü
    if (useSaved) {
      if (!selectedAddressId || !selectedCardId) {
        alert("Lütfen bir adres ve kart seçin.");
        return;
      }
    } else {
      if (
        !customAddress.title ||
        !customAddress.full_name ||
        !customAddress.phone ||
        !customAddress.address_line1 ||
        !customAddress.district ||
        !customAddress.city ||
        !customAddress.postal_code ||
        !customAddress.country ||
        !customCard.card_holder_name ||
        !customCard.card_number ||
        !customCard.expiration_date ||
        !customCard.cvv
      ) {
        alert("Lütfen tüm adres ve kart alanlarını doldurun.");
        return;
      }
    }

    // Sipariş özeti modalı açılabilir
  // Maskelenmiş kart numarası (son 4 hane)
let kartSon4 = "";
if (useSaved) {
  const seciliKart = cards.find((c: any) => c.id === selectedCardId);
  kartSon4 = seciliKart ? "**** **** **** " + seciliKart.card_number.slice(-4) : "";
} else {
  kartSon4 = "**** **** **** " + customCard.card_number.slice(-4);
}

// Adres bilgisi
let adresMetin = "";
if (useSaved) {
  const seciliAdres = addresses.find((a: any) => a.id === selectedAddressId);
  if (seciliAdres) {
    adresMetin = `${seciliAdres.full_name}, ${seciliAdres.address} ${seciliAdres.city} ${seciliAdres.postal_code}`;
  }
} else {
  adresMetin = `${customAddress.full_name}, ${customAddress.address_line1} ${customAddress.city} ${customAddress.postal_code}`;
}

// Sipariş özeti modalı açılabilir

  }}
>
  📦 Sipariş Özeti Göster
</button>

    </div>
  );
}