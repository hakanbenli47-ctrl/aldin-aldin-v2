// pages/ilan-ver.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
import Image from "next/image";
import Papa, { ParseResult } from "papaparse";
import * as XLSX from "xlsx"; // ← Excel desteği
import { FiImage, FiTag, FiBox, FiLayers, FiHash, FiUploadCloud } from "react-icons/fi";

const ONECIKAR_PLANS = {
  "7g":  { price: 49.90, days: 7,  label: "7 Gün"  },
  "14g": { price: 79.90, days: 14, label: "14 Gün" },
} as const;
type PlanKey = keyof typeof ONECIKAR_PLANS;

type Kategori = { id: number; ad: string };
type CsvUrun = {
  title: string;
  desc?: string;
  price: string;
  stok?: string | number;
  kategori_id: string | number;
  resim_url?: string;
  // opsiyonel varyant alanları
  beden?: string;
  renk?: string;
  agirlikMiktar?: string | number;
  agirlikBirim?: string;
  sonTuketim?: string;
};

export default function IlanVer() {
  const router = useRouter();

  // Görseller
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Form state
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stok, setStok] = useState<number>(1);
  const [kategoriId, setKategoriId] = useState<number>(1);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [csvProducts, setCsvProducts] = useState<CsvUrun[]>([]); // toplu yükleme listesi

  const [renkText, setRenkText] = useState("");
  const [featurePlan, setFeaturePlan] = useState<PlanKey>("7g");

  // basit kart alanları
  const [ccName, setCcName] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccExpiry, setCcExpiry] = useState(""); // "MM/YY"
  const [ccCvv, setCcCvv] = useState("");

  // yeni: son eklenen ilanın ID'si (öne çıkarma ödemesi için)
  const [lastInsertedIlanId, setLastInsertedIlanId] = useState<number | null>(null);

  // Dinamik özellikler (JSON)
  const [ozellikler, setOzellikler] = useState<any>({});
  const setOzellik = (key: string, value: any) =>
    setOzellikler((prev: any) => ({ ...prev, [key]: value }));
  const seciliKategoriAd = (
    kategoriler.find((k) => k.id === kategoriId)?.ad || ""
  ).toLowerCase();

  // dizi alanı aç/kapa (ör: beden seçenekleri)
  const toggleOzellikArray = (key: string, value: string) => {
    setOzellikler((prev: any) => {
      const arr = Array.isArray(prev[key]) ? [...prev[key]] : [];
      const i = arr.indexOf(value);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(value);
      return { ...prev, [key]: arr };
    });
  };

  // "kırmızı, mavi, siyah" => ["kırmızı","mavi","siyah"]
  const parseCommaList = (s: string) =>
    s.split(/[,\n;.\u00B7]+/).map(v => v.trim()).filter(Boolean);

  // CSV Şablon (opsiyonel varyant sütunları eklendi)
  const csvSablon = `title,desc,price,stok,kategori_id,resim_url,beden,renk,agirlikMiktar,agirlikBirim,sonTuketim
Tişört,Harika tişört,199,50,1,https://site.com/tisort.jpg,M,Siyah,,,
Ayakkabı,Şık ayakkabı,399,20,2,https://site.com/ayakkabi.jpg,,,,
Pirinç,5 kg baldo pirinç,289,100,3,https://site.com/pirinc.jpg,,,5,kg,2026-01-01
`;

  // Kategori adı "giyim" mi?
  const isGiyimCat = (id: number, kategorilerList: Kategori[] = kategoriler) => {
    const ad = (kategorilerList.find(k => k.id === id)?.ad || "").toLowerCase();
    return ad.includes("giyim");
  };

  const addRenk = (input: string) => {
    const tokens = parseCommaList(input);
    if (!tokens.length) return;
    setOzellikler((prev: any) => {
      const arr = Array.isArray(prev?.renk) ? [...prev.renk] : [];
      for (const t of tokens) if (!arr.includes(t)) arr.push(t);
      return { ...prev, renk: arr };
    });
  };

  const removeRenk = (value: string) => {
    setOzellikler((prev: any) => ({
      ...prev,
      renk: (Array.isArray(prev?.renk) ? prev.renk : []).filter((r: string) => r !== value),
    }));
  };

  useEffect(() => {
    async function initPage() {
      // 1. Kullanıcıyı al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/giris"); // giriş yapmamışsa login sayfasına
        return;
      }
      setUser(user);

      // 2. Satıcı başvurusu var mı ve approved mu?
      const { data, error } = await supabase
        .from("satici_basvuru")
        .select("durum")
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        router.push("/satici-basvuru");
        return;
      }

      if (data.durum !== "approved") {
        let durumMesaj = "";
        if (data.durum === "pending") {
          durumMesaj = "Başvurunuz inceleniyor. Onay bekleyin.";
        } else if (data.durum === "rejected") {
          durumMesaj = "Başvurunuz reddedildi. Tekrar başvuruda bulunun.";
        }
        setMessage(durumMesaj);
        return;
      }

      // 3. Kategorileri yükle
      const { data: kategorilerData } = await supabase.from("kategori").select("*");
      if (kategorilerData) setKategoriler(kategorilerData);
    }

    initPage();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const handleRemoveImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previewUrls.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newPreviews);
  };

  const uploadImagesAndGetUrls = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("ilan-fotograflari")
        .upload(fileName, file, { upsert: false });

      if (error) {
        setMessage("Fotoğraf yüklenemedi: " + error.message);
        return [];
      }
      const { data } = supabase.storage.from("ilan-fotograflari").getPublicUrl(fileName);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  };

  // TOPLU EKLEME
  const handleBulkInsert = async () => {
    if (csvProducts.length === 0) {
      setMessage("⚠️ Önce CSV/Excel yükleyin.");
      return;
    }

    setLoading(true);

    const rows = csvProducts.map((row) => {
      const ozelliklerCsv: any = {};
      if (row.beden) ozelliklerCsv.beden = parseCommaList(String(row.beden));
      if (row.renk) ozelliklerCsv.renk = parseCommaList(String(row.renk));
      if (row.agirlikMiktar) ozelliklerCsv.agirlikMiktar = Number(row.agirlikMiktar);
      if (row.agirlikBirim) ozelliklerCsv.agirlikBirim = row.agirlikBirim;
      if (row.sonTuketim) ozelliklerCsv.sonTuketim = row.sonTuketim;

      return {
        title: row.title,
        desc: row.desc || "",
        price: row.price,
        stok: row.stok ? Number(row.stok) : 1,
        kategori_id: Number(row.kategori_id),
        resim_url: row.resim_url ? [row.resim_url] : [],
        ozellikler: ozelliklerCsv,
        user_email: user?.email,
        user_id: user?.id,
        created_at: new Date(),
      };
    });

    const { error } = await supabase.from("ilan").insert(rows);

    setLoading(false);

    if (error) {
      setMessage("Toplu eklemede hata: " + error.message);
      return;
    }

    setMessage(`✅ ${rows.length} ürün başarıyla eklendi!`);
    setCsvProducts([]);
    router.push("/satici");
  };

  // TEKİL EKLEME
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (selectedFiles.length === 0) {
      setMessage("En az bir fotoğraf eklemelisiniz.");
      setLoading(false);
      return;
    }
    if (!stok || stok < 1) {
      setMessage("Stok adedi en az 1 olmalı.");
      setLoading(false);
      return;
    }

    if (seciliKategoriAd.includes("gıda")) {
      if (!ozellikler.agirlikMiktar || !ozellikler.agirlikBirim) {
        setMessage("Gıda için ağırlık ve birim alanları zorunlu.");
        setLoading(false);
        return;
      }
    }
    if (seciliKategoriAd.includes("giyim")) {
      if (!Array.isArray(ozellikler.beden) || ozellikler.beden.length === 0) {
        setMessage("Giyim için en az bir beden seçmelisiniz.");
        setLoading(false);
        return;
      }
    }

    const photoUrls = await uploadImagesAndGetUrls();
    if (photoUrls.length === 0) {
      setLoading(false);
      return;
    }

    const safeOzellikler = {
      ...ozellikler,
      beden: Array.isArray(ozellikler?.beden)
        ? ozellikler.beden
        : ozellikler?.beden
        ? [String(ozellikler.beden)]
        : [],
      renk: Array.isArray(ozellikler?.renk)
        ? ozellikler.renk
        : ozellikler?.renk
        ? [String(ozellikler.renk)]
        : [],
    };

    // ↓↓↓ BURADA ID'yi dönecek şekilde insert ediyoruz
    const { data: inserted, error } = await supabase
      .from("ilan")
      .insert([
        {
          title,
          desc,
          price,
          stok,
          kategori_id: kategoriId,
          resim_url: photoUrls,
          ozellikler: safeOzellikler,
          user_email: user?.email,
          user_id: user?.id,
          created_at: new Date(),
        },
      ])
      .select("id")
      .single();

    setLoading(false);
    if (error) {
      setMessage("İlan kaydedilemedi: " + error.message);
    } else {
      setLastInsertedIlanId(inserted!.id); // << ID kaydedildi
      setMessage("✅ İlan başarıyla kaydedildi! İstersen hemen öne çıkarabilirsin.");
      // Formu temizlemek istersen:
      setTitle("");
      setDesc("");
      setPrice("");
      setStok(1);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setOzellikler({});
      // NOT: yönlendirmeyi kaldırdık ki kullanıcı hemen alttan öne çıkarma ödemesi yapabilsin.
    }
  };

  // Başvuru durumu uyarısı
  if (message.startsWith("Başvurunuz")) {
    return (
      <div
        style={{
          flex: "2 1 0%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          gap: 20,
        }}
      >
        <p
          style={{
            fontWeight: 600,
            color: "#e11d48",
            fontSize: "18px",
            textAlign: "center",
          }}
        >
          {message}
        </p>

        <button
          onClick={() => router.push("/satici-basvuru")}
          style={{
            padding: "12px 28px",
            background: "linear-gradient(90deg, #2563eb, #1d4ed8)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            transition: "all 0.2s ease-in-out",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "linear-gradient(90deg, #1d4ed8, #1e40af)";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "linear-gradient(90deg, #2563eb, #1d4ed8)";
          }}
        >
          🔄 Tekrar Başvuru Yap
        </button>
      </div>
    );
  }

  // Excel şablonu indirme
  const handleDownloadExcelTemplate = () => {
    const rows = [
      ["title","desc","price","stok","kategori_id","resim_url","beden","renk","agirlikMiktar","agirlikBirim","sonTuketim"],
      ["Tişört","Harika tişört","199","50","1","https://site.com/tisort.jpg","M","Siyah","","",""],
      ["Ayakkabı","Şık ayakkabı","399","20","2","https://site.com/ayakkabi.jpg","","","","",""],
      ["Pirinç","5 kg baldo pirinç","289","100","3","https://site.com/pirinc.jpg","","","5","kg","2026-01-01"],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Urunler");
    XLSX.writeFile(wb, "urun-sablon.xlsx");
  };

  // CSV/Excel YÜKLEME
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage("");
    const ext = file.name.split(".").pop()?.toLowerCase();

    // CSV ise Papa.parse
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        complete: function (results: ParseResult<CsvUrun>) {
          const cleanRows = results.data
            .map((r) => ({
              ...r,
              title: r.title?.toString().trim(),
              price: r.price?.toString().trim(),
            }))
            .filter((r) => r.title && r.price && r.kategori_id);

          setCsvProducts(cleanRows);
          setMessage(`✅ ${cleanRows.length} ürün hazır. "Toplu Ürünleri Ekle" butonuna basın.`);
        },
      });
      return;
    }

    // Excel ise XLSX ile oku
    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

        const cleanRows: CsvUrun[] = json
          .map((r) => ({
            title: (r.title ?? "").toString().trim(),
            desc: (r.desc ?? "").toString(),
            price: (r.price ?? "").toString().trim(),
            stok: r.stok ?? "",
            kategori_id: r.kategori_id ?? "",
            resim_url: (r.resim_url ?? "").toString().trim(),
            beden: (r.beden ?? "").toString(),
            renk: (r.renk ?? "").toString(),
            agirlikMiktar: r.agirlikMiktar ?? "",
            agirlikBirim: (r.agirlikBirim ?? "").toString(),
            sonTuketim: (r.sonTuketim ?? "").toString(),
          }))
          .filter((r) => r.title && r.price && r.kategori_id);

        setCsvProducts(cleanRows);
        setMessage(`✅ ${cleanRows.length} ürün hazır. "Toplu Ürünleri Ekle" butonuna basın.`);
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    setMessage("Desteklenmeyen dosya türü. Lütfen CSV, XLSX veya XLS yükleyin.");
  };

  // --- ÖDEME: İlanı öne çıkar (İyzico /api/payment payRaw çağrısı)
  async function handleFeaturePayment(ilanId: number) {
    try {
      const amount = ONECIKAR_PLANS[featurePlan].price;

      if (!ccName || !ccNumber || !ccExpiry || !ccCvv) {
        alert("Kart bilgilerini doldurun.");
        return;
      }

      const payRes = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payRaw",
          amount,
          card: {
            name_on_card: ccName,
            card_number: ccNumber.replace(/\s/g, ""),
            expiry: ccExpiry,
            cvv: ccCvv,
          },
          buyer: {
            id: user?.id,
            name: user?.email?.split("@")[0] || "User",
            surname: "User",
            email: user?.email || "test@example.com",
            gsmNumber: "+905555555555",
          },
          address: {
            address: "Feature",
            city: "Istanbul",
            country: "Turkey",
            postal_code: "",
          },
          basketItems: [
            {
              id: `feature-${ilanId}`,
              name: `Öne Çıkar (${ONECIKAR_PLANS[featurePlan].label}) - #${ilanId}`,
              category1: "Feature",
              price: amount,
            },
          ],
        }),
      });
      const payJson = await payRes.json();
      if (!payJson?.success) {
        alert("💳 Ödeme başarısız: " + (payJson?.message || "bilinmeyen hata"));
        return;
      }

      const until = new Date(Date.now() + ONECIKAR_PLANS[featurePlan].days * 86400 * 1000);
      const { error: upErr } = await supabase
        .from("ilan")
        .update({ is_featured: true, featured_until: until.toISOString() })
        .eq("id", ilanId);

      if (upErr) {
        alert("Ödeme alındı ama ilan işaretlenemedi: " + upErr.message);
        return;
      }

      alert("✅ Ödeme alındı ve ilan öne çıkarıldı.");
      router.push("/satici");
    } catch (e: any) {
      console.error(e);
      alert("Ödeme sırasında hata: " + (e?.message || "bilinmeyen hata"));
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(110deg, #f8fafc 0%, #eafcf6 100%)",
        padding: 0,
        fontFamily: "Inter, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1.5px solid #e4e9ef",
          boxShadow: "0 2px 12px #1648b005",
          padding: "18px 0 10px 0",
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "center",
          cursor: "pointer",
        }}
        onClick={() => {
          window.location.href = "/satici";
        }}
      >
        <Image src="/logo.png" alt="logo" width={36} height={36} style={{ cursor: "pointer" }} />
        <span
          style={{
            fontWeight: 900,
            color: "#1648b0",
            fontSize: 22,
            letterSpacing: ".8px",
            cursor: "pointer",
          }}
        ></span>
        <span style={{ color: "#199957", fontSize: 14, fontWeight: 600, marginLeft: 16 }}></span>
      </div>

      {/* KART */}
      <div
        className="ilanver-card"
        style={{
          maxWidth: 850,
          width: "100%",
          margin: "32px auto",
          background: "rgba(255,255,255,0.97)",
          borderRadius: 18,
          boxShadow: "0 4px 32px #1999570a",
          padding: "32px 22px 20px 22px",
          display: "flex",
          flexDirection: "row",
          gap: 32,
          border: "1.5px solid #e4e9ef",
        }}
      >
        {/* SOL: Önizleme */}
        <div
          className="ilanver-left"
          style={{
            flex: "1 1 280px",
            borderRight: "1px dashed #e2e8f0",
            paddingRight: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            className="preview-box"
            style={{
              width: 190,
              height: 190,
              border: "1.5px solid #e6e9ee",
              background: "#f7fafc",
              borderRadius: 14,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {previewUrls?.[0] ? (
              <img
                src={previewUrls[0]}
                alt="Önizleme"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <FiImage size={54} color="#c4c7cf" />
            )}
          </div>
          <div style={{ fontSize: 15, color: "#7b8591", fontWeight: 600 }}>
            {title || "Ürün adı burada görünür"}
          </div>
          <div style={{ color: "#199957", fontSize: 16, fontWeight: 700 }}>
            {price ? `${price} ₺` : "Fiyat bilgisi"}
          </div>
          <div
            style={{
              background: "#eafcf6",
              borderRadius: 6,
              color: "#199957",
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              marginTop: 4,
              minWidth: 95,
              textAlign: "center",
            }}
          >
            {desc || "Açıklama"}
          </div>
        </div>

        {/* SAĞ: FORM */}
        <form
          className="ilanver-right"
          onSubmit={handleSubmit}
          style={{
            flex: "2 1 0%",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            minWidth: 230,
            maxWidth: 420,
          }}
        >
          <label style={labelStyle}>
            <FiTag size={14} style={iconStyle} /> Ürün Başlığı
            <span style={subLabelStyle}>En fazla 70 karakter</span>
          </label>
          <input
            type="text"
            value={title}
            maxLength={70}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ürün başlığı"
            style={inputStyle}
          />

          <label style={labelStyle}>
            <FiLayers size={14} style={iconStyle} /> Açıklama
            <span style={subLabelStyle}>Kısa ve net olmalı</span>
          </label>
          <textarea
            value={desc}
            maxLength={180}
            onChange={(e) => setDesc(e.target.value)}
            required
            rows={2}
            placeholder="Kısa açıklama"
            style={{ ...inputStyle, resize: "vertical", minHeight: 36 }}
          />

          <label style={labelStyle}>
            <FiBox size={14} style={iconStyle} /> Fiyat (₺)
          </label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
            required
            placeholder="Fiyat"
            style={inputStyle}
          />

          <label style={labelStyle}>
            <FiHash size={14} style={iconStyle} /> Stok
          </label>
          <input
            type="number"
            value={stok}
            min={1}
            onChange={(e) => setStok(Number(e.target.value))}
            required
            placeholder="Stok"
            style={inputStyle}
          />

          <label style={labelStyle}>
            <FiLayers size={14} style={iconStyle} /> Kategori
          </label>
          <select
            value={kategoriId}
            onChange={(e) => setKategoriId(Number(e.target.value))}
            required
            style={inputStyle}
          >
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>

          {/* 📦 Kategoriye göre ekstra alanlar */}
          {seciliKategoriAd.includes("gıda") && (
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "#f8fafc",
                border: "1px dashed #e2e8f0",
                borderRadius: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: "#1648b0", marginBottom: 6 }}>
                Gıda Bilgileri
              </div>

              <label style={labelStyle}>Ağırlık</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Miktar"
                  value={ozellikler?.agirlikMiktar ?? ""}
                  onChange={(e) => setOzellik("agirlikMiktar", Number(e.target.value))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={ozellikler?.agirlikBirim ?? "kg"}
                  onChange={(e) => setOzellik("agirlikBirim", e.target.value)}
                  style={{ ...inputStyle, width: 120 }}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lt">lt</option>
                  <option value="ml">ml</option>
                </select>
              </div>

              <label style={labelStyle}>Son Tüketim Tarihi</label>
              <input
                type="date"
                value={ozellikler?.sonTuketim ?? ""}
                onChange={(e) => setOzellik("sonTuketim", e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {seciliKategoriAd.includes("giyim") && (
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "#f8fafc",
                border: "1px dashed #e2e8f0",
                borderRadius: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: "#1648b0", marginBottom: 6 }}>
                Giyim Bilgileri
              </div>

              {/* BEDEN SEÇENEKLERİ (çoklu seçim) */}
              <label style={labelStyle}>Beden seçenekleri</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {["XS","S","M","L","XL","XXL"].map((b) => {
                  const checked = Array.isArray(ozellikler?.beden) && ozellikler.beden.includes(b);
                  return (
                    <label
                      key={b}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: checked ? "1.5px solid #199957" : "1px solid #e2e8f0",
                        background: checked ? "#eafcf6" : "#fff",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOzellikArray("beden", b)}
                      />
                      {b}
                    </label>
                  );
                })}
              </div>

              {/* RENK SEÇENEKLERİ – tag input */}
              <label style={labelStyle}>Renk seçenekleri (virgül • nokta • ; • Enter)</label>
              <input
                type="text"
                placeholder="Örn: Siyah, Beyaz, Lacivert"
                value={renkText}
                onChange={(e) => setRenkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',' || e.key === '.' || e.key === ';') {
                    e.preventDefault();
                    addRenk(renkText);
                    setRenkText("");
                  } else if (e.key === 'Backspace' && renkText === "") {
                    const last = Array.isArray(ozellikler?.renk) ? ozellikler.renk.slice(-1)[0] : null;
                    if (last) removeRenk(last);
                  }
                }}
                onBlur={() => {
                  if (renkText.trim()) {
                    addRenk(renkText);
                    setRenkText("");
                  }
                }}
                style={inputStyle}
              />

              {Array.isArray(ozellikler?.renk) && ozellikler.renk.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {ozellikler.renk.map((r: string) => (
                    <span
                      key={r}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#eef2ff",
                        color: "#3730a3",
                        border: "1px solid #c7d2fe",
                        borderRadius: 999,
                        padding: "3px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {r}
                      <button
                        type="button"
                        onClick={() => removeRenk(r)}
                        title="Sil"
                        style={{
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          fontWeight: 800,
                          lineHeight: 1,
                          marginLeft: 4,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fotoğraflar */}
          <label style={labelStyle}>
            <FiImage size={14} style={iconStyle} /> Fotoğraflar
            <span style={subLabelStyle}>En fazla 5 fotoğraf</span>
          </label>
          <input type="file" multiple accept="image/*" onChange={handleFileChange} style={inputStyle} />

          <div style={{ display: "flex", gap: 5, margin: "7px 0" }}>
            {previewUrls.map((url, i) => (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 7,
                  overflow: "hidden",
                  position: "relative",
                  border: "1px solid #e0e0e0",
                }}
              >
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  style={{
                    position: "absolute",
                    top: 1,
                    right: 1,
                    background: "#fff",
                    color: "#e11d48",
                    border: "1px solid #eee",
                    borderRadius: "50%",
                    width: 15,
                    height: 15,
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 10,
                    zIndex: 2,
                    lineHeight: 1,
                  }}
                  title="Sil"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "linear-gradient(90deg, #199957 0%, #1648b0 90%)",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              borderRadius: 8,
              padding: "13px 0",
              fontSize: 15,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
              letterSpacing: "0.2px",
              marginTop: 15,
              marginBottom: 4,
              boxShadow: "0 2px 8px #1648b013",
            }}
          >
            {loading ? "Kaydediliyor..." : "Ürünü Ekle"}
          </button>

          {message && (
            <div
              style={{
                marginTop: 5,
                color: message.startsWith("✅") ? "#199957" : "#e11d48",
                fontWeight: 700,
                fontSize: 14,
                textAlign: "center",
                background: "#f4f7fa",
                padding: "8px 5px",
                borderRadius: 7,
              }}
            >
              {message}
            </div>
          )}

          {/* --- ÖNE ÇIKAR BÖLÜMÜ (CSV/EXCEL BÖLÜMÜNDEN ÖNCE) --- */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #e2e8f0" }}>
            <div style={{ fontWeight: 700, color: "#1648b0", marginBottom: 8 }}>
              ⭐ İlanı Öne Çıkar
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <select
                value={featurePlan}
                onChange={(e) => setFeaturePlan(e.target.value as PlanKey)}
                style={{ ...inputStyle, maxWidth: 200 }}
              >
                <option value="7g">7 Gün — {ONECIKAR_PLANS["7g"].price} ₺</option>
                <option value="14g">14 Gün — {ONECIKAR_PLANS["14g"].price} ₺</option>
              </select>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Tutar: <b>{ONECIKAR_PLANS[featurePlan].price.toFixed(2)} ₺</b>
              </div>
            </div>

            <input
              type="text"
              placeholder="Kart üzerindeki isim"
              value={ccName}
              onChange={(e) => setCcName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Kart numarası (16 hane)"
              value={ccNumber}
              onChange={(e) => setCcNumber(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="SKT (AA/YY)"
                value={ccExpiry}
                onChange={(e) => setCcExpiry(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="text"
                placeholder="CVV"
                value={ccCvv}
                onChange={(e) => setCcCvv(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!lastInsertedIlanId) {
                  alert("Önce ilanı kaydedin, sonra öne çıkarın.");
                  return;
                }
                handleFeaturePayment(lastInsertedIlanId);
              }}
              style={{
                background: "linear-gradient(90deg,#f59e0b,#ef4444)",
                color: "#fff",
                fontWeight: 700,
                border: "none",
                borderRadius: 8,
                padding: "12px 0",
                fontSize: 15,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              💳 Öne Çıkar & Öde
            </button>
          </div>

          {/* CSV/EXCEL BÖLÜMÜ */}
          <div style={{ marginTop: 22, padding: "10px 0 0 0", borderTop: "1px dashed #c1c8d8" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "#1648b0",
                marginBottom: 7,
                letterSpacing: ".1px",
              }}
            >
              <FiUploadCloud size={15} style={{ marginRight: 4 }} />
              Toplu Ürün Yükle (CSV / Excel)
            </div>

            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvSablon)}`}
              download="urun-sablon.csv"
              style={{ color: "#199957", fontWeight: 600, fontSize: 13, textDecoration: "underline" }}
            >
              CSV şablonunu indir
            </a>

            <button
              type="button"
              onClick={handleDownloadExcelTemplate}
              style={{
                marginLeft: 10,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #e4e9ef",
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "#1648b0",
              }}
              title="Excel şablonunu .xlsx olarak indir"
            >
              Excel şablonunu indir
            </button>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleCSVUpload}
              style={{ fontSize: 13, marginLeft: 8, marginTop: 3 }}
            />

            {csvProducts.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 10 }}>
                  {csvProducts.length} ürün hazır. İçeri aktarmak için aşağıdaki butona basın.
                </div>

                <button
                  type="button"
                  onClick={handleBulkInsert}
                  disabled={loading}
                  style={{
                    background: "linear-gradient(90deg, #199957 0%, #1648b0 90%)",
                    color: "#fff",
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 8,
                    padding: "13px 0",
                    fontSize: 15,
                    cursor: "pointer",
                    opacity: loading ? 0.7 : 1,
                    letterSpacing: "0.2px",
                    marginTop: 12,
                    boxShadow: "0 2px 8px #1648b013",
                    width: "100%",
                  }}
                  title="Dosyadaki tüm ürünleri ekle"
                >
                  {loading ? "Ekleniyor..." : `📦 Toplu Ürünleri Ekle (${csvProducts.length})`}
                </button>
              </>
            )}

            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
              Eksik/hatalı satırlar kullanıcıya bildirilir.
            </div>
          </div>
        </form>
      </div>

      {/* FOOTER */}
      <footer
        style={{
          width: "100%",
          textAlign: "center",
          padding: "18px 0 9px 0",
          background: "linear-gradient(90deg,#1648b0 0%,#199957 100%)",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: 0.25,
          marginTop: "auto",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        © {new Date().getFullYear()} 80bir | Geleceğin Alışverişi Burada!
      </footer>

      <style jsx global>{`
        body {
          padding-bottom: env(safe-area-inset-bottom);
        }
        @media (max-width: 768px) {
          .ilanver-card {
            flex-direction: column !important;
            gap: 16px !important;
            padding: 18px 14px !important;
            margin: 16px auto !important;
          }
          .ilanver-left {
            border-right: 0 !important;
            padding-right: 0 !important;
            margin-bottom: 6px !important;
            align-items: stretch !important;
          }
          .ilanver-right {
            max-width: 100% !important;
            min-width: 0 !important;
          }
          .preview-box {
            width: 100% !important;
            height: 220px !important;
          }
        }
      `}</style>
    </div>
  );
}

// --- STİLLER ---
const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13.5,
  color: "#23272f",
  display: "block",
  marginTop: 7,
  marginBottom: 3,
  letterSpacing: "0.09px",
};
const iconStyle: React.CSSProperties = { marginRight: 7, verticalAlign: "middle" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 9px",
  borderRadius: 7,
  border: "1px solid #e4e9ef",
  fontSize: 14,
  background: "#fafdff",
  color: "#1a1a1a",
  fontWeight: 500,
  marginBottom: 4,
};
const subLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#7b8591",
  fontWeight: 400,
  marginLeft: 8,
};
