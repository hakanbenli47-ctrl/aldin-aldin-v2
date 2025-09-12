/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging-compat.js');

// ✅ Güncel 67573 projenin config değerleri
firebase.initializeApp({
  apiKey: "AIzaSyAz_ZEDKke3Pg0SyA2uV5jIOuu5pvRuKRM",
  authDomain: "birapp-67573.firebaseapp.com",
  projectId: "birapp-67573",
  storageBucket: "birapp-67573.appspot.com",
  messagingSenderId: "575930274632",
  appId: "1:575930274632:web:76dadd3bcb2558e8d0d97d",
  measurementId: "G-SR16YENH0L",
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

// Bildirime tıklama davranışı
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
