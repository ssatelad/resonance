import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

applySavedTheme();

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

function applySavedTheme() {
  const saved = localStorage.getItem("resonanceTheme");
  if (!saved) return;
  const colors = JSON.parse(saved);
  document.documentElement.style.setProperty("--bg-a", colors[0]);
  document.documentElement.style.setProperty("--bg-b", colors[1]);
  document.documentElement.style.setProperty("--bg-c", colors[2]);
}
