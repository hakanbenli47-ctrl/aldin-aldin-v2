// Bu dosya public klasöründe olacak: /public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// Aynı config'i buraya da yazmalısın
firebase.initializeApp({
  apiKey: "AIzaSyBVsd_UoZSk6WE0AQu1lWpgOESf1bHSM",
  authDomain: "birapp-44f8a.firebaseapp.com",
  projectId: "birapp-44f8a",
  storageBucket: "birapp-44f8a.appspot.com",
  messagingSenderId: "987619236912",
  appId: "1:987619236912:web:7b1a7398523e5590221f5",
  measurementId: "G-BTLZMP04HS",
});

// messaging'i al
const messaging = firebase.messaging();

// Bildirim arka planda geldiğinde tetiklenir
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message received:", payload);

  const notificationTitle = payload.notification?.title || "Yeni Bildirim";
  const notificationOptions = {
    body: payload.notification?.body || "Bir güncelleme var!",
    icon: "/logo192.png" // Buraya kendi ikonunu ekle
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
