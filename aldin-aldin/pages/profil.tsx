import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import DopingModal from "../components/DopingModal";


type Ilan = {
  id: number;
  title: string;
  price: string;
  desc: string;
  kategori_id?: number;
  resim_url?: string;
  views?: number;
  doped?: boolean;
  created_at?: string;
};

export default function Profil() {
  const [modalOpen, setModalOpen] = useState(false);
const [selectedIlan, setSelectedIlan] = useState<Ilan | null>(null);
const [paket, setPaket] = useState<"gunluk" | "haftalik" | "aylik" | null>(null);
const [card, setCard] = useState({ name: "", number: "", expiry: "", cvc: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState({ title: "", price: "", desc: "" });
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [ilanlarim, setIlanlarim] = useState<Ilan[]>([]);
  const [info, setInfo] = useState("");
  

  useEffect(() => {
    async function fetchUserAndIlanlar() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.replace("/giris");
        return;
      }
      setUser(authData.user);

      const { data, error } = await supabase
        .from("ilan")
        .select("*")
        .eq("user_email", authData.user.email);

      if (error) {
        console.error("İlanlar getirilemedi:", error.message);
        setInfo("❌ İlanlar yüklenemedi");
      } else {
        setIlanlarim(data || []);
      }
    }

    fetchUserAndIlanlar();
  }, [router]);

  function handleEditBaslat(ilan: Ilan) {
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
        if (error) {
          console.error("Güncelleme hatası:", error.message);
        } else {
          setIlanlarim((prev) =>
            prev.map((ilan) =>
              ilan.id === id ? { ...ilan, ...editVals } : ilan
            )
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
        if (error) {
          console.error("Silme hatası:", error.message);
        } else {
          setIlanlarim((prev) => prev.filter((ilan) => ilan.id !== id));
        }
      });
  }

  if (!user)
    return <p style={{ textAlign: "center", marginTop: 50 }}>Yükleniyor...</p>;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #e6e8ec 100%)",
        paddingBottom: 40,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          width: "100%",
          background: "#fff",
          boxShadow: "0 2px 10px #e5e7eb55",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 32px 12px 20px",
          zIndex: 100,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 7 }}
          onClick={() => router.push("/")}
        >
          <Image src="/logo.png" alt="Aldın Aldın Logo" width={42} height={42} />
          <span
            style={{
              fontWeight: 700,
              fontSize: 21,
              color: "#223555",
              letterSpacing: 1,
              marginLeft: 2,
            }}
          >
            Aldın Aldın
          </span>
        </div>
        <button
          onClick={() => router.push("/ilan-ver")}
          style={{
            background: "linear-gradient(90deg,#13c09a 10%,#2563eb 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 28px",
            fontWeight: 800,
            fontSize: 16,
            boxShadow: "0 1px 10px #a5b4fc22",
            cursor: "pointer",
            letterSpacing: 0.2,
          }}
        >
          + Yeni İlan Ver
        </button>
      </div>

      {/* Kullanıcı bilgisi */}
      <div
        style={{
          background: "#fff",
          borderRadius: 15,
          boxShadow: "0 2px 18px #e5e7eb33",
          padding: "26px 34px 18px 34px",
          margin: "32px auto 18px auto",
          maxWidth: 410,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 68,
            height:  68,
            borderRadius: "50%",
            background: "#e6e8ec",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 35,
            marginBottom: 13,
            boxShadow: "0 2px 10px #e6e8ec55",
          }}
        >
          👤
        </div>
        <div style={{ fontWeight: 700, fontSize: 19, color: "#223555", marginBottom: 4 }}>
          {user.email}
        </div>
        <div style={{ color: "#888", fontSize: 15, marginBottom: 2 }}>Profilim</div>
      </div>

      {/* İlanlarım */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 20px 35px 20px",
        }}
      >
        <h3
          style={{
            fontWeight: 800,
            fontSize: 23,
            color: "#2563eb",
            marginBottom: 12,
            marginTop: 12,
            letterSpacing: 0.5,
          }}
        >
          İlanlarım
        </h3>

        {ilanlarim.length === 0 ? (
          <div
            style={{
              background: "#f3f4f6",
              color: "#223555",
              padding: "30px",
              borderRadius: 13,
              textAlign: "center",
              fontWeight: 600,
              boxShadow: "0 2px 10px #e5e7eb44",
            }}
          >
            Henüz bir ilanınız yok.{" "}
            <button
              onClick={() => router.push("/ilan-ver")}
              style={{
                background: "linear-gradient(90deg,#13c09a 10%,#2563eb 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "7px 18px",
                fontWeight: 700,
                fontSize: 15,
                marginLeft: 8,
                cursor: "pointer",
              }}
            >
              İlan Ver
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 26,
              marginTop: 7,
            }}
          >
  
