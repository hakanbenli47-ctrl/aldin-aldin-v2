// pages/_app.tsx DOSYASININ OLMASI GEREKEN DOĞRU VE TEK HALİ

import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from '../lib/AuthContext'; // Eğer AuthContext kullanıyorsan bu satır kalmalı
import { app } from '../lib/firebase'; // Sadece bu import satırı Firebase ile ilgili kalmalı

// NOT: Bu kod senin projenin yapısına göre düzenlenmiştir.
// Eğer AuthProvider kullanmıyorsan o satırları silebilirsin.
// Önemli olan Firebase başlatma kodlarının tamamen kaldırılmasıdır.

export default function App({ Component, pageProps }: AppProps) {
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

      {/* Eğer AuthProvider kullanıyorsan bu yapı doğru */}
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>

      {/* Eğer AuthProvider kullanmıyorsan, sadece aşağıdaki satır yeterli */}
      {/* <Component {...pageProps} /> */}
    </>
  );
}