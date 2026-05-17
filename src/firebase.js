import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCyJuWH6NYUIehFib7NVBGkLGG7vhKuv9g",
  authDomain: "catalogue21-92e8b.firebaseapp.com",
  projectId: "catalogue21-92e8b",
  storageBucket: "catalogue21-92e8b.firebasestorage.app",
  messagingSenderId: "828111651708",
  appId: "1:828111651708:web:d142df49753d1b77989af9"
};

// Initialize Firebase (HMR Safe)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Fix QUIC protocol errors and make it HMR Safe
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
} catch (error) {
  // Catch the "already initialized" error from Vite Hot Reload
  db = getFirestore(app);
}

const functions = getFunctions(app, "us-central1");

export { db, functions };