// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
 apiKey: "AIzaSyBUsd_vOzSK6WE0AQuQlIwDgOESf10bHSM",
  authDomain: "birapp-44f8a.firebaseapp.com",
  projectId: "birapp-44f8a",
  storageBucket: "birapp-44f8a.firebasestorage.app",
  messagingSenderId: "987619236912",
  appId: "1:987619236912:web:7b1a7398523e55090221f5",
  measurementId: "G-BTLZMP04HS"
});

const messaging = firebase.messaging();
