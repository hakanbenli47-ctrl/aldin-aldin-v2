import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";

// ----- MAIL GÖNDERME (direkt dosyanın başında!)
// Next.js'de api/send-mail.ts şeklinde bir endpoint yazmış olmalısın.
// Aşağıdaki fonksiyon alıcıya ve satıcıya mail yollar.
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
  // Alıcıya mail
  await fetch("/api/send-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: aliciMail,
      subject: `Siparişiniz Alındı! (#${siparisNo})`,
      text: `Siparişiniz başarıyla oluşturuldu!\nÜrün: ${urunBaslik}\nFiyat: ${urunFiyat}₺\nSipariş No: ${siparisNo}`,
      html: `<h2>Siparişiniz Alındı!</h2><p><b>Ürün:</b> ${urunBaslik}</p><p><b>Fiyat:</b> ${urunFiyat}₺</p><p><b>Sipariş No:</b> #${siparisNo}</p>`
    }),
  });

  // Satıcıya mail
  await fetch("/api/send-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: saticiMail,
      subject: `Yeni Sipariş Geldi! (#${siparisNo})`,
      text: `Yeni bir sipariş aldınız!\nÜrün: ${urunBaslik}\nFiyat: ${urunFiyat}₺\nSipariş No: ${siparisNo}`,
      html: `<h2>Yeni Sipariş Geldi!</h2><p><b>Ürün:</b> ${urunBaslik}</p><p><b>Fiyat:</b> ${urunFiyat}₺</p><p><b>Sipariş No:</b> #${siparisNo}</p>`
    }),
  });
}

