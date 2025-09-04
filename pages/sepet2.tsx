import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";

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

/* ---------- Yardımcılar: özellik normalizasyonu & label ---------- */
// 🔄 GÜNCEL: Tekil değerleri de tek öğelik diziye çevirir (örn. {sonTuketim:"2026-12-31"} -> ["2026-12-31"])
function normalizeOzellikler(raw: any): Record<string, string[]> {
  if (!raw) return {};

  let obj: any = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof obj !== "object" || obj === null) return {};

  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      const arr = val.map((v) => String(v)).filter(Boolean);
      if (arr.length) out[key] = arr;
    } else if (val !== null && val !== undefined && String(val).trim() !== "") {
      out[key] = [String(val)];
    }
  }
  return out;
}

function prettyLabel(key: string) {
  return key
    .replace(/([a-z])([A-ZĞÜŞİÖÇ])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/(^|\s)([a-zöçşiğü])/g, (m) => m.toUpperCase());
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
    first_name: "",
    last_name: "",
    phone: "",
    title: "",
    address: "",
    city: "",
    postal_code: "",
    country: "",
  });

  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [newCard, setNewCard] = useState<any>({
    name_on_card: "",
    card_number: "",
    expiry: "",
    cvv: "",
    title: "",
  });

  // --- Kart formatlama yardımcıları ---
  function formatCardNumber(value: string) {
    return value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
  }
  function formatExpiry(value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 3) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4);
    }
    return cleaned;
  }
  function formatCVV(value: string) {
    return value.replace(/\D/g, "").slice(0, 4);
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    marginBottom: "10px",
    outline: "none",
    transition: "0.2s",
  } as const;

  async function handleNewAddressSave() {
    if (
      !newAddress.first_name ||
      !newAddress.last_name ||
      !newAddress.phone ||
      !newAddress.title ||
      !newAddress.address ||
      !newAddress.city ||
      !newAddress.postal_code ||
      !newAddress.country
    ) {
      alert("Lütfen tüm alanları doldurun!");
      return;
    }

    if (!/^(05\d{9})$/.test(newAddress.phone)) {
      alert("Geçerli bir telefon numarası girin!");
      return;
    }

    const { data, error } = await supabase
      .from("user_addresses")
      .insert([
        {
          user_id: currentUser.id,
          first_name: newAddress.first_name,
          last_name: newAddress.last_name,
          phone: newAddress.phone,
          title: newAddress.title,
          address: newAddress.address,
          city: newAddress.city,
          postal_code: newAddress.postal_code,
          country: newAddress.country,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Adres ekleme hatası:", error);
      alert("Adres kaydedilemedi: " + error.message);
      return;
    }

    setAddresses((prev) => [...prev, data![0]]);
    setShowNewAddressForm(false);
    setSelectedAddressId(data![0].id);
    alert("Adres başarıyla kaydedildi ✅");
  }

  async function handleNewCardSave() {
    if (!newCard.name_on_card) {
      alert("Kart üzerindeki isim eksik!");
      return;
    }
    if (!newCard.card_number) {
      alert("Kart numarası girilmedi!");
      return;
    }
    if (!newCard.expiry) {
      alert("Son kullanma tarihi girilmedi!");
      return;
    }
    if (!newCard.cvv) {
      alert("CVV girilmedi!");
      return;
    }
    if (!newCard.title) {
      alert("Kart başlığı girilmedi!");
      return;
    }

    const cardDigits = newCard.card_number.replace(/\s/g, "");
    if (cardDigits.length !== 16) {
      alert("Geçerli bir kart numarası girin! (16 haneli olmalı)");
      return;
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(newCard.expiry)) {
      alert("Son kullanma tarihi geçersiz! (AA/YY formatında olmalı)");
      return;
    }

    if (!/^\d{3,4}$/.test(newCard.cvv)) {
      alert("Geçerli bir CVV girin! (3 veya 4 haneli olmalı)");
      return;
    }

    // ---- Kartı kaydet ----
    const maskedCardNumber = newCard.card_number.slice(-4).padStart(newCard.card_number.length, "*");
    const maskedCVV = newCard.cvv.replace(/./g, "*").slice(0, -1) + newCard.cvv.slice(-1);

    const { data, error } = await supabase
      .from("user_cards")
      .insert([
        {
          user_id: currentUser.id,
          name_on_card: newCard.name_on_card,
          card_number: maskedCardNumber, // ✅ DB'ye maskeli
          expiry: newCard.expiry,
          cvv: maskedCVV,                 // ✅ yıldızlı
          title: newCard.title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Kart ekleme hatası:", error);
      alert("Kart kaydedilemedi: " + error.message);
      return;
    }

    setCards((prev) => [...prev, data![0]]);
    setShowNewCardForm(false);
    setSelectedCardId(data![0].id);

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
          <span style={{ fontWeight: 800, fontSize: 21, color: "#223555" }}>Sepetim</span>
        </div>
        <div style={{ flex: 1 }} />
      </header>
    );
  }

  // KULLANICIYI AL
  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user || null);
      setLoading(false);
    }
    getUser();
  }, []);

  // 1) Kullanıcıya bağlı veriler
  useEffect(() => {
    if (!currentUser) return;

    const fetchCart = async () => {
      try {
        const { data: cart, error } = await supabase
          .from("cart")
          .select("id, adet, product_id, user_id, ozellikler")
          .eq("user_id", currentUser.id);

        if (error) throw error;
        if (!cart || cart.length === 0) {
          setCartItems([]);
          return;
        }

        const productIds = Array.from(new Set(cart.map((c: any) => c.product_id).filter(Boolean)));
        const { data: ilanlar, error: perr } = await supabase
          .from("ilan")
          .select(
            "id, title, price, indirimli_fiyat, resim_url, stok, user_email, user_id, ozellikler, kategori_id"
          )
          .in("id", productIds);

        if (perr) throw perr;

        const pMap = new Map((ilanlar || []).map((p: any) => [p.id, p]));

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

        // Kargo ayarları
        const { data: kargoAyarlar } = await supabase
          .from("satici_firmalar")
          .select("user_id, shipping_fee, free_shipping_enabled, free_shipping_threshold")
          .in("user_id", (ilanlar || []).map((p: any) => p.user_id));

        let kargoMap: Record<string, any> = {};
        (kargoAyarlar || []).forEach((k: any) => {
          kargoMap[k.user_id] = k;
        });

        const withProduct = (cart || []).map((c: any) => {
          const prod = pMap.get(c.product_id);
          return {
            ...c,
            product: prod ? { ...prod, firma_adi: firmMap[prod.user_email] || "(Firma yok)" } : null,
            kargo: prod ? kargoMap[prod.user_id] : null,
          };
        });

        setCartItems(withProduct);
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
      if (!addrData || addrData.length === 0) {
        setShowNewAddressForm(true);
      }

      const { data: cardData } = await supabase
        .from("user_cards")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("id", { ascending: true });

      setCards(cardData || []);
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

    if (!isMobile) return;
    const t = setTimeout(() => {
      if (cartItems.length === 0) {
        emptyStateRef.current?.focus();
        emptyStateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        openModalBtnRef.current?.focus();
        openModalBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);

    return () => clearTimeout(t);
  }, []);

  // ADET GÜNCELLEME
  const updateAdet = async (cartId: number, yeniAdet: number, stok: number) => {
    // ❌ 1’den küçük olamaz
    // ❌ stoktan fazla olamaz
    // ❌ 10’dan fazla olamaz
    if (yeniAdet < 1 || yeniAdet > stok || yeniAdet > 10) return;

    await supabase.from("cart").update({ adet: yeniAdet }).eq("id", cartId);
    setCartItems((prev) =>
      prev.map((c) => (c.id === cartId ? { ...c, adet: yeniAdet } : c))
    );
  };

  const removeFromCart = async (cartId: number) => {
    await supabase.from("cart").delete().eq("id", cartId);
    setCartItems((prev) => prev.filter((c) => c.id !== cartId));
  };

  // İNDİRİMLİ FİYATLI TOPLAM + KARGO
  function hesaplaGenelToplam(cartItems: any[]) {
    const sellerGroups: Record<string, any[]> = {};
    cartItems.forEach((item) => {
      const sellerId = item.product?.user_id;
      if (!sellerId) return;
      if (!sellerGroups[sellerId]) sellerGroups[sellerId] = [];
      sellerGroups[sellerId].push(item);
    });

    let genelToplam = 0;

    for (const sellerId in sellerGroups) {
      const items = sellerGroups[sellerId];
      const araToplam = items.reduce((acc, it) => {
        const fiyat = it.product?.indirimli_fiyat || it.product?.price || 0;
        return acc + Number(fiyat) * (it.adet || 1);
      }, 0);

      const kargoAyar = items[0]?.kargo;
      let kargoUcret = 0;

      if (kargoAyar) {
        if (
          kargoAyar.free_shipping_enabled &&
          araToplam >= (kargoAyar.free_shipping_threshold || 0)
        ) {
          kargoUcret = 0;
        } else {
          kargoUcret = kargoAyar.shipping_fee || 0;
        }
      }

      genelToplam += araToplam + kargoUcret;
    }

    return genelToplam;
  }

  const toplamFiyat = hesaplaGenelToplam(cartItems);

  // SİPARİŞ VER — aynı satıcıya tek order
  async function handleSiparisVer(siparisBilgi: any) {
    if (cartItems.length === 0) {
      alert("Sepetiniz boş!");
      return;
    }

    try {
      type Grup = {
        sellerId: string;
        sellerEmail: string;
        firmaAdi?: string;
        items: any[];
      };
      const gruplar = new Map<string, Grup>();

      // Satıcıya göre ürünleri grupla
      for (const it of cartItems) {
        const sellerId = it?.product?.user_id;
        const sellerEmail = it?.product?.user_email || "";
        const firmaAdi = it?.product?.firma_adi;
        if (!sellerId) continue;
        if (!gruplar.has(sellerId))
          gruplar.set(sellerId, { sellerId, sellerEmail, firmaAdi, items: [] });
        gruplar.get(sellerId)!.items.push(it);
      }

      for (const [, grup] of gruplar) {
        // 🔄 GÜNCEL: tek seçenekli/tekil alanları da siparişe düşür
        const items = grup.items.map((sepetItem: any) => {
          const prodOpts = normalizeOzellikler(sepetItem.product?.ozellikler) || {};
          let kategoriOzellikleri: Record<string, string[]> = {};
          if (sepetItem.product?.kategori_id === 7) {
            // 1 = Gıda (kendi id'ine göre değiştir)
            kategoriOzellikleri = { Ağırlık: ["250 gr", "500 gr", "1 kg"] };
          } else if (sepetItem.product?.kategori_i === 3) {
            // 2 = Giyim
            kategoriOzellikleri = {
              Renk: ["Beyaz", "Siyah", "Kırmızı"],
              Beden: ["S", "M", "L", "XL"],
            };
          }
          const combined: Record<string, string[]> = { ...kategoriOzellikleri, ...prodOpts };

          // tek seçenek/tekil alanları varsayılan kabul et
          const defaults: Record<string, string> = {};
          for (const [k, arr] of Object.entries(combined)) {
            const a = (arr || []).filter(Boolean);
            if (a.length === 1) defaults[k] = a[0];
          }
          const finalOzellikler = { ...defaults, ...(sepetItem.ozellikler || {}) };

          return {
            product_id: sepetItem.product?.id ?? sepetItem.product_id,
            title: sepetItem.product?.title,
            price: sepetItem.product?.price,
            adet: sepetItem.adet,
            resim_url: sepetItem.product?.resim_url,
            ozellikler: finalOzellikler,
          };
        });

        const total = items.reduce(
          (acc: number, it: any) =>
            acc + (parseFloat(it.price) || 0) * (it.adet || 1),
          0
        );

        // Adres bilgisi
        const { data: addressData, error: addressError } = await supabase
          .from("user_addresses")
          .select("*")
          .eq("id", siparisBilgi.addressId)
          .single();
        if (addressError) throw addressError;

        // 1️⃣ Kullanıcı için kayıt
        const userPayload: any = {
          user_id: currentUser.id,
          seller_id: grup.sellerId,
          cart_items: items,
          total_price: total,
          status: "beklemede",
          created_at: new Date(),
          custom_address: addressData,
        };

        if (!siparisBilgi.isCustom) {
          userPayload.address_id = siparisBilgi.addressId;
          userPayload.card_id = siparisBilgi.cardId;
        }

        const { data: insertedOrder, error: orderError } = await supabase
          .from("orders")
          .insert([userPayload])
          .select()
          .single();
        if (orderError) throw orderError;

        // 2️⃣ Satıcı için kayıt (kart bilgisi yok)
        const sellerPayload: any = {
          seller_id: grup.sellerId,
          order_id: insertedOrder.id,
          total_price: total,
          status: "beklemede",
          created_at: new Date(),
          first_name: addressData?.first_name,
          last_name: addressData?.last_name,
          phone: addressData?.phone,
          city: addressData?.city,
          address: addressData?.address,
          custom_features: items.map((i: any) => ({
            title: i.title,
            adet: i.adet,
            ozellikler: i.ozellikler,
          })),
        };

        const { error: sellerError } = await supabase
          .from("seller_orders")
          .insert([sellerPayload]);
        if (sellerError) throw sellerError;

        // Mail
        const urunBaslik =
          items.length > 1
            ? `${items[0].title} +${items.length - 1} ürün`
            : items[0].title;

        await sendOrderEmails({
          aliciMail: currentUser.email,
          saticiMail: grup.sellerEmail,
          urunBaslik,
          urunFiyat: total,
          siparisNo: insertedOrder?.id,
        });
      }

      // Sepeti temizle
      await supabase.from("cart").delete().eq("user_id", currentUser.id);
      setCartItems([]);
      alert("Sipariş(ler) başarıyla oluşturuldu!");
    } catch (err: any) {
      console.error("orders/seller_orders insert error:", err);
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
          <>
            {cartItems.map((item) => {
              const indirimVar =
                item.product?.indirimli_fiyat &&
                item.product?.indirimli_fiyat !== item.product?.price;
              const stok = item.product?.stok ?? 99;

              // ✅ Satıcının girdiği tüm özellikleri al
              const prodOpts = normalizeOzellikler(item.product?.ozellikler) || {};

              // ✅ Kategoriye özel ek alanlar (id'lerini kendi sistemine göre düzenle)
              let kategoriOzellikleri: Record<string, string[]> = {};
              if (item.product?.kategori_id === 7) {
                // 1 = Gıda
                kategoriOzellikleri = { Ağırlık: ["250 gr", "500 gr", "1 kg"] };
              } else if (item.product?.kategori_id === 3) {
                // 2 = Giyim
                kategoriOzellikleri = {
                  Renk: ["Beyaz", "Siyah", "Kırmızı"],
                  Beden: ["S", "M", "L", "XL"],
                };
              }

              // ✅ Satıcı + kategori birleşimi
              // ✅ Satıcı + kategori birleşimi (satıcı girdiyse kategori defaultunu ez)
const combinedOpts: Record<string, string[]> = { ...kategoriOzellikleri };

for (const [key, val] of Object.entries(prodOpts)) {
  combinedOpts[key] = val; // satıcı varsa öncelikli olsun
}


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

                    {/* ✅ Özelliklerin gösterimi (tekil → yazı, çoklu → select) */}
                   {Object.entries(combinedOpts)
  .filter(([, secenekler]) => Array.isArray(secenekler) && secenekler.length > 0)
  .map(([ozellik, secenekler]) => {
    const arr = secenekler.filter(Boolean);
    const seciliDeger =
      (item.ozellikler && item.ozellikler[ozellik]) ||
      (arr.length === 1 ? arr[0] : "");

    // ✅ Eğer sadece 1 seçenek varsa hiç gösterme
    if (arr.length === 1) {
      return null;
    }

    // ✅ Birden fazla varsa select göster
    return (
      <div key={ozellik} style={{ marginBottom: 4 }}>
        <b>{prettyLabel(ozellik)}:</b>{" "}
        <select
          value={seciliDeger}
          onChange={async (e) => {
            const yeniOzellikler = {
              ...(item.ozellikler || {}),
              [ozellik]: e.target.value,
            };
            await supabase.from("cart").update({ ozellikler: yeniOzellikler }).eq("id", item.id);
            setCartItems((prev) =>
              prev.map((urun) =>
                urun.id === item.id ? { ...urun, ozellikler: yeniOzellikler } : urun
              )
            );
          }}
        >
          <option value="">Seçiniz</option>
          {arr.map((secenek) => (
            <option key={secenek} value={secenek}>
              {secenek}
            </option>
          ))}
        </select>
      </div>
    );
  })}



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
                        disabled={item.adet >= stok || item.adet >= 10} // ✅ 10 sınırı eklendi
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
              {cartItems.length > 0 &&
                [...new Set(cartItems.map((c) => c.product?.user_id))].map((sid) => {
                  const sellerItems = cartItems.filter((ci) => ci.product?.user_id === sid);
                  const araToplam = sellerItems.reduce(
                    (a, ci) =>
                      a +
                      Number(ci.product?.indirimli_fiyat || ci.product?.price) * ci.adet,
                    0
                  );
                  const kargo = sellerItems[0]?.kargo;
                  if (!kargo) return null;
                  const ucret =
                    kargo.free_shipping_enabled &&
                    araToplam >= kargo.free_shipping_threshold
                      ? 0
                      : kargo.shipping_fee || 0;

                  return (
                    <div key={sid}>
                      Kargo: {ucret} ₺{" "}
                      {ucret === 0 && kargo?.free_shipping_enabled && (
                        <span style={{ color: "green" }}>(Ücretsiz Kargo)</span>
                      )}
                    </div>
                  );
                })}

              <div style={{ marginTop: 10 }}>
                Genel Toplam: {toplamFiyat.toLocaleString("tr-TR")} ₺
              </div>
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
                      if (e.target.value) setShowNewAddressForm(false);
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
                    placeholder="İsim"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, first_name: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Soy İsim"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, last_name: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Telefon (05XXXXXXXXX)"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, phone: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Adres Başlığı"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, title: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Açık Adres"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, address: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Şehir"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, city: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Posta Kodu"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, postal_code: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Ülke"
                    style={inputStyle}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, country: e.target.value })
                    }
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
            </div>

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
                      if (e.target.value) setShowNewCardForm(false);
                    }}
                    value={selectedCardId}
                  >
                    <option value="">Kart Seçiniz</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} •••• {String(c.card_number).slice(-4)}
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
                  {/* Kart Üzerindeki İsim */}
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Kart Başlığı"
                    value={newCard.title}
                    onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                  />
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Kart Üzerindeki İsim"
                    value={newCard.name_on_card}
                    onChange={(e) => setNewCard({ ...newCard, name_on_card: e.target.value })}
                  />

                  {/* Kart Numarası */}
                  <input
                    style={inputStyle}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="Kart Numarası"
                    value={newCard.card_number}
                    maxLength={19}
                    onChange={(e) =>
                      setNewCard({ ...newCard, card_number: formatCardNumber(e.target.value) })
                    }
                  />

                  {/* Son Kullanma Tarihi */}
                  <input
                    style={inputStyle}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="Son Kullanma (AA/YY)"
                    value={newCard.expiry}
                    maxLength={5}
                    onChange={(e) => setNewCard({ ...newCard, expiry: formatExpiry(e.target.value) })}
                  />

                  {/* CVV */}
                  <input
                    style={inputStyle}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="CVV"
                    value={newCard.cvv}
                    maxLength={4}
                    onChange={(e) => setNewCard({ ...newCard, cvv: formatCVV(e.target.value) })}
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

            <button
              ref={openModalBtnRef}
              onClick={async () => {
                // Basit validasyonlar
                if (!selectedAddressId) return alert("Adres seçiniz");
                if (!selectedCardId) return alert("Kart seçiniz");

                const addr = addresses.find((a) => Number(a.id) === Number(selectedAddressId));
                const card = cards.find((c) => Number(c.id) === Number(selectedCardId));
                if (!addr) return alert("Adres bulunamadı");
                if (!card) return alert("Kart bulunamadı");

                // Basket'i hazırla
                const basketItems = cartItems.map((it: any) => {
                  const indirimVar =
                    it.product?.indirimli_fiyat && it.product?.indirimli_fiyat !== it.product?.price;
                  const birim = indirimVar
                    ? Number(it.product.indirimli_fiyat)
                    : Number(it.product?.price);
                  const toplam = birim * (it.adet || 1);
                  return {
                    id: it.product?.id ?? it.product_id,
                    name: it.product?.title,
                    category1: "Genel",
                    price: toplam,
                  };
                });

                // 1) ÖDEME
                let paymentRes: Response;
                try {
                  paymentRes = await fetch("/api/payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "payRaw",
                      amount: Number(toplamFiyat.toFixed(2)),
                      card: {
                        name_on_card: card.name_on_card,
                        card_number: card.card_number,
                        expiry: card.expiry,
                        cvv: card.cvv,
                      },
                      buyer: {
                        id: currentUser.id,
                        name: addr.first_name || "Ad",
                        surname: addr.last_name || "Soyad",
                        email: currentUser.email,
                        gsmNumber: addr.phone || "",
                      },
                      address: {
                        address: addr.address,
                        city: addr.city,
                        country: addr.country,
                        postal_code: addr.postal_code || "",
                      },
                      basketItems,
                    }),
                  });
                } catch (e) {
                  console.error("payment fetch error:", e);
                  alert("Ödeme servisine ulaşılamadı.");
                  return;
                }

                if (!paymentRes.ok) {
                  const raw = await paymentRes.text().catch(() => "");
                  console.error("payment not ok:", paymentRes.status, raw);
                  alert("Ödeme API hatası (HTTP " + paymentRes.status + ")");
                  return;
                }

                let paymentData: any = null;
                try {
                  paymentData = await paymentRes.json();
                } catch (e) {
                  const raw = await paymentRes.text().catch(() => "");
                  console.error("payment json parse:", e, raw);
                  alert("Ödeme servisinden beklenmeyen yanıt.");
                  return;
                }

                if (!paymentData?.success) {
                  alert("💳 Ödeme başarısız: " + (paymentData?.message || "bilinmeyen hata"));
                  return;
                }

                // 2) Ödeme başarılı → siparişi kaydet
                await handleSiparisVer({
                  addressId: parseInt(selectedAddressId),
                  cardId: parseInt(selectedCardId),
                  isCustom: false,
                });
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "#16a34a",
                color: "#fff",
                fontSize: "16px",
                fontWeight: "bold",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
              }}
            >
              ✅ Sipariş Ver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
