import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";

export default function Sepet2() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Header bar - beyaz, logo solda, "Sepetim" ortada
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

      // product array olarak gelirse ilk elemanı al
      const fixedData = data?.map((item: any) => ({
        ...item,
        product: Array.isArray(item.product) ? item.product[0] : item.product,
      })) || [];

      setCartItems(fixedData);
    };

    fetchCart();
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
            style={{ textAlign: "center", color: "#64748b", fontSize: 17, padding: 40 }}
          >
            Sepetiniz boş.
          </p>
        ) : (
          <>
            {cartItems.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", gap: 14, marginBottom: 16, alignItems: "center" }}
              >
                <img
                  src={item.product?.resim_url || "/placeholder.jpg"}
                  alt={item.product?.title}
                  width={70}
                  height={70}
                  style={{ borderRadius: 9, background: "#f3f4f6" }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px", fontWeight: 700, color: "#333" }}>
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
              onClick={() => alert("🚀 Sipariş sayfası entegre edilecek!")}
            >
              ✅ Sipariş Ver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
