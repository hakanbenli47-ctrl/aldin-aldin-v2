import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import DopingModal from "../components/DopingModal";
import type React from "react";

function OzellikEtiketleri({ item }: { item: any }) {
  const options = item?.options || {};     // ürünün özellik snapshot’ı
  const selection = item?.selection || {}; // alıcının seçimi (beden/renk/Miktar...)

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    background: "#eef2ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 800,
    marginRight: 6,
    marginTop: 4,
  };

 const tags: React.ReactNode[] = [];

  // 1) Seçimler (örn. beden: M, renk: Siyah, Miktar: 500 gr)
  Object.entries(selection).forEach(([k, v]) => {
    if (v !== null && v !== "" && v !== undefined) {
      tags.push(
        <span key={"sel-" + k} style={chip}>
          {k}: {String(v)}
        </span>
      );
    }
  });

  // 2) Bilgi alanları (örn. sonTuketim, agirlikMiktar/agirlikBirim)
  Object.entries(options).forEach(([k, v]: any) => {
    if (Array.isArray(v)) return;            // seçim listelerini tekrar göstermeyelim
    if (selection && selection[k] != null) return; // zaten seçimde gösterildi
    if (v == null || typeof v === "object") return;
    tags.push(
      <span key={"inf-" + k} style={chip}>
        {k}: {String(v)}
      </span>
    );
  });

  return tags.length ? (
    <div style={{ display: "flex", flexWrap: "wrap" }}>{tags}</div>
  ) : null;
}

const TABS = [
  { key: "ilanlar", label: "Yayındaki İlanlar" },
  { key: "siparisler", label: "Gelen Siparişler" },
];

// --- Kargo Firmaları
const KARGO_FIRMALARI = [
  "Yurtiçi Kargo",
  "MNG Kargo",
  "Aras Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS",
  "Diğer",
];

function YazIndirimleri({ ilanlar }: { ilanlar: any[] }) {
  const yazIndirimliUrunler = ilanlar.filter(
    (i) => i.kampanyali && i.indirimli_fiyat && i.indirimli_fiyat !== i.price
  );
  if (!yazIndirimliUrunler.length) return null;
  // Tıklama olmasın, sadece listele
  return (
    <section style={{ margin: "34px 0 40px 0" }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#22c55e",
          marginBottom: 14,
        }}
      >
        🌞 Yaz İndirimi Başladı!
      </h2>
      <div style={{ display: "flex", gap: 18, overflowX: "auto" }}>
        {yazIndirimliUrunler.map((urun) => (
          <div
            key={urun.id}
            style={{
              minWidth: 200,
              maxWidth: 230,
              background: "#fff",
              borderRadius: 13,
              boxShadow: "0 2px 13px #22c55e12",
              border: "2px solid #dcfce7",
              marginRight: 5,
              padding: "13px 9px",
            }}
          >
            <img
              src={
                Array.isArray(urun.resim_url)
                  ? urun.resim_url[0] || "/placeholder.jpg"
                  : urun.resim_url || "/placeholder.jpg"
              }
              alt={urun.title}
              style={{
                width: "100%",
                height: 92,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #dcfce7",
              }}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#14b8a6",
                marginTop: 7,
              }}
            >
              {urun.title}
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#22c55e",
              }}
            >
              <span
                style={{
                  textDecoration: "line-through",
                  color: "#d1d5db",
                  fontWeight: 600,
                  marginRight: 5,
                }}
              >
                {urun.price}₺
              </span>
              <span style={{ color: "#22c55e" }}>{urun.indirimli_fiyat}₺</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
type OrderStatus =
  | "beklemede"
  | "Onaylandı"
  | "Kargoya Verildi"
  | "Teslim Edildi"
  | "İptal";

type SiparisEdit = {
  kargoNo?: string;
  kargoFirma?: string;
  editing?: boolean;
};


// Sipariş durumunu güncelle ve mail gönder
const durumGuncelle = async (
  siparisId: number,
  yeniDurum: OrderStatus,
  aliciEmail?: string
): Promise<void> => {
  const { error } = await supabase
    .from("orders")
    .update({ status: yeniDurum }) // <- 'durum' değil 'status'
    .eq("id", siparisId);

  if (!error) {
    await fetch("/api/send-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: aliciEmail,
        subject: `Siparişiniz ${yeniDurum} - #${siparisId}`,
        text: `Merhaba,\n#${siparisId} numaralı siparişinizin durumu '${yeniDurum}' olarak güncellendi.`,
        html: `<p>Merhaba,</p><p><b>#${siparisId}</b> numaralı siparişinizin durumu '<b>${yeniDurum}</b>' olarak güncellendi.</p>`
      }),
    });
    alert(`Sipariş durumu '${yeniDurum}' olarak güncellendi ve mail gönderildi ✅`);
  } else {
    alert("Durum güncellenemedi ❌");
  }
};


