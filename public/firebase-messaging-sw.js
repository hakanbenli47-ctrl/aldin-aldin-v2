importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBVsd_UoZSk6WE0AQu1lWpgOESf1bHSM",
  authDomain: "birapp-44f8a.firebaseapp.com",
  projectId: "birapp-44f8a",
  storageBucket: "birapp-44f8a.appspot.com",
  messagingSenderId: "987619236912",
  appId: "1:987619236912:web:7b1a7398523e5590221f5",
  measurementId: "G-BTLZMP04HS",
});

const messaging = firebase.messaging();

// Background message
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message:", payload);

  const notificationTitle = payload.notification?.title || "Yeni Bildirim";
  const notificationOptions = {
    body: payload.notification?.body || "Bir güncelleme var!",
    icon: "/logo192.png",
    data: {
      url: payload.data?.url || "https://80bir.com", // varsayılan yönlendirme
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Bildirime tıklandığında → siteye yönlendir
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification?.data?.url || "https://80bir.com";
  event.waitUntil(clients.openWindow(url));
});
