import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBvJdU...",
  authDomain: "birapp-44f8a.firebaseapp.com",
  projectId: "birapp-44f8a",
  storageBucket: "birapp-44f8a.appspot.com",
  messagingSenderId: "987619236912",
  appId: "1:987619236912:web:7b1a739852e5590221f5",
};

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then(() => console.log("Service Worker registered"))
        .catch((err) => console.error("SW register error:", err));
    }

    // Firebase başlat
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // Token al
    getToken(messaging, {
      vapidKey:
        "BDgEzYFX7Jdx7ch28xHMXLRuWOhwSeyTZkYOszOOSj8DORBO2JagAMVT47hxn4MeyBx8NkIsVj0tJuJXINAUc_4",
    })
      .then((currentToken) => {
        if (currentToken) {
          console.log("FCM Token:", currentToken);

          // API’ye gönder → Supabase’e kaydetsin
          fetch("/api/save-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: currentToken }),
          });
        } else {
          console.log("No registration token available.");
        }
      })
      .catch((err) => {
        console.error("An error occurred while retrieving token.", err);
      });

    // Foreground mesaj dinleme
    onMessage(messaging, (payload) => {
      console.log("Message received. ", payload);

      // Eğer url datası geldiyse → siteye yönlendir
      if (payload.data?.url) {
        window.location.href = payload.data.url;
      } else {
        alert(payload.notification?.title || "Yeni bildirim!");
      }
    });
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