export default function SaticiPanel() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState<string>("");
  const [activeTab, setActiveTab] = useState("ilanlar");
  const [user, setUser] = useState<any>(null);
  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [siparisler, setSiparisler] = useState<any[]>([]);
  const [siparisTab, setSiparisTab] = useState<"aktif" | "gecmis">("aktif");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<{
    title: string;
    price: string;
    desc: string;
    kampanyali?: boolean;
    indirimli_fiyat?: string;
  }>({ title: "", price: "", desc: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIlan, setSelectedIlan] = useState<any>(null);
  const [siparisEdits, setSiparisEdits] = useState<Record<number, SiparisEdit>>(
    {}
  );

  // ---- AKTİF/GEÇMİŞ AYRIMI ----
  const aktifSiparisler = siparisler.filter(
    (s) =>
      s.status !== "Teslim Edildi" &&
      s.status !== "İptal" &&
      s.iade_durumu !== "Süreci Tamamlandı" &&
      s.iade_durumu !== "Onaylandı"
  );
  const gecmisSiparisler = siparisler.filter(
    (s) =>
      s.status === "Teslim Edildi" ||
      s.status === "İptal" ||
      s.iade_durumu === "Süreci Tamamlandı" ||
      s.iade_durumu === "Onaylandı"
  );

  useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    fetchUser();
  }, []);
  // Firma adını çek
  useEffect(() => {
    if (!user) return;
    supabase
      .from("satici_firmalar")
      .select("firma_adi")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.firma_adi) {
          setCompanyName(data.firma_adi);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetchIlanlarVeSiparisler = async () => {
      const { data: ilanlarData } = await supabase
        .from("ilan")
        .select("*")
        .eq("user_email", user.email)
        .order("created_at", { ascending: false });
      setIlanlar(ilanlarData || []);

      setLoading(false);
    };
    fetchIlanlarVeSiparisler();
  }, [user]);

  useEffect(() => {
  if (activeTab !== "siparisler" || !user) return;
  fetchSiparisler();
}, [activeTab, user]);


 // --- SİPARİŞLERİ ÇEK (seller_id ile) + 7 gün sonra sil ---
