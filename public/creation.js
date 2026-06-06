import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "hub.html";
});

async function creerProfil(user, pseudo) {
  const ref = doc(db, "users", user.uid);
  const existe = await getDoc(ref);

  if (!existe.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      pseudo: pseudo || user.displayName || "Nouvel utilisateur",
      bio: "",
      photoURL: user.photoURL || "",
      musiques: [],
      collections: [],
      reposts: [],
      identifications: [],
      likes: [],
      theme: {
        gradient: "160deg, #0a2e14, #0f4d22, #1a7a38"
      },
      createdAt: Date.now()
    });
  }
}

document.getElementById("btn-connexion").addEventListener("click", async () => {
  const pseudo = document.getElementById("pseudo").value.trim();
  const email = document.getElementById("email").value.trim();
  const mdp = document.getElementById("mdp").value;
  const mdpConfirm = document.getElementById("mdp-confirm").value;

  if (!pseudo || !email || !mdp || !mdpConfirm) {
    alert("Remplis tous les champs.");
    return;
  }

  if (mdp !== mdpConfirm) {
    alert("Les mots de passe ne correspondent pas.");
    return;
  }

  if (mdp.length < 6) {
    alert("Le mot de passe doit faire au moins 6 caracteres.");
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, mdp);
    await creerProfil(result.user, pseudo);
    window.location.href = "hub.html";
  } catch (err) {
    alert("Erreur : " + traduireErreur(err.code));
  }
});

document.getElementById("btn-google").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await creerProfil(result.user, result.user.displayName);
    window.location.href = "hub.html";
  } catch (err) {
    alert("Erreur Google : " + err.message);
  }
});

function traduireErreur(code) {
  switch (code) {
    case "auth/email-already-in-use": return "Cet email est deja utilise.";
    case "auth/invalid-email": return "Email invalide.";
    case "auth/weak-password": return "Mot de passe trop faible.";
    case "auth/operation-not-allowed": return "L'inscription email/mot de passe n'est pas activee dans Firebase Authentication.";
    case "auth/network-request-failed": return "Probleme de connexion reseau. Reessaie dans quelques secondes.";
    default: return `Une erreur est survenue (${code || "code inconnu"}).`;
  }
}
