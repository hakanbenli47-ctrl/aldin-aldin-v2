"use client";

import { useEffect, useState } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "../lib/firebase";
import { supabase } from "../lib/supabaseClient"; // ✅ Supabase client

export default function NotificationComponent() {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<any>(null);

  useEffect(() => {
    const messaging = getMessaging(app);

    // Bildirim izni iste
    window.Notification.requestPermission().then(async (permission: NotificationPermission) => {
      if (permission === "granted") {
        console.log("Bildirim izni verildi ✅");

        try {
          const currentToken = await getToken(messaging, {
            vapidKey: "BDgEzYFX7Jdx7ch28xHMXLRuWOhwSeyTZkYOszOOSj8DORBO2JagAMVT47hxn4MeyBx8NkIsVj0tJuJXINAUc_4",
          });

          if (currentToken) {
            console.log("FCM Token:", currentToken);
            setToken(currentToken);

            // 🔹 Supabase’e kaydet
            const { data: { user } } = await supabase.auth.getUser(); // giriş yapan kullanıcıyı al
            if (user) {
              const { error } = await supabase
                .from("notification_tokens")
                .upsert(
                  {
                    user_id: user.id,
                    token: currentToken,
                  },
                  { onConflict: "user_id" }
                );

              if (error) console.error("Supabase kayıt hatası ❌", error);
              else console.log("Token Supabase'e kaydedildi ✅");
            }
          } else {
            console.log("Token alınamadı ❌");
          }
        } catch (err) {
          console.error("Token alma hatası:", err);
        }
      } else {
        console.log("Bildirim izni reddedildi ❌");
      }
    });

    // Ön planda bildirim yakala
    onMessage(messaging, (payload) => {
      console.log("Ön planda bildirim geldi:", payload);
      setMessage(payload.notification);
    });
  }, []);

  return (
    <div style={{ padding: 16, background: "#f1f5f9", borderRadius: 8 }}>
      <h3>🔔 Firebase Bildirim Testi</h3>
      {token ? (
        <p>
          <strong>FCM Token:</strong> <br /> {token}
        </p>
      ) : (
        <p>Token alınamadı...</p>
      )}

      {message && (
        <div style={{ marginTop: 16, padding: 12, background: "#fff" }}>
          <h4>{message.title}</h4>
          <p>{message.body}</p>
        </div>
      )}
    </div>
  );
}
