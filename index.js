import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Si l'utilisateur est déjà connecté, on le redirige vers le hub
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "hub.html";
  }
});

document.getElementById("btn-creer").addEventListener("click", () => {
  window.location.href = "création.html";
});

document.getElementById("btn-connexion").addEventListener("click", () => {
  window.location.href = "connexion.html";
});
