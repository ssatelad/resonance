import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "hub.html";
  }
});

document.getElementById("btn-creer").addEventListener("click", () => {
  window.location.href = "creation.html";
});

document.getElementById("btn-connexion").addEventListener("click", () => {
  window.location.href = "connexion.html";
});
