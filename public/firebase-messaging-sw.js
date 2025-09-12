// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIza...KRM",
  authDomain: "birapp-67573.firebaseapp.com",
  projectId: "birapp-67573",
  storageBucket: "birapp-67573.appspot.com", // ✅ düzeltildi
  messagingSenderId: "575930274632",
  appId: "1:575930274632:web:760add3bcb2558e8d0d97d",
  measurementId: "G-SR16YENH0L"
});

const messaging = firebase.messaging();