// ---- Ana Component
export default function Sepet2() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sipariş modalı için
  const [showSiparisModal, setShowSiparisModal] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);

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
            <Image
              src="/logo.png"
              alt="Aldın Aldın Logo"
              width={42}
              height={42}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: 21,
                color: "#223555",
                letterSpacing: 1,
                marginLeft: 2,
                userSelect: "none",
              }}
            >
              Aldın Aldın
            </span>
          </Link>
        </div>
        <div style={{ flex: 2, display: "flex", justifyContent: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 21, color: "#223555" }}>
            Sepetim
          </span>
        </div>
        <div style={{ flex: 1 }}></div>
      </header>
    );
  }

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user || null);
      setLoading(false);
    }
    getUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchCart = async () => {
      const { data, error } = await supabase
        .from("cart")
        .select(`
          id,
          adet,
          product_id,
          product:product_id (
            id,
            title,
            price,
            resim_url
          )
        `)
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("Sepet verisi alınamadı:", error.message);
        return;
      }

      const fixedData =
        data?.map((item: any) => ({
          ...item,
          product: Array.isArray(item.product) ? item.product[0] : item.product,
        })) || [];

      setCartItems(fixedData);
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

  const removeFromCart = async (cartId: number) => {
    await supabase.from("cart").delete().eq("id", cartId);
    setCartItems(cartItems.filter((c) => c.id !== cartId));
  };

  const toplamFiyat = cartItems.reduce((acc, item) => {
    const fiyat =
      typeof item.product?.price === "string"
        ? parseFloat(item.product.price)
        : item.product?.price;
    const adet = item.adet || 1;
    return acc + (fiyat || 0) * adet;
  }, 0);

  // SİPARİŞ VER (her ürüne ayrı order kaydı + mail gönderimi)
  async function handleSiparisVer(siparisBilgi: any) {
    if (cartItems.length === 0) {
      alert("Sepetiniz boş!");
      return;
    }

    for (const item of cartItems) {
      const orderInsertData: any = {
        user_id: currentUser.id,
        ilan_id: item.product_id ?? item.product?.id, // ürünün id'si
        cart_items: {
          product_id: item.product_id ?? item.product?.id,
          title: item.product?.title,
          price: item.product?.price,
          adet: item.adet,
          resim_url: item.product?.resim_url,
        },
        total_price: (item.product?.price || 0) * (item.adet || 1),
        status: "beklemede",
        created_at: new Date(),
      };

      // Kayıtlı adres/kart
      if (siparisBilgi.isCustom) {
        orderInsertData.custom_addre = siparisBilgi.address;
        orderInsertData.custom_card = siparisBilgi.card;
      } else {
        orderInsertData.address_id = siparisBilgi.addressId;
        orderInsertData.card_id = siparisBilgi.cardId;
      }

      // 1- Siparişi kaydet
      const { data: insertedOrder, error } = await supabase
        .from("orders")
        .insert([orderInsertData])
        .select()
        .single();

      if (error) {
        alert("Sipariş kaydedilemedi: " + error.message);
        return;
      }

      // 2- Satıcı mailini ürün üzerinden bul
      let saticiMail = "";
      const { data: ilanData } = await supabase
        .from("ilan")
        .select("user_email")
        .eq("id", item.product_id ?? item.product?.id)
        .single();
      saticiMail = ilanData?.user_email || "";

      // 3- Mail gönder!
      await sendOrderEmails({
        aliciMail: currentUser.email,
        saticiMail,
        urunBaslik: item.product?.title,
        urunFiyat: item.product?.price,
        siparisNo: insertedOrder?.id,
      });
    }

    await supabase.from("cart").delete().eq("user_id", currentUser.id);
    setCartItems([]);
    setShowSiparisModal(false);
    alert("Sipariş(ler) başarıyla oluşturuldu!");
  }

  if (loading)
    return (
      <p style={{ textAlign: "center", padding: 40 }}>
        ⏳ Kullanıcı bilgisi yükleniyor...
      </p>
    );
  if (!currentUser)
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
          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              fontSize: 17,
              padding: 40,
            }}
          >
            Sepetiniz boş.
          </p>
        ) : (
          <>
            {cartItems.map((item) => (
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
                  <div style={{ color: "#22c55e", fontWeight: 600 }}>
                    {item.product?.price} ₺
                  </div>
                  <div style={{ color: "#999", fontSize: 14 }}>
                    Adet: {item.adet || 1}
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
            ))}
            <div
              style={{
                textAlign: "right",
                fontWeight: 800,
                fontSize: 18,
                marginTop: 10,
                color: "#223555",
              }}
            >
              Toplam: {toplamFiyat.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
            </div>
            <button
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
              }}
              onClick={() => setShowSiparisModal(true)}
            >
              ✅ Sipariş Ver
            </button>
          </>
        )}
      </div>

      {/* Sipariş Modalı */}
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
          }}
          onClick={() => setShowSiparisModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SiparisModal
              addresses={addresses}
              cards={cards}
              onSiparisVer={handleSiparisVer}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sipariş Modalı ---
function SiparisModal({ addresses, cards, onSiparisVer }: any) {
  const [useSaved, setUseSaved] = useState(true);

  // Yeni adres/kart state (form inputları)
  const [customAddress, setCustomAddress] = useState({
    title: "",
    address: "",
    city: "",
    postal_code: "",
    country: "",
  });
  const [customCard, setCustomCard] = useState({
    title: "",
    card_holder_name: "",
    card_number: "",
    expiration_date: "",
    cvv: "",
  });

  // Seçili kayıtlı adres/kart
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || null);
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id || null);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 32,
        boxShadow: "0 1px 12px rgba(30,41,59,0.09)",
        maxWidth: 470,
        minWidth: 320,
        margin: "32px auto",
        color: "#222e3a",
      }}
    >
      <h2 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 18 }}>
        Sipariş Bilgileri
      </h2>

      {/* Kayıtlı bilgileri mi yoksa yeni mi */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 18 }}>
          <input
            type="radio"
            checked={useSaved}
            onChange={() => setUseSaved(true)}
          />
          <span style={{ marginLeft: 5 }}>Kayıtlı adres/kart ile sipariş ver</span>
        </label>
        <label>
          <input
            type="radio"
            checked={!useSaved}
            onChange={() => setUseSaved(false)}
          />
          <span style={{ marginLeft: 5 }}>Farklı adres/kart ile sipariş ver</span>
        </label>
      </div>

      {useSaved ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Adres Seç</div>
            <select
              value={selectedAddressId ?? ""}
              onChange={(e) => setSelectedAddressId(Number(e.target.value))}
              style={{ width: "100%", padding: 8, borderRadius: 6 }}
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
              style={{ width: "100%", padding: 8, borderRadius: 6 }}
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
          <div style={{ fontWeight: 600, marginTop: 10 }}>Yeni Adres</div>
          <input
            required
            placeholder="Adres başlığı"
            value={customAddress.title}
            onChange={(e) =>
              setCustomAddress((f) => ({ ...f, title: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="Adres"
            value={customAddress.address}
            onChange={(e) =>
              setCustomAddress((f) => ({ ...f, address: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="Şehir"
            value={customAddress.city}
            onChange={(e) =>
              setCustomAddress((f) => ({ ...f, city: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="Posta Kodu"
            value={customAddress.postal_code}
            onChange={(e) =>
              setCustomAddress((f) => ({ ...f, postal_code: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="Ülke"
            value={customAddress.country}
            onChange={(e) =>
              setCustomAddress((f) => ({ ...f, country: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 10, padding: 7, borderRadius: 7 }}
          />

          <div style={{ fontWeight: 600, marginTop: 10 }}>Yeni Kart</div>
          <input
            required
            placeholder="Kart Başlığı"
            value={customCard.title}
            onChange={(e) =>
              setCustomCard((f) => ({ ...f, title: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="Kart Sahibi"
            value={customCard.card_holder_name}
            onChange={(e) =>
              setCustomCard((f) => ({ ...f, card_holder_name: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="Kart Numarası"
            value={customCard.card_number}
            onChange={(e) =>
              setCustomCard((f) => ({ ...f, card_number: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="Son Kullanma Tarihi (AA/YY)"
            value={customCard.expiration_date}
            onChange={(e) =>
              setCustomCard((f) => ({ ...f, expiration_date: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 6, padding: 7, borderRadius: 7 }}
          />
          <input
            required
            placeholder="CVV"
            value={customCard.cvv}
            onChange={(e) =>
              setCustomCard((f) => ({ ...f, cvv: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 14, padding: 7, borderRadius: 7 }}
          />
        </>
      )}

      <button
        style={{
          background: "#2563eb",
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
          if (useSaved) {
            if (!selectedAddressId || !selectedCardId) {
              alert("Lütfen bir adres ve kart seçin.");
              return;
            }
            onSiparisVer({
              addressId: selectedAddressId,
              cardId: selectedCardId,
              isCustom: false,
            });
          } else {
            if (
              !customAddress.title ||
              !customAddress.address ||
              !customAddress.city ||
              !customAddress.postal_code ||
              !customAddress.country ||
              !customCard.title ||
              !customCard.card_holder_name ||
              !customCard.card_number ||
              !customCard.expiration_date ||
              !customCard.cvv
            ) {
              alert("Tüm adres ve kart alanlarını doldurun.");
              return;
            }
            onSiparisVer({
              address: customAddress,
              card: customCard,
              isCustom: true,
            });
          }
        }}
      >
        Siparişi Tamamla
      </button>
    </div>
  );
}