{ilanlarim.map((item) => (
  <div
    key={item.id}
    style={{
      background: "#fff",
      borderRadius: 13,
      boxShadow: "0 2px 14px #e5e7eb55",
      border: item.doped ? "2.5px solid #1bbd8a" : "1.5px solid #e6e8ec",
      padding: 18,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "relative",
    }}
  >
{item.resim_url?.[0] && (
  <img
    src={item.resim_url[0]}
    alt="İlan görseli"
    style={{
      width: "100%",
      height: 180,
      objectFit: "cover",
      borderRadius: 10,
      marginBottom: 12,
    }}
  />
)}
                <div style={{ fontWeight: 700, fontSize: 17, color: "#223555", marginBottom: 3 }}>
                  {item.title}
                </div>
                <div style={{ color: "#13c09a", fontWeight: 700, fontSize: 15 }}>
                  {item.price} ₺
                </div>
                <div style={{ fontSize: 14, color: "#666", marginTop: 7, textAlign: "center", minHeight: 22 }}>
                  {item.desc}
                </div>
                <div style={{ fontSize: 13, color: "#999", marginTop: 5 }}>
                  👀 {item.views || 0} görüntülenme
                </div>
                <small style={{ color: "#aaa", marginTop: 4 }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                </small>

                {editingId === item.id ? (
                  <div style={{ marginTop: 10, width: "100%" }}>
                    <input
                      type="text"
                      placeholder="Başlık"
                      value={editVals.title}
                      onChange={(e) => setEditVals((p) => ({ ...p, title: e.target.value }))}
                      style={{ width: "100%", marginBottom: 8, padding: 6, borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    <input
                      type="text"
                      placeholder="Fiyat"
                      value={editVals.price}
                      onChange={(e) => setEditVals((p) => ({ ...p, price: e.target.value }))}
                      style={{ width: "100%", marginBottom: 8, padding: 6, borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    <textarea
                      placeholder="Açıklama"
                      value={editVals.desc}
                      onChange={(e) => setEditVals((p) => ({ ...p, desc: e.target.value }))}
                      style={{ width: "100%", marginBottom: 8, padding: 6, borderRadius: 6, border: "1px solid #ccc", minHeight: 50 }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <button onClick={() => handleEditKaydet(item.id)} style={{ flex: 1, background: "#13c09a", color: "#fff", padding: 8, borderRadius: 6, border: "none", fontWeight: 600 }}>
                        Kaydet
                      </button>
                      <button onClick={handleEditCancel} style={{ flex: 1, background: "#e5e7eb", color: "#333", padding: 8, borderRadius: 6, border: "none", fontWeight: 600 }}>
                        İptal
                      </button>
                    </div>
                  </div>
                ) : <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
  <button
    onClick={() => handleEditBaslat(item)}
    style={{
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "6px 14px",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    Düzenle
  </button>
  <button
    onClick={() => handleSil(item.id)}
    style={{
      background: "#ef4444",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "6px 14px",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    Sil
  </button>
  <button
    onClick={() => {
      setSelectedIlan(item);
      setModalOpen(true);
    }}
    style={{
      background: "#facc15",
      color: "#000",
      border: "none",
      borderRadius: 8,
      padding: "6px 14px",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    🚀 Öne Çıkar
  </button>
  {modalOpen && selectedIlan && (
  <DopingModal
    ilan={selectedIlan}
    onClose={() => setModalOpen(false)}
    onSuccess={() => {
      setIlanlarim((prev) =>
        prev.map((i) =>
          i.id === selectedIlan.id ? { ...i, doped: true } : i
        )
      );
      setSelectedIlan(null);
    }}
  />
)}

</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
