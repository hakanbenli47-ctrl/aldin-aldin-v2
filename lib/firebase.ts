// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, MessagePayload } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Firebase app init
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Tanı koymak için 1 kere logla (sonra kaldırabilirsin)
if (typeof window !== "undefined") {
  console.log("Firebase projectId:", app.options.projectId);
}

// ---- Firebase Messaging (FCM) ----
let messaging: ReturnType<typeof getMessaging> | null = null;
if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("Messaging init failed:", err);
  }
}

/** Tarayıcıdan FCM token alır */
export async function getFcmToken(): Promise<string | null> {
  if (!messaging) return null;
  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, // Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates → VAPID Key
    });
    console.log("FCM Token:", token);
    return token;
  } catch (err) {
    console.error("FCM token alınamadı:", err);
    return null;
  }
}

/** Foreground bildirimleri dinler */
export function listenForegroundMessages(cb: (payload: MessagePayload) => void) {
  if (!messaging) return undefined;
  const unsubscribe = onMessage(messaging, cb);
  return unsubscribe; // cleanup fonksiyonunu döndür
}

