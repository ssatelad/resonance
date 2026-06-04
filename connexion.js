import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

// Si déjà connecté, rediriger vers hub
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "hub.html";
});

// Connexion Email / Mot de passe
document.getElementById("btn-connexion").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const mdp = document.getElementById("mdp").value;

  if (!email || !mdp) {
    alert("Remplis tous les champs.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, mdp);
    window.location.href = "hub.html";
  } catch (err) {
    alert("Erreur : " + traduireErreur(err.code));
  }
});

// Connexion Google
document.getElementById("btn-google").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = "hub.html";
  } catch (err) {
    alert("Erreur Google : " + err.message);
  }
});

function traduireErreur(code) {
  switch (code) {
    case "auth/user-not-found": return "Aucun compte avec cet email.";
    case "auth/wrong-password": return "Mot de passe incorrect.";
    case "auth/invalid-email": return "Email invalide.";
    case "auth/too-many-requests": return "Trop de tentatives. Réessaie plus tard.";
    default: return "Une erreur est survenue.";
  }
}
