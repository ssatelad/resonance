import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "connexion.html";
    return;
  }

  // Charger tous les profils
  const snapshot = await getDocs(collection(db, "users"));
  const grille = document.getElementById("grille-amis");

  // Vider la grille sauf le bouton ajouter
  const carteAjouter = grille.querySelector(".carte-ajouter");
  grille.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const profil = docSnap.data();
    const carte = document.createElement("div");
    carte.classList.add("carte-ami");

    carte.innerHTML = `
      <img class="ami-photo" src="${profil.photoURL || 'https://via.placeholder.com/80'}" alt="Photo de profil">
      <p class="ami-pseudo">${profil.pseudo}</p>
      <p class="ami-bio">${profil.bio || "Aucune bio."}</p>
      <button class="btn-voir" data-uid="${docSnap.id}">Voir le profil</button>
    `;

    grille.appendChild(carte);
  });

  // Remettre le bouton ajouter à la fin
  if (carteAjouter) grille.appendChild(carteAjouter);

  // Clic sur "Voir le profil"
  grille.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-voir")) {
      const uid = e.target.dataset.uid;
      window.location.href = `profil.html?uid=${uid}`;
    }
  });
});

// Navigation barre gauche
document.getElementById("accueil").addEventListener("click", () => window.location.href = "index.html");
document.getElementById("profil").addEventListener("click", () => {
  auth.onAuthStateChanged = null;
  import("./firebase.js").then(({ auth }) => {
    const user = auth.currentUser;
    if (user) window.location.href = `profil.html?uid=${user.uid}`;
  });
});
