// pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Yüklemeyi beklemeden anında kaydet
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("SW register error:", err));
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        {/* iOS için kısayol ikonu (opsiyonel ama faydalı) */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
