// components/analizler.tsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const Analizler: React.FC = () => {
  const [tab, setTab] = useState<"gunluk" | "haftalik" | "aylik">("gunluk");
  const [veri, setVeri] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tarih aralıkları
  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    if (tab === "gunluk") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (tab === "haftalik") {
      const day = now.getDay(); // Pazar=0
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

  // Hesaplamalar
  const toplamCiro = veri.reduce((acc, s) => acc + (s.total_price || 0), 0);
  const komisyon = toplamCiro * 0.08;
  const netOdeme = toplamCiro - komisyon;

  // En çok satan
  const urunSayilari: Record<string, number> = {};
  veri.forEach((s) => {
    urunSayilari[s.urunBaslik] = (urunSayilari[s.urunBaslik] || 0) + 1;
  });
  const enCokSatan = Object.entries(urunSayilari).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="p-8">
      {/* Sekmeler */}
      <div className="mx-auto mb-12 max-w-3xl">
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-7">
          {[
            { key: "gunluk", label: "📅 Günlük" },
            { key: "haftalik", label: "📊 Haftalık" },
            { key: "aylik", label: "📈 Aylık" },
          ].map((t) => {
            const active = tab === (t.key as any);
            return (
              <div key={t.key} className="relative">
                <button
                  onClick={() => setTab(t.key as any)}
                  aria-pressed={active}
                  className={[
                    "group relative inline-flex items-center justify-center",
                    "rounded-2xl px-10 sm:px-12 py-4 sm:py-5",
                    "font-semibold text-base sm:text-lg",
                    "transition-all duration-300 ease-out",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70",
                    active
                      ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-xl ring-1 ring-indigo-500/30 hover:shadow-2xl hover:brightness-110"
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
                    "hover:-translate-y-0.5",
                  ].join(" ")}
                >
                  {t.label}
                </button>
                {active && (
                  <span className="pointer-events-none absolute -bottom-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-indigo-500/80"></span>
                )}
              </div>
            );
          })}
        </div>
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
