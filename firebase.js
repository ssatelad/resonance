import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDl_0g9nMiYcEN74obDoDYQKTj17T-hhOU",
  authDomain: "resonance-27da5.firebaseapp.com",
  projectId: "resonance-27da5",
  storageBucket: "resonance-27da5.firebasestorage.app",
  messagingSenderId: "553681628185",
  appId: "1:553681628185:web:16e711c5b088d6fbcd4e88"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
