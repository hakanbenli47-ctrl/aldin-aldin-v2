import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import DopingModal from "../components/DopingModal";

const TABS = [
  { key: "ilanlar", label: "Yayındaki İlanlar" },
  { key: "siparisler", label: "Gelen Siparişler" },
];

type SiparisEdit = { kargoNo?: string; editing?: boolean };

export default function ProfilPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("ilanlar");
  const [user, setUser] = useState<any>(null);
  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [siparisler, setSiparisler] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState({ title: "", price: "", desc: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIlan, setSelectedIlan] = useState<any>(null);

  const [siparisEdits, setSiparisEdits] = useState<Record<number, SiparisEdit>>({});

  // 1. Kullanıcı çek
  useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    fetchUser();
  }, []);

  // 2. İlanlar ve Siparişler çek
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
      if (ilanlarData && ilanlarData.length > 0) {
        await fetchSiparisler(ilanlarData);
      } else {
        setSiparisler([]);
        setSiparisEdits({});
      }
      setLoading(false);
    };
    fetchIlanlarVeSiparisler();
    // eslint-disable-next-line
  }, [user]);

  // 3. Sekme değişince siparişleri güncelle
  useEffect(() => {
    if (activeTab === "siparisler" && ilanlar.length > 0) {
      fetchSiparisler(ilanlar);
    }
    // eslint-disable-next-line
  }, [activeTab, ilanlar]);

  // 4. Siparişler state ve edit state'i güncelle
  async function fetchSiparisler(ilanlarInput = ilanlar) {
    if (!ilanlarInput.length) return;
    const ilanIds = ilanlarInput.map((i: any) => i.id);
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .in("ilan_id", ilanIds)
      .order("created_at", { ascending: false });
    setSiparisler(ordersData || []);
    // Kargo kodu varsa input kapalı, yoksa açık
    const editObj: Record<number, SiparisEdit> = {};
    (ordersData || []).forEach((sip: any) => {
      editObj[sip.id] = { kargoNo: "", editing: false };
    });
    setSiparisEdits(editObj);
  }

  // İlan düzenleme (değişmedi)
  function handleEditBaslat(ilan: any) {
    setEditingId(ilan.id);
    setEditVals({ title: ilan.title, price: ilan.price, desc: ilan.desc });
  }
  function handleEditKaydet(id: number) {
    supabase
      .from("ilan")
      .update({
        title: editVals.title,
        price: editVals.price,
        desc: editVals.desc,
      })
      .eq("id", id)
      .then(({ error }) => {
        if (!error) {
          setIlanlar((prev: any[]) =>
            prev.map((i) => (i.id === id ? { ...i, ...editVals } : i))
          );
          setEditingId(null);
          setEditVals({ title: "", price: "", desc: "" });
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
  function goToHome() {
    router.push("/");
  }
  function handleYeniIlanEkle() {
    router.push("/ilan-ver");
  }

  // SİPARİŞ İŞLEMLERİ -----

  // Onayla butonu: siparişi "Onaylandı" yap, kargo kodu için inputu aç
  async function handleSiparisOnayla(id: number) {
    await supabase.from("orders").update({ status: "Onaylandı" }).eq("id", id);
    setSiparisEdits((prev) => ({ ...prev, [id]: { kargoNo: "", editing: true } }));
    await fetchSiparisler();
    setSiparisEdits((prev) => ({ ...prev, [id]: { kargoNo: "", editing: true } }));
  }

  // Kargo Takip No yazma (state güncelle)
  function handleSiparisEdit(id: number, value: string) {
    setSiparisEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], kargoNo: value, editing: true }
    }));
  }

  // Kargo Takip No Kaydet: DB’ye yaz, inputu kapat, yazıyı göster!
  async function handleKargoNoKaydet(id: number) {
    const kod = siparisEdits[id]?.kargoNo || "";
    if (kod.length < 13) {
      alert("Kargo takip numarası en az 13 karakter olmalı!");
      return;
    }
    await supabase.from("orders").update({ kargo_takip_no: kod, status: "Kargoya Verildi" }).eq("id", id);
    setSiparisler((prev) =>
      prev.map((sip) =>
        sip.id === id
          ? { ...sip, kargo_takip_no: kod, status: "Kargoya Verildi" }
          : sip
      )
    );
    setSiparisEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], kargoNo: kod, editing: false }
    }));
  }

  async function handleSiparisIptal(id: number) {
    if (!window.confirm("Siparişi iptal etmek istediğine emin misin?")) return;
    await supabase.from("orders").delete().eq("id", id);
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
        <div><b>Adres:</b> ${siparis.custom_address ? JSON.stringify(siparis.custom_address) : (siparis.address_id ?? "-")}</div>
        <div class="urun"><b>Ürün:</b> ${urun.title || "-"} (${urun.adet || 1} Adet)</div>
        <div><b>Tutar:</b> <span style="color:#13c09a">${siparis.total_price} ₺</span></div>
        <div><b>Tarih:</b> ${siparis.created_at ? new Date(siparis.created_at).toLocaleDateString("tr-TR") : "-"}</div>
      </body>
      </html>
    `);
    printWindow!.print();
  }

  if (!user)
    return <div style={{ textAlign: "center", marginTop: 60, fontSize: 18 }}>Yükleniyor...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", padding: "16px 24px 6px 24px",
        background: "#fff", boxShadow: "0 2px 10px #e5e7eb33"
      }}>
        <Image
          src="/logo.png"
          alt="Aldın Aldın"
          width={36}
          height={36}
          style={{ cursor: "pointer" }}
          onClick={goToHome}
        />
        <span style={{
          fontWeight: 700, fontSize: 19, color: "#183869",
          marginLeft: 10, letterSpacing: 1
        }}>
          Aldın Aldın • Profilim
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 16,
        marginTop: 18,
        marginLeft: 28,
        alignItems: "center"
      }}>
        {TABS.map(tab => (
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
              position: "relative"
            }}
          >
            {tab.label}
            {tab.key === "siparisler" && siparisler.length > 0 && (
              <span style={{
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
                border: "2px solid #fff"
              }}>{siparisler.length}</span>
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
            cursor: "pointer"
          }}
        >
          + Yeni İlan Ekle
        </button>
      </div>

      <div style={{ marginTop: 22, maxWidth: 1020, marginLeft: "auto", marginRight: "auto" }}>
        {activeTab === "ilanlar" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 18
          }}>
            {/* ...ilan kartları kısmı (değişmedi) */}
            {ilanlar.map((ilan) => (
              <div key={ilan.id} style={{
                background: "#fff",
                borderRadius: 9,
                boxShadow: "0 2px 10px #e5e7eb16",
                border: ilan.doped ? "2px solid #1bbd8a" : "1px solid #e6e8ec",
                padding: 13,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minHeight: 260,
                transition: "box-shadow 0.2s"
              }}>
                {ilan.resim_url?.[0] && (
                  <img
                    src={ilan.resim_url[0]}
                    alt="İlan görseli"
                    style={{
                      width: "100%",
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 7,
                      marginBottom: 8
                    }}
                  />
                )}
                <div style={{ fontWeight: 700, fontSize: 15, color: "#223555", marginBottom: 2 }}>{ilan.title}</div>
                <div style={{ color: "#13c09a", fontWeight: 700, fontSize: 13 }}>{ilan.price} ₺</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 5, textAlign: "center", minHeight: 17 }}>{ilan.desc}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 3 }}>👀 {ilan.views || 0} görüntülenme</div>
                <small style={{ color: "#aaa", marginTop: 3, fontSize: 11 }}>
                  {ilan.created_at ? new Date(ilan.created_at).toLocaleDateString() : ""}
                </small>
                {editingId === ilan.id ? (
                  <div style={{ marginTop: 6, width: "100%" }}>
                    <input
                      type="text"
                      placeholder="Başlık"
                      value={editVals.title}
                      onChange={(e) => setEditVals((p) => ({ ...p, title: e.target.value }))}
                      style={{ width: "100%", marginBottom: 5, padding: 6, borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    <input
                      type="text"
                      placeholder="Fiyat"
                      value={editVals.price}
                      onChange={(e) => setEditVals((p) => ({ ...p, price: e.target.value }))}
                      style={{ width: "100%", marginBottom: 5, padding: 6, borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    <textarea
                      placeholder="Açıklama"
                      value={editVals.desc}
                      onChange={(e) => setEditVals((p) => ({ ...p, desc: e.target.value }))}
                      style={{ width: "100%", marginBottom: 5, padding: 6, borderRadius: 6, border: "1px solid #ccc", minHeight: 36 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleEditKaydet(ilan.id)} style={{ flex: 1, background: "#13c09a", color: "#fff", padding: 7, borderRadius: 6, border: "none", fontWeight: 700, fontSize: 13 }}>
                        Kaydet
                      </button>
                      <button onClick={handleEditCancel} style={{ flex: 1, background: "#e5e7eb", color: "#333", padding: 7, borderRadius: 6, border: "none", fontWeight: 700, fontSize: 13 }}>
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 7, display: "flex", gap: 8 }}>
                    <button
                      style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, padding: "7px 13px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      onClick={() => handleEditBaslat(ilan)}
                    >
                      Düzenle
                    </button>
                    <button
                      style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 7, padding: "7px 13px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      onClick={() => handleSil(ilan.id)}
                    >
                      Sil
                    </button>
                    <button
                      style={{ background: "#facc15", color: "#000", border: "none", borderRadius: 7, padding: "7px 13px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      onClick={() => { setSelectedIlan(ilan); setModalOpen(true); }}
                    >
                      🚀 Öne Çıkar
                    </button>
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
              <div style={{
                gridColumn: "1/-1",
                background: "#f1f5f9",
                borderRadius: 9,
                padding: "35px 0",
                textAlign: "center",
                color: "#223555",
                fontWeight: 700,
                fontSize: 14
              }}>
                Yayında ilanınız yok.
              </div>
            )}
          </div>
        )}

        {/* ------ GELEN SİPARİŞLER -------- */}
        {activeTab === "siparisler" && (
          <div style={{ background: "#fff", borderRadius: 9, boxShadow: "0 2px 9px #e5e7eb22", padding: 15 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, color: "#223555", marginBottom: 13 }}>Tüm Gelen Siparişler</h2>
            {siparisler.length === 0 ? (
              <div style={{ color: "#888", fontSize: 13, padding: 17, textAlign: "center", fontWeight: 700 }}>
                Şu an için bir siparişiniz yok.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#f6f7fb" }}>
                    <th style={thS}>Sipariş No</th>
                    <th style={thS}>Ürün(ler)</th>
                    <th style={thS}>Alıcı</th>
                    <th style={thS}>Tutar</th>
                    <th style={thS}>Durum</th>
                    <th style={thS}>Kargo Takip No</th>
                    <th style={thS}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {siparisler.map(sip => {
                    const edit = siparisEdits[sip.id] || { kargoNo: "", editing: false };
                    return (
                      <tr key={sip.id} style={{ borderBottom: "1.5px solid #e5e7eb" }}>
                        <td style={tdS}>{sip.id}</td>
                        <td style={tdS}>
                          {Array.isArray(sip.cart_items)
                            ? sip.cart_items.map((u: any, i: number) => (
                              <div key={i}>{u.title} <span style={{ color: "#888" }}>x{u.adet}</span></div>
                            ))
                            : typeof sip.cart_items === "object" && sip.cart_items !== null ? (
                              <div>{sip.cart_items.title} <span style={{ color: "#888" }}>x{sip.cart_items.adet}</span></div>
                            ) : "-"}
                        </td>
                        <td style={tdS}>{sip.user_id || "-"}</td>
                        <td style={{ ...tdS, color: "#089981", fontWeight: 700 }}>{sip.total_price} ₺</td>
                        <td style={tdS}>
                          <span style={{
                            color:
                              sip.status === "Kargoya Verildi" ? "#1bbd8a" :
                                sip.status === "Onaylandı" ? "#2563eb" :
                                  sip.status === "Teslim Edildi" ? "#facc15" :
                                    sip.status === "İptal" ? "#ef4444" :
                                      "#eab308",
                            fontWeight: 700
                          }}>
                            {sip.status}
                          </span>
                        </td>
                        <td style={tdS}>
                          {/* Kargo kodu input veya düz yazı */}
                          {sip.status === "Kargoya Verildi" && sip.kargo_takip_no ? (
                            <span style={{
                              background: "#f6f7fb",
                              borderRadius: 6,
                              border: "1.5px solid #1bbd8a",
                              padding: "7px 16px",
                              fontWeight: 700,
                              color: "#18181b",
                              fontSize: 14,
                              display: "inline-block"
                            }}>
                              {sip.kargo_takip_no}
                            </span>
                          ) : sip.status === "Onaylandı" && edit.editing ? (
                            <>
                              <input
                                placeholder="Kargo Takip No"
                                value={edit.kargoNo || ""}
                                minLength={13}
                                maxLength={40}
                                onChange={e =>
                                  handleSiparisEdit(sip.id, e.target.value)
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
                                  boxShadow: (edit.kargoNo?.length ?? 0) >= 13
                                    ? "0 0 0 2px #1bbd8a66"
                                    : "0 0 0 1.5px #e5e7eb55",
                                  transition: "all 0.14s"
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
                                  marginLeft: 6
                                }}
                                onClick={() => handleKargoNoKaydet(sip.id)}
                                disabled={(edit.kargoNo?.length ?? 0) < 13}
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
                                padding: "6px 17px"
                              }}
                              onClick={() =>
                                setSiparisEdits((prev) => ({
                                  ...prev,
                                  [sip.id]: { ...prev[sip.id], editing: true }
                                }))
                              }
                            >
                              Kargo Kodu Gir
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
                                  padding: "6px 17px"
                                }}
                                onClick={() => handleSiparisOnayla(sip.id)}
                              >
                                Onayla
                              </button>
                            )
                          )}
                        </td>
                        <td style={tdS}>
                          <button
                            style={{
                              ...butS,
                              background: "#ef4444",
                              color: "#fff"
                            }}
                            onClick={() => handleSiparisIptal(sip.id)}
                          >
                            Sil
                          </button>
                          <button
                            style={{
                              ...butS,
                              background: "#fff",
                              color: "#2563eb",
                              border: "1px solid #2563eb",
                              marginLeft: 6
                            }}
                            onClick={() => handleFaturaYazdir(sip)}
                          >
                            Fatura Yazdır
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
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
  letterSpacing: 0.5
};
const tdS = {
  fontWeight: 700,
  color: "#223555",
  fontSize: 13,
  padding: "7px 0",
  background: "#fff"
};
const butS = {
  fontWeight: 700,
  fontSize: 13,
  padding: "7px 14px",
  borderRadius: 6,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  marginRight: 6,
  cursor: "pointer",
  boxShadow: "0 2px 6px #2563eb13"
};