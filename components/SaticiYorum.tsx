import React from "react";

export default function SaticiYorum({ user }: { user: any }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
      }}
    >
      <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
        İlan Yorumları
      </h3>
      <div style={{ color: "#888", fontSize: 14, textAlign: "center" }}>
        Şimdilik hiç yorum yok.
      </div>
    </div>
  );
}

