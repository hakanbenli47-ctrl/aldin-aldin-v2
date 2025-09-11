// public/firebase-messaging-sw.js
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging-compat.js');

// Buradaki değerler PUBLIC'tır; env kullanamazsın. NEXT_PUBLIC olanları buraya MANUEL yaz.
firebase.initializeApp({
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY_DEĞERİN",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEĞERİN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEĞERİN",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEĞERİN",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEĞERİN",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID_DEĞERİN",
  measurementId: "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_DEĞERİN",
});

const messaging = firebase.messaging();

// Arka planda gelen push'u göster
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || "Yeni bildirim";
  const options = {
    body: notification.body,
    icon: notification.image || "/icons/icon-192.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

// Bildirime tıklama davranışı (isteğe bağlı)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
