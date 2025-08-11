// pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps }: AppProps) {
  // Service Worker kaydı
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("SW register error:", err));
    }
  }, []);

  // Mobil PWA'da masaüstü görünümü zorla (isteğin)
  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      // iOS PWA
      (typeof navigator !== "undefined" && (navigator as any).standalone === true);

    const isMobileUA =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);

    const meta = document.querySelector('meta[name="viewport"]');

    if (isStandalone && isMobileUA) {
      document.body.classList.add("force-desktop");
      // Telefonda masaüstü genişliği simüle et
      meta?.setAttribute(
        "content",
        "width=1200, initial-scale=0.9, viewport-fit=cover"
      );
    } else {
      document.body.classList.remove("force-desktop");
      // Normal davranış
      meta?.setAttribute(
        "content",
        "width=device-width, initial-scale=1, viewport-fit=cover"
      );
    }
  }, []);

  return (
    <>
      <Head>
        {/* Varsayılan viewport – yukarıdaki effect gerekirse bunu değiştirir */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        {/* iOS kısayol ikonu: elindeki 192px dosyayı kullanıyoruz (180 yoksa 404 olmasın) */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
