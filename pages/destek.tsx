// pages/destek.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Mesaj = {
  id: number;
  sohbet_id: number;
  gonderen_email: string;
  mesaj_metni: string;
  gonderilme_tarihi: string;
  rol: "kullanici" | "destek";
};

export default function Destek() {
  const [sohbetId, setSohbetId] = useState<number | null>(null);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const [userEmail, setUserEmail] = useState<string>("");
  const kutuRef = useRef<HTMLDivElement>(null);

  // 1) Kullanıcıyı al, sohbeti bul/yoksa oluştur
  useEffect(() => {
    let channel: any;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const uid = auth.user.id;
      const email = auth.user.email ?? "";
      setUserEmail(email);

      // Var olan pending/active sohbeti getir
      const { data: existing, error: selErr } = await supabase
        .from("destek_sohbetleri")
        .select("id")
        .eq("user_id", uid)
        .in("status", ["pending", "active"])
        .order("baslangic_tarihi", { ascending: false })
        .limit(1)
        .maybeSingle();

      let currentId = existing?.id;

      // Yoksa oluştur
      if (!currentId) {
        const { data: ins, error: insErr } = await supabase
          .from("destek_sohbetleri")
          .insert([
            {
              user_id: uid,
              kullanici_email: email,
              baslik: "Canlı destek talebi",
              status: "pending",
            },
          ])
          .select("id")
          .single();
        if (ins) currentId = ins.id as unknown as number;
      }

      if (!currentId) return;
      setSohbetId(currentId);

      // İlk mesajları çek
      await loadMesajlar(currentId);

      // Realtime dinle
      channel = supabase
        .channel("realtime-destek-mesajlari")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "destek_mesajlari",
            filter: `sohbet_id=eq.${currentId}`,
          },
          (payload) => {
            const row = payload.new as any;
            setMesajlar((prev) => [
              ...prev,
              {
                id: row.id,
                sohbet_id: row.sohbet_id,
                gonderen_email: row.gonderen_email,
                mesaj_metni: row.mesaj_metni,
                gonderilme_tarihi: row.gonderilme_tarihi,
                rol: row.rol,
              },
            ]);
            scrollToBottom();
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const loadMesajlar = async (sid: number) => {
    const { data } = await supabase
      .from("destek_mesajlari")
      .select("*")
      .eq("sohbet_id", sid)
      .order("gonderilme_tarihi", { ascending: true });
    if (data) setMesajlar(data as any);
    scrollToBottom();
  };

  const scrollToBottom = () =>
    setTimeout(() => {
      kutuRef.current?.scrollTo(0, kutuRef.current.scrollHeight);
    }, 80);

  // 2) Mesaj gönder
 const gonder = async () => {
  if (!yeniMesaj.trim() || !sohbetId) return;

  const { error } = await supabase.from("destek_mesajlari").insert({
    sohbet_id: sohbetId,
    gonderen_email: userEmail,
    mesaj_metni: yeniMesaj.trim(),
    rol: "kullanici",
  });

  if (error) {
    console.error("Mesaj gönderilemedi:", error);
    alert("Mesaj gönderilemedi: " + error.message);
  } else {
    setYeniMesaj("");
  }
};

  return (
    <div style={{ maxWidth: 640, margin: "20px auto", padding: 16 }}>
      <h2 style={{ color: "#1648b0", marginBottom: 8 }}>💬 Canlı Destek</h2>
      <p style={{ marginBottom: 12, color: "#555" }}>
        Mesajınızı yazın. Destek ekibi sohbete katıldığında yanıtları burada göreceksiniz.
      </p>

      <div
        ref={kutuRef}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          height: 420,
          overflowY: "auto",
          padding: 12,
          background: "#f9fafb",
          marginBottom: 12,
        }}
      >
        {mesajlar.map((m) => {
          const benim = m.rol === "kullanici";
          return (
            <div key={m.id} style={{ textAlign: benim ? "right" : "left", marginBottom: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  background: benim ? "#dbeafe" : "#e5e7eb",
                  padding: "8px 12px",
                  borderRadius: 16,
                  maxWidth: "75%",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.mesaj_metni}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={yeniMesaj}
          onChange={(e) => setYeniMesaj(e.target.value)}
          placeholder="Mesajınızı yazın…"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
        />
        <button
          onClick={gonder}
          style={{
            background: "#1648b0",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 16px",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Gönder
        </button>
      </div>
    </div>
  );
}
