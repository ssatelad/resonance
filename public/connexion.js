import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await creerProfilSiAbsent(user);
    window.location.href = "hub.html";
  }
});

async function creerProfilSiAbsent(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      pseudo: user.displayName || "Nouvel utilisateur",
      bio: "",
      photoURL: user.photoURL || "",
      musiques: [],
      collections: [],
      reposts: [],
      identifications: [],
      likes: [],
      theme: { gradient: "160deg, #0a2e14, #0f4d22, #1a7a38" },
      createdAt: Date.now()
    });
  }
}

document.getElementById("btn-connexion").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const mdp = document.getElementById("mdp").value;

  if (!email || !mdp) {
    alert("Remplis tous les champs.");
    return;
  }

  try {
    const result = await signInWithEmailAndPassword(auth, email, mdp);
    await creerProfilSiAbsent(result.user);
    window.location.href = "hub.html";
  } catch (err) {
    alert("Erreur : " + traduireErreur(err.code));
  }
});

document.getElementById("btn-google").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await creerProfilSiAbsent(result.user);
    window.location.href = "hub.html";
  } catch (err) {
    alert("Erreur Google : " + err.message);
  }
});

function traduireErreur(code) {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Email ou mot de passe incorrect. Si tu n'as pas encore cree ce compte, clique sur Creer un profil.";
    case "auth/invalid-email": return "Email invalide.";
    case "auth/missing-password": return "Entre ton mot de passe.";
    case "auth/operation-not-allowed": return "La connexion email/mot de passe n'est pas activee dans Firebase Authentication.";
    case "auth/too-many-requests": return "Trop de tentatives. Reessaie plus tard.";
    case "auth/network-request-failed": return "Probleme de connexion reseau. Reessaie dans quelques secondes.";
    default: return `Une erreur est survenue (${code || "code inconnu"}).`;
  }
}
