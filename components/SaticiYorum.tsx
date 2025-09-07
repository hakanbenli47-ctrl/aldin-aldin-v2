import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type YorumRow = {
  id: number;
  urun_id: number;
  user_id: string;
  yorum: string;
  puan: number | null;
  created_at: string;
};

type IlanBasic = {
  id: number;
  title: string;
  resim_url: string[] | string | null;
};

const Star = ({ fill = false }: { fill?: boolean }) => (
  <span style={{ color: fill ? "#f59e0b" : "#e5e7eb", fontSize: 16 }}>★</span>
);

function renderStars(n: number) {
  const v = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} fill={i < v} />
      ))}
    </>
  );
}

export default function SaticiYorum({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [yorumlar, setYorumlar] = useState<YorumRow[]>([]);
  const [urunMap, setUrunMap] = useState<Record<number, IlanBasic>>({});

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setErr(null);

      const sellerEmail: string | undefined = user?.email;
      if (!sellerEmail) {
        setErr("Oturum bulunamadı.");
        setLoading(false);
        return;
      }

      // 1) Bu satıcının ilanlarını al
      const { data: ilanlar, error: e1 } = await supabase
        .from("ilan")
        .select("id, title, resim_url")
        .eq("user_email", sellerEmail);

      if (e1) {
        if (alive) {
          setErr(e1.message);
          setLoading(false);
        }
        return;
      }

      const ids = (ilanlar ?? []).map((i) => i.id);
      const map: Record<number, IlanBasic> = {};
      (ilanlar ?? []).forEach((i) => (map[i.id] = i as IlanBasic));
      if (ids.length === 0) {
        if (alive) {
          setUrunMap(map);
          setYorumlar([]);
          setLoading(false);
        }
        
        return;
      }

      // 2) Bu ilanlar için yorumları al
      const { data: rows, error: e2 } = await supabase
        .from("yorumlar")
        .select("id, urun_id, user_id, yorum, puan, created_at")
        .in("urun_id", ids)
        .order("created_at", { ascending: false });

      if (e2) {
        if (alive) {
          setErr(e2.message);
          setLoading(false);
        }
        return;
      }

      if (alive) {
        setUrunMap(map);
        setYorumlar(rows ?? []);
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [user?.email]);
// --- Yorumlar açıldığında okundu yap ---
useEffect(() => {
  if (!user?.email) return;

  async function markAllRead() {
    // önce bu satıcının ilanlarını bul
    const { data: ilanlar } = await supabase
      .from("ilan")
      .select("id")
      .eq("user_email", user.email);

    const ids = ilanlar?.map(i => i.id) || [];
    if (ids.length === 0) return;

    // okunmamış yorumları okundu: true yap
    await supabase
      .from("yorumlar")
      .update({ okundu: true })
      .in("urun_id", ids)
      .eq("okundu", false);
  }

  markAllRead();
}, [user?.email]);

  const grouped = useMemo(() => {
    const g: Record<number, YorumRow[]> = {};
    for (const r of yorumlar) {
      (g[r.urun_id] ??= []).push(r);
    }
    return g;
  }, [yorumlar]);

  const overallAvg = useMemo(() => {
    if (yorumlar.length === 0) return 0;
    const sum = yorumlar.reduce((a, r) => a + (r.puan ?? 0), 0);
    return sum / yorumlar.length;
  }, [yorumlar]);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 15,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>İlan Yorumları</h3>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#64748b" }}>
          {yorumlar.length} yorum • {renderStars(Math.round(overallAvg))}{" "}
          <span style={{ marginLeft: 6 }}>
            ({overallAvg.toFixed(1)})
          </span>
        </div>
      </div>

      {loading && (
        <div style={{ color: "#888", fontSize: 14, textAlign: "center" }}>
          Yükleniyor…
        </div>
      )}

      {!loading && err && (
        <div style={{ color: "#b91c1c", fontSize: 14, textAlign: "center" }}>
          {err}
        </div>
      )}

      {!loading && !err && yorumlar.length === 0 && (
        <div style={{ color: "#888", fontSize: 14, textAlign: "center" }}>
          Şimdilik hiç yorum yok.
        </div>
      )}

      {!loading && !err && yorumlar.length > 0 && (
        <div style={{ display: "grid", gap: 14 }}>
          {Object.keys(grouped)
            .map((k) => Number(k))
            .sort((a, b) => b - a)
            .map((urunId) => {
              const urun = urunMap[urunId];
              const list = grouped[urunId] || [];
              const avg =
                list.reduce((a, r) => a + (r.puan ?? 0), 0) /
                Math.max(1, list.length);

              const img =
                Array.isArray(urun?.resim_url)
                  ? urun?.resim_url?.[0]
                  : urun?.resim_url || "/placeholder.jpg";

              return (
                <div
                  key={urunId}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 12,
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <img
                      src={img || "/placeholder.jpg"}
                      alt={urun?.title || String(urunId)}
                      style={{
                        width: 64,
                        height: 48,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <div style={{ fontWeight: 800 }}>
                      {urun?.title || `#${urunId}`}
                      <div
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        {renderStars(Math.round(avg))}{" "}
                        <span style={{ marginLeft: 6 }}>
                          ({avg.toFixed(1)}) • {list.length} yorum
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {list.map((y) => (
                      <div
                        key={y.id}
                        style={{
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {renderStars(Math.round(y.puan ?? 0))}
                          </div>
                          <small style={{ color: "#94a3b8" }}>
                            {new Date(y.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        <div style={{ fontSize: 14, color: "#111827" }}>
                          {y.yorum}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
