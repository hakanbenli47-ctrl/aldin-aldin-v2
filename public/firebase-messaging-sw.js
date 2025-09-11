// public/firebase-messaging-sw.js

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging-compat.js');

// GERÇEK ANAHTARLARINIZ BURADA
firebase.initializeApp({
  apiKey: "AIzaSyBvd_VoZsK6WeoAQulITwp9Q6c5FlbHSM",
  authDomain: "birapp-44f8a.firebaseapp.com",
  projectId: "birapp-44f8a",
  storageBucket: "birapp-44f8a.appspot.com",
  messagingSenderId: "987619236912",
  appId: "1:987619236912:web:b71a7398523e5590221f5",
  measurementId: "G-BTLZMP04HS",
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