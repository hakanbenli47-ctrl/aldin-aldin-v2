// components/analizler.tsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const Analizler: React.FC = () => {
  const [tab, setTab] = useState<"gunluk" | "haftalik" | "aylik">("gunluk");
  const [veri, setVeri] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // tarih aralıklarını hesapla
  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    if (tab === "gunluk") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (tab === "haftalik") {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start: start.toISOString(), end: now.toISOString() };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("siparisler")
        .select("id, total_price, urunBaslik, created_at")
        .gte("created_at", start)
        .lte("created_at", end);

      if (!error && data) setVeri(data);
      setLoading(false);
    };
    fetchData();
  }, [tab]);

  // hesaplamalar
  const toplamCiro = veri.reduce((acc, s) => acc + (s.total_price || 0), 0);
  const komisyon = toplamCiro * 0.08;
  const netOdeme = toplamCiro - komisyon;

  // en çok satan ürün
  const urunSayilari: Record<string, number> = {};
  veri.forEach((s) => {
    urunSayilari[s.urunBaslik] = (urunSayilari[s.urunBaslik] || 0) + 1;
  });
  const enCokSatan = Object.entries(urunSayilari).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="p-6">
      {/* Sekmeler */}
      <div className="flex gap-4 mb-6 justify-center">
        {[
          { key: "gunluk", label: "Günlük" },
          { key: "haftalik", label: "Haftalık" },
          { key: "aylik", label: "Aylık" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`relative px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-sm
              ${
                tab === t.key
                  ? "bg-blue-600 text-white shadow-lg scale-105"
                  : "bg-white text-gray-700 hover:bg-blue-50 hover:scale-105 border border-gray-200"
              }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="text-center text-gray-500">Yükleniyor...</div>
      ) : veri.length === 0 ? (
        <div className="text-center text-gray-500 bg-gray-50 py-10 rounded-xl shadow-sm">
          Bu {tab === "gunluk" ? "gün" : tab === "haftalik" ? "hafta" : "ay"} satışınız yok.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-6 py-4 font-medium text-gray-600">Toplam Ciro</td>
                <td className="px-6 py-4 text-right font-bold text-gray-900">
                  ₺{toplamCiro.toLocaleString("tr-TR")}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-gray-600">%8 Komisyon</td>
                <td className="px-6 py-4 text-right font-bold text-red-500">
                  ₺{komisyon.toLocaleString("tr-TR")}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-gray-600">Net Ödeme</td>
                <td className="px-6 py-4 text-right font-bold text-green-600">
                  ₺{netOdeme.toLocaleString("tr-TR")}
                </td>
              </tr>
              {enCokSatan && (
                <tr>
                  <td className="px-6 py-4 font-medium text-gray-600">En Çok Satılan</td>
                  <td className="px-6 py-4 text-right font-bold text-indigo-600">
                    {enCokSatan[0]} ({enCokSatan[1]} adet)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Analizler;
