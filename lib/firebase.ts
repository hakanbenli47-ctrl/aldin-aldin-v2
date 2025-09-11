import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase config (env değişkenlerinden okunuyor)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Tekrar tekrar initialize olmasın
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Messaging sadece tarayıcıda aktif olsun
let messaging: any = null;
if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("Messaging init skipped:", err);
  }
}

// Token alma fonksiyonu
export const getFcmToken = async () => {
  if (!messaging) return null; // SSR sırasında hata çıkmaz

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    console.log("FCM Token:", token);
    return token;
  } catch (err) {
    console.error("FCM token alınamadı:", err);
    return null;
  }
};

export { app, messaging, onMessage };
