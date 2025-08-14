// pages/urun/[id].tsx
import { useRouter } from "next/router";
import Image from "next/image";
import { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

interface Ilan {
  id: number;
  title: string;
  price: number;
  resim_url: string[] | string;
  kategori_id?: number;
  user_email?: string;
  doped?: boolean;
  desc?: string;
  ozellikler?: Record<string, string[]>;
}

function renderStars(rating: number, max = 5) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = max - full - half;
  return (
    <>
      {Array(full).fill(0).map((_, i) => <span key={"f" + i}>★</span>)}
      {half ? <span key="h">☆</span> : null}
      {Array(empty).fill(0).map((_, i) => <span key={"e" + i}>☆</span>)}
    </>
  );
}

export async function getServerSideProps({ params }: any) {
  const { id } = params;
  const { data: ilan, error } = await supabase.from("ilan").select("*").eq("id", id).single();
  if (error || !ilan) return { notFound: true };

  let firmaAdi = null, firmaPuan = 0;
  if (ilan.user_email) {
    const { data: firma } = await supabase
      .from("satici_firmalar")
      .select("firma_adi, puan")
      .eq("email", ilan.user_email)
      .single();
    firmaAdi = firma?.firma_adi || null;
    firmaPuan = firma?.puan ?? 0;
  }

  const { data: benzerler } = await supabase
    .from("ilan")
    .select("*")
    .eq("kategori_id", ilan.kategori_id)
    .neq("id", ilan.id)
    .limit(8);

  return { props: { ilan, firmaAdi, firmaPuan, benzerler: benzerler || [] } };
}

export default function UrunDetay({
  ilan,
  firmaAdi,
  firmaPuan
}: {
  ilan: Ilan;
  firmaAdi: string | null;
  firmaPuan: number;
}) {
  const router = useRouter();
  const { from } = router.query;
  const anasayfaPath = from === "index2" ? "/index2" : "/";
  const sepetPath = from === "index2" ? "/sepet2" : "/sepet";

  const [mainImg, setMainImg] = useState<string | null>(null);
  const [favori, setFavori] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [yorumlar, setYorumlar] = useState<any[]>([]);
  const [yorum, setYorum] = useState("");
  const [puan, setPuan] = useState(5);
  const [secilenOzellikler, setSecilenOzellikler] = useState<Record<string, string>>({});

  const ozellikler = ilan.ozellikler ?? {};
  const badge = ilan.doped ? "Fırsat" : "Yeni";

  useEffect(() => {
    setMainImg(Array.isArray(ilan.resim_url) ? ilan.resim_url[0] : ilan.resim_url || "/placeholder.jpg");
    fetchYorumlar();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data?.session?.user || null));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("favoriler")
      .select("ilan_id")
      .eq("user_id", user.id)
      .eq("ilan_id", ilan.id)
      .then(({ data }) => setFavori((data?.length ?? 0) > 0));
  }, [user?.id, ilan.id]);

  async function fetchYorumlar() {
    const { data } = await supabase
      .from("yorumlar")
      .select("*")
      .eq("urun_id", ilan.id)
      .order("created_at", { ascending: false });
    setYorumlar(data || []);
  }

  async function sepeteEkle(urun: Ilan) {
    if (!user) return alert("Lütfen giriş yapınız!");
    const userId = user.id;
    const { data: sepetteVar } = await supabase
      .from("cart")
      .select("*")
      .eq("user_id", userId)
      .eq("product_id", urun.id)
      .single();

    if (sepetteVar) {
      await supabase.from("cart").update({ adet: sepetteVar.adet + 1 }).eq("id", sepetteVar.id);
    } else {
      await supabase.from("cart").insert([{ user_id: userId, product_id: urun.id, adet: 1 }]);
    }
    alert("Sepete eklendi!");
  }

  async function favoriyeToggle() {
    if (!user) return alert("Lütfen giriş yapınız!");
    const userId = user.id;

    if (favori) {
      await supabase.from("favoriler").delete().eq("user_id", userId).eq("ilan_id", ilan.id);
      setFavori(false);
    } else {
      await supabase.from("favoriler").insert([{ user_id: userId, ilan_id: ilan.id }]);
      setFavori(true);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f6f7f9, #e4ecef)", width: "100%" }}>
      <Head>
        <title>{ilan.title} - Aldın Aldın</title>
        <meta name="description" content={ilan.desc?.slice(0, 120)} />
      </Head>

      {/* HEADER */}
      <div
        style={{ background: "#fff", padding: "16px 0", display: "flex", justifyContent: "center", gap: 24, cursor: "pointer" }}
        onClick={() => router.push(anasayfaPath)}
      >
        <Image src="/logo.png" alt="Aldın Aldın Logo" width={40} height={40} />
      </div>

      {/* ÜRÜN DETAY */}
      <div style={{ maxWidth: 460, margin: "40px auto", padding: 36, background: "#fff", borderRadius: 18 }}>
        <span style={{
          background: badge === "Fırsat" ? "#fb8500" : "#16a34a",
          color: "#fff", fontWeight: 800, fontSize: 14, borderRadius: 8, padding: "5px 14px"
        }}>{badge}</span>

        <span
          style={{ float: "right", fontSize: 26, color: favori ? "#fb8500" : "#bdbdbd", cursor: "pointer" }}
          onClick={favoriyeToggle}
        >
          {favori ? "❤️" : "🤍"}
        </span>

        <Image src={mainImg ?? "/placeholder.jpg"} alt={ilan.title} width={240} height={240} style={{ borderRadius: 14 }} />

        {Array.isArray(ilan.resim_url) && ilan.resim_url.length > 1 && (
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {ilan.resim_url.map((url, idx) => (
              <Image key={idx} src={url} alt="" width={55} height={55} onClick={() => setMainImg(url)} />
            ))}
          </div>
        )}

        <h2>{ilan.title}</h2>

        {firmaAdi && (
          <div>
            <span>Firma: {firmaAdi}</span> {renderStars(firmaPuan)} ({firmaPuan.toFixed(1)})
          </div>
        )}

        {/* Özellik Seçimi */}
        {Object.keys(ozellikler).map((ozellik) => (
          <div key={ozellik}>
            <label>{ozellik}</label>
            <select value={secilenOzellikler[ozellik] || ""} onChange={(e) =>
              setSecilenOzellikler(prev => ({ ...prev, [ozellik]: e.target.value }))
            }>
              <option value="">Seçiniz</option>
              {ozellikler[ozellik]?.map((deger, idx) => (
                <option key={idx} value={deger}>{deger}</option>
              ))}
            </select>
          </div>
        ))}

        <div style={{ fontSize: 22, fontWeight: 700, color: "#1bbd8a" }}>
          {ilan.price ? `${ilan.price} ₺` : "Fiyat bilgisi yok"}
        </div>

        <button onClick={() => sepeteEkle(ilan)}>🛒 Sepete Ekle</button>
        <button onClick={() => router.push(sepetPath)}>Sepete Git</button>
      </div>
    </div>
  );
}
