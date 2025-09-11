// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  Messaging
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};

// Firebase uygulamasını güvenli bir şekilde başlatan fonksiyon
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app };

// Messaging'i her yerde değil, sadece desteklenen client'ta kullan
export async function getMessagingSafe(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

// Token alma (izin, SW kaydı dahil)
export async function getFcmToken(): Promise<string | null> {
  const messaging = await getMessagingSafe();
  if (!messaging) return null;
  if (!("serviceWorker" in navigator)) return null;

  // İzin
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;
  }

  // SW kaydı (kökte olmalı: /firebase-messaging-sw.js)
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.error("FCM token alınamadı:", err);
    return null;
  }
}

// Foreground mesaj dinleme helper
export async function listenForegroundMessages(
  cb: (payload: any) => void
): Promise<() => void> {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, cb);
  return unsub;
}