import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// 🔑 Senin Firebase config’in
const firebaseConfig = {
  apiKey: "AIzaSyBvd_VoZsK6WeoAQulITwp9Q6c5FlbHSM",
  authDomain: "birapp-44f8a.firebaseapp.com",
  projectId: "birapp-44f8a",
  storageBucket: "birapp-44f8a.appspot.com",
  messagingSenderId: "987619236912",
  appId: "1:987619236912:web:b71a7398523e5590221f5",
  measurementId: "G-BTLZMP04HS",
};

const app = initializeApp(firebaseConfig);

// 🔔 Messaging objesi
let messaging: any;
if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.error("Messaging init error:", e);
  }
}

// 📌 Token alma (BURAYA kendi VAPID key’ini koymalısın!)
export const getFcmToken = async () => {
  try {
    const token = await getToken(messaging, {
      vapidKey: "BURAYA_FIREBASE_CONSOLE_DAN_ALDIĞIN_PUBLIC_VAPID_KEY",
    });
    console.log("FCM Token:", token);
    return token;
  } catch (err) {
    console.error("FCM token alınamadı:", err);
    return null;
  }
};

export { app, messaging, onMessage };
