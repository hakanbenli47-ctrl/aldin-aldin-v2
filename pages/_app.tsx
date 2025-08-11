// pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps }: AppProps) {
  // Basit Service Worker kaydı (PWA için)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // sayfa yüklendiğinde sw kaydı
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }, []);

  return (
    <>
      <Head>
        {/* Mobil uyumluluk */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* (opsiyonel) tema rengi */}
        <meta name="theme-color" content="#2563eb" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
