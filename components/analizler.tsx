// components/analizler.tsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const Analizler: React.FC = () => {
  const [tab, setTab] = useState<"gunluk" | "haftalik" | "aylik">("gunluk");
  const [veri, setVeri] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const toplamCiro = veri.reduce((acc, s) => acc + (s.total_price || 0), 0);
  const komisyon = toplamCiro * 0.08;
  const netOdeme = toplamCiro - komisyon;

  const urunSayilari: Record<string, number> = {};
  veri.forEach((s) => {
    urunSayilari[s.urunBaslik] = (urunSayilari[s.urunBaslik] || 0) + 1;
  });
  const enCokSatan = Object.entries(urunSayilari).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="p-8">
      {/* Sekmeler */}
      <div className="flex justify-center gap-8 mb-10">
        {[
          { key: "gunluk", label: "📅 Günlük" },
          { key: "haftalik", label: "📊 Haftalık" },
          { key: "aylik", label: "📈 Aylık" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-12 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 
              ${
                tab === t.key
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-xl scale-105"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 hover:shadow-md"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="text-center text-gray-500">Yükleniyor...</div>
      ) : veri.length === 0 ? (
        <div className="text-center text-gray-500 bg-gray-50 py-14 rounded-2xl shadow-inner text-lg">
          Bu {tab === "gunluk" ? "gün" : tab === "haftalik" ? "hafta" : "ay"} satışınız yok.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-5 font-medium text-gray-600 text-lg">💰 Toplam Ciro</td>
                <td className="px-6 py-5 text-right font-bold text-gray-900 text-lg">
                  ₺{toplamCiro.toLocaleString("tr-TR")}
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-5 font-medium text-gray-600 text-lg">📉 %8 Komisyon</td>
                <td className="px-6 py-5 text-right font-bold text-red-500 text-lg">
                  ₺{komisyon.toLocaleString("tr-TR")}
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-5 font-medium text-gray-600 text-lg">✅ Net Ödeme</td>
                <td className="px-6 py-5 text-right font-bold text-green-600 text-lg">
                  ₺{netOdeme.toLocaleString("tr-TR")}
                </td>
              </tr>
              {enCokSatan && (
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-5 font-medium text-gray-600 text-lg">🏆 En Çok Satılan</td>
                  <td className="px-6 py-5 text-right font-bold text-indigo-600 text-lg">
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
