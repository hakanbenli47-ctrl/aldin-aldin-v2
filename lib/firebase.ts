// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// 🔑 Senin Firebase Web Config'in
const firebaseConfig = {
  apiKey: "AIzaSyBVsd_VoZSk6WEoAQuIlTw9oGESf1bHSM",
  authDomain: "birapp-44f8a.firebaseapp.com",
  projectId: "birapp-44f8a",
  storageBucket: "birapp-44f8a.firebasestorage.app",
  messagingSenderId: "987619236912",
  appId: "1:987619236912:web:7b1a7398523e5590221f5",
  measurementId: "G-BTLZMP04HS",
};

// ✅ Firebase başlat
const app = initializeApp(firebaseConfig);

// 🔔 Bildirim için messaging objesi
let messaging;
if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.error("Messaging init error:", e);
  }
}

export { app, messaging, getToken, onMessage };