async function fetchSiparisler() {
  if (!user) return;

  const { data: ordersData, error } = await supabase
    .from("orders")
    .select("*")
    .eq("seller_id", user.id) // <— ARTIK İLAN ID'YE GÖRE DEĞİL, SATICIYA GÖRE
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  setSiparisler(ordersData || []);

  const editObj: Record<number, SiparisEdit> = {};
  (ordersData || []).forEach((sip: any) => {
    editObj[sip.id] = { kargoNo: "", kargoFirma: "", editing: false };
  });
  setSiparisEdits(editObj);

  // 7 GÜN SONRA SİLME
  if (ordersData && ordersData.length > 0) {
    const now = new Date();
    const silinecekSiparisler = ordersData.filter((sip) => {
      const tamam =
        sip.status === "Teslim Edildi" ||
        sip.status === "İptal" ||
        sip.iade_durumu === "Süreci Tamamlandı" ||
        sip.iade_durumu === "Onaylandı";
      if (!tamam) return false;
      const tarih = new Date(sip.updated_at || sip.created_at);
      const farkGun =
        (now.getTime() - tarih.getTime()) / (1000 * 60 * 60 * 24);
      return farkGun >= 7;
    });

    if (silinecekSiparisler.length) {
      const ids = silinecekSiparisler.map((s) => s.id);
      await supabase.from("orders").delete().in("id", ids);

      // tekrar çek
      const { data: yeniOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      setSiparisler(yeniOrders || []);
    }
  }
}


  // Çıkış yap fonksiyonu
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index2";
  };

  function handleEditBaslat(ilan: any) {
    setEditingId(ilan.id);
    setEditVals({
      title: ilan.title,
      price: ilan.price,
      desc: ilan.desc,
      kampanyali: ilan.kampanyali ?? false,
      indirimli_fiyat: ilan.indirimli_fiyat ?? "",
    });
  }
  function handleEditKaydet(id: number) {
    const guncelData = {
      title: editVals.title,
      price: editVals.price,
      desc: editVals.desc,
      kampanyali: editVals.kampanyali || false,
      indirimli_fiyat: editVals.kampanyali ? editVals.indirimli_fiyat : null,
      kampanya_link: editVals.kampanyali ? "/kampanya1" : null,
    };
    supabase
      .from("ilan")
      .update(guncelData)
      .eq("id", id)
      .then(({ error }) => {
        if (!error) {
          setIlanlar((prev: any[]) =>
            prev.map((i) => (i.id === id ? { ...i, ...guncelData } : i))
          );
          setEditingId(null);
          setEditVals({ title: "", price: "", desc: "" });
        } else {
          alert("HATA: " + error.message);
        }
      });
  }
  function handleEditCancel() {
    setEditingId(null);
    setEditVals({ title: "", price: "", desc: "" });
  }
  function handleSil(id: number) {
    if (!confirm("Bu ilanı silmek istediğinize emin misiniz?")) return;
    supabase
      .from("ilan")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (!error) {
          setIlanlar((prev: any[]) => prev.filter((i) => i.id !== id));
        }
      });
  }
  function handleYeniIlanEkle() {
    router.push("/ilan-ver");
  }
  async function handleSiparisOnayla(id: number) {
    await supabase.from("orders").update({ status: "Onaylandı" }).eq("id", id);
    setSiparisEdits((prev) => ({
      ...prev,
      [id]: { kargoNo: "", kargoFirma: "", editing: true },
    }));

    await fetchSiparisler();
    setSiparisEdits((prev) => ({
      ...prev,
      [id]: { kargoNo: "", kargoFirma: "", editing: true },
    }));
  }
  function handleSiparisEdit(
    id: number,
    key: "kargoNo" | "kargoFirma",
    value: string
  ) {
    setSiparisEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value, editing: true },
    }));
  }
  async function handleKargoKaydet(id: number) {
    const kod = siparisEdits[id]?.kargoNo || "";
    const firma = siparisEdits[id]?.kargoFirma || "";
    if (kod.length < 7 || !firma) {
      alert("Kargo firmasını seçin ve geçerli takip numarası girin!");
      return;
    }
    await supabase
      .from("orders")
      .update({
        kargo_takip_no: kod,
        kargo_firma: firma,
        status: "Kargoya Verildi",
      })
      .eq("id", id);
    setSiparisler((prev) =>
      prev.map((sip) =>
        sip.id === id
          ? {
              ...sip,
              kargo_takip_no: kod,
              kargo_firma: firma,
              status: "Kargoya Verildi",
            }
          : sip
      )
    );
    setSiparisEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], kargoNo: kod, kargoFirma: firma, editing: false },
    }));
  }
  async function handleSiparisIptal(id: number) {
    if (!window.confirm("Siparişi iptal etmek istediğine emin misin?")) return;
    await supabase.from("orders").update({ status: "İptal" }).eq("id", id);
    fetchSiparisler();
  }
  function handleFaturaYazdir(siparis: any) {
    const urun = Array.isArray(siparis.cart_items)
      ? siparis.cart_items[0] || {}
      : siparis.cart_items || {};
    const printWindow = window.open("", "_blank");
    printWindow!.document.write(`
      <html>
      <head>
        <title>Fatura - Sipariş #${siparis.id}</title>
        <style>
          body { font-family: Arial; padding: 40px 30px; }
          h2 { color: #2563eb; }
          .urun { font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h2>Fatura - Sipariş #${siparis.id}</h2>
        <div><b>Müşteri:</b> ${siparis.user_id || "-"}</div>
        <div><b>Adres:</b> ${
          siparis.custom_address
            ? JSON.stringify(siparis.custom_address)
            : siparis.address_id ?? "-"
        }</div>
        <div class="urun"><b>Ürün:</b> ${urun.title || "-"} (${
      urun.adet || 1
    } Adet)</div>
        <div><b>Tutar:</b> <span style="color:#13c09a">${
          siparis.total_price
        } ₺</span></div>
        <div><b>Tarih:</b> ${
          siparis.created_at
            ? new Date(siparis.created_at).toLocaleDateString("tr-TR")
            : "-"
        }</div>
      </body>
      </html>
    `);
    printWindow!.print();
  }

  if (!user)
    return (
      <div style={{ textAlign: "center", marginTop: 60, fontSize: 18 }}>
        Yükleniyor...
      </div>
    );

  // -------------- RENDER ---------------
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 40 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 24px 6px 24px",
          background: "#fff",
          boxShadow: "0 2px 10px #e5e7eb33",
          justifyContent: "space-between",
        }}
      >
        {/* Logo ve Başlık */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Image
            src="/logo.png"
            alt="Aldın Aldın"
            width={36}
            height={36}
            style={{ cursor: "default" }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: 19,
              color: "#183869",
              marginLeft: 10,
              letterSpacing: 1,
            }}
          >
            • Satıcı Paneli{companyName ? ` - ${companyName}` : ""}
          </span>
        </div>
        {/* Çıkış Yap Butonu */}
        <button
          onClick={handleLogout}
          style={{
            background: "#ef4444",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            fontWeight: 700,
            fontSize: 15,
            padding: "9px 23px",
            cursor: "pointer",
            marginLeft: 25,
            boxShadow: "0 2px 6px #ef44440d",
          }}
        >
          Çıkış Yap
        </button>
      </div>

      {/* Yaz İndirimi Alanı */}
      {activeTab === "ilanlar" && <YazIndirimleri ilanlar={ilanlar} />}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 18,
          marginLeft: 28,
          alignItems: "center",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 18px",
              borderRadius: 7,
              background: activeTab === tab.key ? "#2563eb" : "#f3f4f6",
              color: activeTab === tab.key ? "#fff" : "#223555",
              border: "none",
              boxShadow: activeTab === tab.key ? "0 4px 12px #2563eb18" : "none",
              cursor: "pointer",
              position: "relative",
            }}
          >
            {tab.label}
            {tab.key === "siparisler" && siparisler.length > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 7px",
                  fontSize: 12,
                  fontWeight: 800,
                  marginLeft: 8,
                  position: "absolute",
                  top: -9,
                  right: -8,
                  border: "2px solid #fff",
                }}
              >
                {siparisler.length}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={handleYeniIlanEkle}
          style={{
            marginLeft: 9,
            fontWeight: 700,
            fontSize: 14,
            padding: "8px 22px",
            borderRadius: 7,
            background: "#13c09a",
            color: "#fff",
            border: "none",
            boxShadow: "0 2px 6px #1bbd8a11",
            cursor: "pointer",
          }}
        >
          + Yeni İlan Ekle
        </button>
      </div>

      <div style={{ marginTop: 22, maxWidth: 1020, marginLeft: "auto", marginRight: "auto" }}>
        {/* İLANLARIM */}
        {activeTab === "ilanlar" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 18,
            }}
          >
            {ilanlar.map((ilan) => (
              <div
                key={ilan.id}
                style={{
                  background: "#fff",
                  borderRadius: 9,
                  boxShadow: "0 2px 10px #e5e7eb16",
                  border: ilan.doped ? "2px solid #1bbd8a" : "1px solid #e6e8ec",
                  padding: 13,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minHeight: 260,
                  transition: "box-shadow 0.2s",
                }}
              >
                {ilan.resim_url?.[0] && (
                  <img
                    src={ilan.resim_url[0]}
                    alt="İlan görseli"
                    style={{
                      width: "100%",
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 7,
                      marginBottom: 8,
                    }}
                  />
                )}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#223555",
                    marginBottom: 2,
                  }}
                >
                  {ilan.title}
                </div>
                <div style={{ color: "#13c09a", fontWeight: 700, fontSize: 13 }}>
                  {ilan.price} ₺
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    marginTop: 5,
                    textAlign: "center",
                    minHeight: 17,
                  }}
                >
                  {ilan.desc}
                </div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 3 }}>
                  👀 {ilan.views || 0} görüntülenme
                </div>
                <small style={{ color: "#aaa", marginTop: 3, fontSize: 11 }}>
                  {ilan.created_at
                    ? new Date(ilan.created_at).toLocaleDateString()
                    : ""}
                </small>
                {editingId === ilan.id ? (
                  <div style={{ marginTop: 6, width: "100%" }}>
                    <input
                      type="text"
                      placeholder="Başlık"
                      value={editVals.title}
                      onChange={(e) =>
                        setEditVals((p) => ({ ...p, title: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        marginBottom: 5,
                        padding: 8,
                        borderRadius: 6,
                        border: "1.5px solid #bfc9d4",
                        fontSize: 15,
                        color: "#1e293b",
                        background: "#f8fafc",
                        fontWeight: 600,
                        outline: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Fiyat"
                      value={editVals.price}
                      onChange={(e) =>
                        setEditVals((p) => ({ ...p, price: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        marginBottom: 5,
                        padding: 8,
                        borderRadius: 6,
                        border: "1.5px solid #bfc9d4",
                        fontSize: 15,
                        color: "#1e293b",
                        background: "#f8fafc",
                        fontWeight: 600,
                        outline: "none",
                      }}
                    />
                    <textarea
                      placeholder="Açıklama"
                      value={editVals.desc}
                      onChange={(e) =>
                        setEditVals((p) => ({ ...p, desc: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        marginBottom: 5,
                        padding: 8,
                        borderRadius: 6,
                        border: "1.5px solid #bfc9d4",
                        minHeight: 36,
                        fontSize: 15,
                        color: "#1e293b",
                        background: "#f8fafc",
                        fontWeight: 600,
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                    <div style={{ marginBottom: 6 }}>
                      <label
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          marginRight: 10,
                          color: "#2563eb",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editVals.kampanyali || false}
                          onChange={(e) =>
                            setEditVals((p) => ({
                              ...p,
                              kampanyali: e.target.checked,
                            }))
                          }
                          style={{ marginRight: 6 }}
                        />
                        Yaz İndirimi Aktif
                      </label>
                      {editVals.kampanyali && (
                        <input
                          type="text"
                          placeholder="İndirimli Fiyat"
                          value={editVals.indirimli_fiyat || ""}
                          onChange={(e) =>
                            setEditVals((p) => ({
                              ...p,
                              indirimli_fiyat: e.target.value,
                            }))
                          }
                          style={{
                            marginLeft: 10,
                            width: 90,
                            padding: 7,
                            borderRadius: 6,
                            border: "1.5px solid #13c09a",
                            fontSize: 15,
                            color: "#166534",
                            background: "#f0fdf4",
                            fontWeight: 700,
                            outline: "none",
                            boxShadow: "0 1px 4px #13c09a10",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleEditKaydet(ilan.id)}
                        style={{
                          flex: 1,
                          background: "#13c09a",
                          color: "#fff",
                          padding: 7,
                          borderRadius: 6,
                          border: "none",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={handleEditCancel}
                        style={{
                          flex: 1,
                          background: "#cf0606ff",
                          color: "#fff",
                          padding: 7,
                          borderRadius: 6,
                          border: "none",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 7,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <button
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        padding: "7px 13px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                      onClick={() => handleEditBaslat(ilan)}
                    >
                      Düzenle
                    </button>
                    <button
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        padding: "7px 13px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSil(ilan.id)}
                    >
                      Sil
                    </button>
                    <button
                      style={{
                        background: "#facc15",
                        color: "#000",
                        border: "none",
                        borderRadius: 7,
                        padding: "7px 13px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setSelectedIlan(ilan);
                        setModalOpen(true);
                      }}
                    >
                      🚀 Öne Çıkar
                    </button>
                    {ilan.kampanyali && (
                      <span
                        style={{
                          marginLeft: 4,
                          color: "#22c55e",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        Yaz İndirimi
                      </span>
                    )}
                  </div>
                )}
                {modalOpen && selectedIlan && selectedIlan.id === ilan.id && (
                  <DopingModal
                    ilan={selectedIlan}
                    onClose={() => setModalOpen(false)}
                    onSuccess={() => {
                      setIlanlar((prev: any[]) =>
                        prev.map((i) =>
                          i.id === selectedIlan.id ? { ...i, doped: true } : i
                        )
                      );
                      setSelectedIlan(null);
                    }}
                  />
                )}
              </div>
            ))}
            {ilanlar.length === 0 && (
              <div
                style={{
                  gridColumn: "1/-1",
                  background: "#f1f5f9",
                  borderRadius: 9,
                  padding: "35px 0",
                  textAlign: "center",
                  color: "#223555",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Yayında ilanınız yok.
              </div>
            )}
          </div>
        )}

        {/* SİPARİŞLER */}
        {activeTab === "siparisler" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button
                onClick={() => setSiparisTab("aktif")}
                style={{
                  background: siparisTab === "aktif" ? "#2563eb" : "#f3f4f6",
                  color: siparisTab === "aktif" ? "#fff" : "#223555",
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Aktif Siparişler ({aktifSiparisler.length})
              </button>
              <button
                onClick={() => setSiparisTab("gecmis")}
                style={{
                  background: siparisTab === "gecmis" ? "#2563eb" : "#f3f4f6",
                  color: siparisTab === "gecmis" ? "#fff" : "#223555",
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Geçmiş Siparişler ({gecmisSiparisler.length})
              </button>
            </div>
            {(siparisTab === "aktif" ? aktifSiparisler : gecmisSiparisler)
              .length === 0 ? (
              <div
                style={{
                  color: "#888",
                  fontSize: 13,
                  padding: 17,
                  textAlign: "center",
                  fontWeight: 700,
                }}
              >
                Şu an için bir siparişiniz yok.
              </div>
            ) : (
              <table
                style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}
              >
                <thead>
                  <tr style={{ background: "#f6f7fb" }}>
                    <th style={thS}>Sipariş No</th>
                    <th style={thS}>Ürün(ler)</th>
                    <th style={thS}>Alıcı</th>
                    <th style={thS}>Tutar</th>
                    <th style={thS}>Durum</th>
                    <th style={thS}>Kargo Firma</th>
                    <th style={thS}>Kargo Takip No</th>
                    <th style={thS}>İade Talebi</th>
                    <th style={thS}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {(siparisTab === "aktif" ? aktifSiparisler : gecmisSiparisler).map(
  (sip: any) => {
                      const edit =
                        siparisEdits[sip.id] || {
                          kargoNo: "",
                          kargoFirma: "",
                          editing: false,
                        };
                      return (
                        <tr key={sip.id} style={{ borderBottom: "1.5px solid #e5e7eb" }}>
                          <td style={tdS}>{sip.id}</td>
                          <td style={tdS}>
  {Array.isArray(sip.cart_items) ? (
    sip.cart_items.map((u: any, i: number) => (
      <div key={i} style={{ marginBottom: 6 }}>
        <div>
          {u.title} <span style={{ color: "#888" }}>x{u.adet}</span>
        </div>
        <OzellikEtiketleri item={u} />
      </div>
    ))
  ) : typeof sip.cart_items === "object" && sip.cart_items !== null ? (
    <div>
      <div>
        {sip.cart_items.title}{" "}
        <span style={{ color: "#888" }}>x{sip.cart_items.adet}</span>
      </div>
      <OzellikEtiketleri item={sip.cart_items} />
    </div>
  ) : (
    "-"
  )}
</td>

                          <td style={tdS}>{sip.user_id || "-"}</td>
                          <td style={{ ...tdS, color: "#089981", fontWeight: 700 }}>
                            {sip.total_price} ₺
                          </td>
                          <td style={tdS}>
                            <span
                              style={{
                                color:
                                  sip.status === "Kargoya Verildi"
                                    ? "#1bbd8a"
                                    : sip.status === "Onaylandı"
                                    ? "#2563eb"
                                    : sip.status === "Teslim Edildi"
                                    ? "#facc15"
                                    : sip.status === "İptal"
                                    ? "#ef4444"
                                    : "#eab308",
                                fontWeight: 700,
                              }}
                            >
                              {sip.status}
                            </span>
                          </td>
                          <td style={tdS}>
                            {sip.kargo_firma ? (
                              <span
                                style={{
                                  background: "#f6f7fb",
                                  borderRadius: 6,
                                  padding: "7px 16px",
                                  fontWeight: 700,
                                  color: "#18181b",
                                  fontSize: 14,
                                  display: "inline-block",
                                }}
                              >
                                {sip.kargo_firma}
                              </span>
                            ) : sip.status === "Onaylandı" && edit.editing ? (
                              <select
                                value={edit.kargoFirma}
                                onChange={(e) =>
                                  handleSiparisEdit(
                                    sip.id,
                                    "kargoFirma",
                                    e.target.value
                                  )
                                }
                                style={{
                                  border: "2px solid #18181b",
                                  borderRadius: 6,
                                  padding: "6px 11px",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  background: "#f6f7fb",
                                  color: "#101010",
                                  outline: "none",
                                  width: "140px",
                                  marginBottom: 4,
                                }}
                              >
                                <option value="">Kargo Firması</option>
                                {KARGO_FIRMALARI.map((firma) => (
                                  <option key={firma} value={firma}>
                                    {firma}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td style={tdS}>
                            {sip.status === "Kargoya Verildi" && sip.kargo_takip_no ? (
                              <span
                                style={{
                                  background: "#f6f7fb",
                                  borderRadius: 6,
                                  border: "1.5px solid #1bbd8a",
                                  padding: "7px 16px",
                                  fontWeight: 700,
                                  color: "#18181b",
                                  fontSize: 14,
                                  display: "inline-block",
                                }}
                              >
                                {sip.kargo_takip_no}
                              </span>
                            ) : sip.status === "Onaylandı" && edit.editing ? (
                              <>
                                <input
                                  placeholder="Kargo Takip No"
                                  value={edit.kargoNo || ""}
                                  minLength={7}
                                  maxLength={40}
                                  onChange={(e) =>
                                    handleSiparisEdit(
                                      sip.id,
                                      "kargoNo",
                                      e.target.value
                                    )
                                  }
                                  style={{
                                    border: "2px solid #18181b",
                                    borderRadius: 6,
                                    padding: "6px 11px",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    background: "#f6f7fb",
                                    color: "#101010",
                                    outline: "none",
                                    width: "140px",
                                    boxShadow:
                                      (edit.kargoNo?.length ?? 0) >= 7
                                        ? "0 0 0 2px #1bbd8a66"
                                        : "0 0 0 1.5px #e5e7eb55",
                                    transition: "all 0.14s",
                                  }}
                                />
                                <button
                                  style={{
                                    ...butS,
                                    background: "#13c09a",
                                    color: "#fff",
                                    fontWeight: 700,
                                    fontSize: 13,
                                    borderRadius: 6,
                                    padding: "6px 17px",
                                    marginLeft: 6,
                                  }}
                                  onClick={() => handleKargoKaydet(sip.id)}
                                  disabled={
                                    (edit.kargoNo?.length ?? 0) < 7 || !edit.kargoFirma
                                  }
                                >
                                  Kaydet
                                </button>
                              </>
                            ) : sip.status === "Onaylandı" && !sip.kargo_takip_no ? (
                              <button
                                style={{
                                  ...butS,
                                  background: "#13c09a",
                                  color: "#fff",
                                  fontWeight: 700,
                                  fontSize: 13,
                                  borderRadius: 6,
                                  padding: "6px 17px",
                                }}
                                onClick={() =>
                                  setSiparisEdits((prev) => ({
                                    ...prev,
                                    [sip.id]: { ...prev[sip.id], editing: true },
                                  }))
                                }
                              >
                                Kargo Bilgisi Gir
                              </button>
                            ) : (
                              sip.status === "beklemede" && (
                                <button
                                  style={{
                                    ...butS,
                                    background: "#2563eb",
                                    color: "#fff",
                                    fontWeight: 700,
                                    fontSize: 13,
                                    borderRadius: 6,
                                    padding: "6px 17px",
                                  }}
                                  onClick={() => handleSiparisOnayla(sip.id)}
                                >
                                  Onayla
                                </button>
                              )
                            )}
                          </td>

                          {/* ---- İADE TALEBİ SÜTUNU (İç içe <td> hatası giderildi) ---- */}
                          <td style={tdS}>
                            {/* --- İADE TALEBİ DURUMU --- */}
                            {sip.iade_durumu === "Talep Edildi" && (
                              <div
                                style={{
                                  background: "#fef3c7",
                                  color: "#92400e",
                                  borderRadius: 7,
                                  fontWeight: 700,
                                  padding: "6px 8px",
                                  marginBottom: 4,
                                  fontSize: 13,
                                }}
                              >
                                Talep: {sip.iade_aciklamasi || "-"}
                                <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                  <button
                                    style={{
                                      ...butS,
                                      background: "#22c55e",
                                      color: "#fff",
                                      fontSize: 13,
                                      padding: "5px 11px",
                                    }}
                                    onClick={async () => {
                                      await supabase
                                        .from("orders")
                                        .update({ iade_durumu: "Onaylandı" })
                                        .eq("id", sip.id);
                                      fetchSiparisler();
                                    }}
                                  >
                                    Onayla
                                  </button>
                                  <button
                                    style={{
                                      ...butS,
                                      background: "#ef4444",
                                      color: "#fff",
                                      fontSize: 13,
                                      padding: "5px 11px",
                                    }}
                                    onClick={async () => {
                                      const reason = prompt("Red sebebini yazınız:");
                                      if (!reason) return;
                                      await supabase
                                        .from("orders")
                                        .update({
                                          iade_durumu: "Reddedildi",
                                          iade_aciklamasi: reason,
                                        })
                                        .eq("id", sip.id);
                                      fetchSiparisler();
                                    }}
                                  >
                                    Reddet
                                  </button>
                                </div>
                              </div>
                            )}
                            {sip.iade_durumu === "Onaylandı" && (
                              <div
                                style={{
                                  background: "#d1fae5",
                                  color: "#065f46",
                                  borderRadius: 7,
                                  fontWeight: 700,
                                  padding: "6px 8px",
                                  marginBottom: 2,
                                  fontSize: 13,
                                }}
                              >
                                İade: Onaylandı
                              </div>
                            )}
                            {sip.iade_durumu === "Reddedildi" && (
                              <div
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  borderRadius: 7,
                                  fontWeight: 700,
                                  padding: "6px 8px",
                                  marginBottom: 2,
                                  fontSize: 13,
                                }}
                              >
                                İade Reddedildi
                                <br />
                                <span
                                  style={{ fontWeight: 500, color: "#b91c1c" }}
                                >
                                  {sip.iade_aciklamasi}
                                </span>
                              </div>
                            )}
                            {sip.iade_durumu === "Süreci Tamamlandı" && (
                              <div
                                style={{
                                  background: "#dbeafe",
                                  color: "#1e40af",
                                  borderRadius: 7,
                                  fontWeight: 700,
                                  padding: "6px 8px",
                                  marginBottom: 2,
                                  fontSize: 13,
                                }}
                              >
                                Süreci Tamamlandı
                              </div>
                            )}
                            {!sip.iade_durumu && (
                              <div
                                style={{
                                  color: "#888",
                                  fontWeight: 700,
                                  fontSize: 13,
                                }}
                              >
                                Yok
                              </div>
                            )}
                          </td>
<td style={tdS}>
  {sip.status === "İptal" && (
    <button
      style={{ ...butS, background: "#ef4444", color: "#fff" }}
      onClick={() => handleSiparisIptal(sip.id)}
    >
      Sil
    </button>
  )}

  {/* Fatura butonu (TEK BAŞINA, self-closing!) */}
  <FaturaYukleButton siparis={sip} onFaturaYuklendi={fetchSiparisler} />

  {/* Ürünü İptal Et — FaturaYukleButton'ın KARDESİ (dışında) */}
  <button
    onClick={async () => {
      if (!confirm("Bu ürünü iptal etmek istediğinize emin misiniz?")) return;

      const { error } = await supabase
        .from("orders")
        .update({ status: "İptal" })
        .eq("id", sip.id);

      if (error) {
        alert("Sipariş iptal edilemedi ❌");
        return;
      }

      try {
    await fetch("/api/send-mail", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: sip.id, // alıcıyı API bulacak
    subject: `Siparişiniz iptal edildi - #${sip.id}`,
    text: `Merhaba,\n#${sip.id} numaralı siparişiniz iptal edilmiştir.`,
    html: `<p>Merhaba,</p><p><b>#${sip.id}</b> numaralı siparişiniz iptal edilmiştir.</p>`
  }),
});


        alert("Sipariş iptal edildi ve mail gönderildi ✅");
      } catch (e) {
        console.error(e);
        alert("Sipariş iptal edildi ama e-posta gönderilemedi.");
      }

      fetchSiparisler();
    }}
    style={{
      ...butS,
      backgroundColor: "#f44336",
      color: "#fff",
      marginLeft: 8,
    }}
  >
    Ürünü İptal Et
  </button>
</td>

                          
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Tablo ve buton stilleri
const thS = {
  fontWeight: 700,
  color: "#183869",
  fontSize: 13,
  padding: "7px 0",
  borderBottom: "2px solid #e5e7eb",
  background: "#f6f7fb",
  letterSpacing: 0.5,
};
const tdS = {
  fontWeight: 700,
  color: "#223555",
  fontSize: 13,
  padding: "7px 0",
  background: "#fff",
};
const butS: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  padding: "7px 14px",
  borderRadius: 6,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  marginRight: 6,
  cursor: "pointer",
  boxShadow: "0 2px 6px #2563eb13",
};

/** ------------------- Fatura Yükleme / Görüntüleme Butonu ------------------- **/
// (ALTINA YAPIŞTIR — eski FaturaYukleButton fonksiyonunun TAMAMI yerine geçecek)
type FaturaYukleButtonProps = {
  siparis: any;
  onFaturaYuklendi?: () => void;
};

function FaturaYukleButton({
  siparis,
  onFaturaYuklendi,
}: FaturaYukleButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [faturaUrl, setFaturaUrl] = useState<string | null>(
    siparis.fatura_url ?? null
  );

  const handleClick = () => {
    if (!faturaUrl) {
      fileInputRef.current?.click();
    } else {
      window.open(faturaUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDosyaYukle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setYukleniyor(true);

    try {
      // 1) Storage'a yükle
      const path = `siparisler/${siparis.id}/${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("faturalar")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      // 2) Public URL
      const { data: publicUrlData } = supabase.storage
        .from("faturalar")
        .getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      // 3) Order güncelle
      const { error: updErr } = await supabase
        .from("orders")
        .update({ fatura_url: publicUrl })
        .eq("id", siparis.id);
      if (updErr) throw updErr;

      setFaturaUrl(publicUrl);
      onFaturaYuklendi?.();

      // 4) E-posta gönder (send-mail ile)
  await fetch("/api/send-mail", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: siparis.id,
    subject: `Faturanız hazır - #${siparis.id}`,
    text: `Merhaba, #${siparis.id} numaralı siparişinizin faturası ektedir.`,
    html: `<p>Merhaba,</p>
           <p><b>#${siparis.id}</b> numaralı siparişinizin faturası ektedir.</p>`,
    // YENİ: storage path’i API’ye veriyoruz ki dosyayı indirip ek yapsın
    invoicePath: path, // örn: siparisler/123/fatura.pdf
  }),
});



      alert("Fatura yüklendi ve alıcıya e-posta gönderildi!");
    } catch (err: any) {
      console.error(err);
      alert("Fatura yüklenemedi: " + (err?.message || "Bilinmeyen hata"));
    } finally {
      setYukleniyor(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "inline-block" }}>
      <button
        style={{
          ...butS,
          background: faturaUrl ? "#fff" : "#2563eb",
          color: faturaUrl ? "#2563eb" : "#fff",
          border: faturaUrl ? "1px solid #2563eb" : "none",
          marginLeft: 6,
          cursor: yukleniyor ? "not-allowed" : "pointer",
        }}
        onClick={handleClick}
        disabled={yukleniyor}
        title={faturaUrl ? "Faturayı görüntüle" : "Fatura yükle"}
      >
        {yukleniyor
          ? "Yükleniyor..."
          : faturaUrl
          ? "Faturayı Görüntüle"
          : "Fatura Yükle"}
      </button>

      <input
        type="file"
        accept="application/pdf,image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleDosyaYukle}
      />
    </div>
  );
}