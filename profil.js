import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, arrayUnion, collection, addDoc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Récupérer l'uid depuis l'URL
const params = new URLSearchParams(window.location.search);
const profilUID = params.get("uid");

let currentUser = null;
let profilData = null;
let affichageActuel = "grille"; // grille ou liste
let ongletActuel = "postes"; // postes, identifications, collections

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "connexion.html";
    return;
  }
  currentUser = user;

  const uid = profilUID || user.uid;
  const ref_ = doc(db, "users", uid);
  const snap = await getDoc(ref_);

  if (!snap.exists()) {
    alert("Profil introuvable.");
    return;
  }

  profilData = snap.data();
  afficherProfil(uid, profilData, user);
});

function afficherProfil(uid, data, user) {
  const estMonProfil = uid === user.uid;

  // Appliquer le thème
  if (data.theme?.gradient) {
    document.body.style.background = `linear-gradient(${data.theme.gradient})`;
  }

  // Infos de base
  document.getElementById("photo-profil").src = data.photoURL || "https://via.placeholder.com/120";
  document.getElementById("pseudo").textContent = data.pseudo || "Sans pseudo";
  document.getElementById("bio").textContent = data.bio || "Aucune bio.";

  // Stats
  const musiques = data.musiques || [];
  const collections = data.collections || [];
  document.querySelector("#stats span:nth-child(1)").innerHTML = `<strong>${musiques.length}</strong> musiques`;
  document.querySelector("#stats span:nth-child(2)").innerHTML = `<strong>${collections.length}</strong> collections`;

  // Boutons selon si c'est mon profil ou pas
  const actionsDiv = document.getElementById("actions-profil");
  if (estMonProfil) {
    actionsDiv.innerHTML = `
      <button id="btn-modifier">Modifier le profil</button>
      <button id="btn-ajouter-musique">+ Ajouter une musique</button>
      <button id="btn-deconnexion">Se déconnecter</button>
    `;
    document.getElementById("btn-modifier").addEventListener("click", () => ouvrirModale("modifier"));
    document.getElementById("btn-ajouter-musique").addEventListener("click", () => ouvrirModale("musique"));
    document.getElementById("btn-deconnexion").addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });
  } else {
    actionsDiv.innerHTML = `<button id="btn-like">👍 Liker</button>`;
    document.getElementById("btn-like").addEventListener("click", () => likerProfil(uid));
  }

  // Afficher les musiques par défaut
  afficherMusiques(data.musiques || []);

  // Onglets
  document.getElementById("btn-postes").addEventListener("click", () => {
    setOnglet("postes");
    afficherMusiques(data.musiques || []);
  });
  document.getElementById("btn-collections").addEventListener("click", () => {
    setOnglet("collections");
    afficherCollections(data.collections || []);
  });
  document.getElementById("btn-identifications").addEventListener("click", () => {
    setOnglet("identifications");
    afficherIdentifications(uid);
  });

  // Toggle grille/liste
  document.getElementById("btn-grille").addEventListener("click", () => {
    affichageActuel = "grille";
    document.getElementById("zone-musiques").classList.remove("liste");
    document.getElementById("btn-grille").classList.add("actif");
    document.getElementById("btn-liste").classList.remove("actif");
  });
  document.getElementById("btn-liste").addEventListener("click", () => {
    affichageActuel = "liste";
    document.getElementById("zone-musiques").classList.add("liste");
    document.getElementById("btn-liste").classList.add("actif");
    document.getElementById("btn-grille").classList.remove("actif");
  });
}

// --- AFFICHER MUSIQUES ---
function afficherMusiques(musiques) {
  const zone = document.getElementById("zone-musiques");
  zone.innerHTML = "";

  if (musiques.length === 0) {
    zone.innerHTML = `<p style="color:#a8f0bc; font-size:13px;">Aucune musique pour l'instant.</p>`;
    return;
  }

  musiques.forEach((m, index) => {
    const carte = document.createElement("div");
    carte.classList.add("carte-musique");
    carte.innerHTML = `
      <img src="${m.thumbnail}" alt="${m.titre}">
      <div class="musique-info">
        <p class="musique-titre">${m.titre}</p>
        <p class="musique-source">${m.type === "youtube" ? "YouTube" : "Fichier"}</p>
      </div>
    `;
    carte.addEventListener("click", () => jouerMusique(m));
    zone.appendChild(carte);
  });
}

// --- AFFICHER COLLECTIONS ---
function afficherCollections(collections) {
  const zone = document.getElementById("zone-musiques");
  zone.innerHTML = "";

  if (collections.length === 0) {
    zone.innerHTML = `<p style="color:#a8f0bc; font-size:13px;">Aucune collection pour l'instant.</p>`;
    return;
  }

  collections.forEach((c) => {
    const carte = document.createElement("div");
    carte.classList.add("carte-musique");
    carte.innerHTML = `
      <div class="collection-cover">🎵</div>
      <div class="musique-info">
        <p class="musique-titre">${c.nom}</p>
        <p class="musique-source">${c.musiques?.length || 0} musiques</p>
      </div>
    `;
    zone.appendChild(carte);
  });
}

// --- AFFICHER IDENTIFICATIONS ---
async function afficherIdentifications(uid) {
  const zone = document.getElementById("zone-musiques");
  zone.innerHTML = `<p style="color:#a8f0bc; font-size:13px;">Chargement...</p>`;

  const snapshot = await getDocs(collection(db, "users"));
  const musiquesTagguees = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    (data.musiques || []).forEach((m) => {
      if (m.tags && m.tags.includes(uid)) {
        musiquesTagguees.push({ ...m, de: data.pseudo });
      }
    });
  });

  zone.innerHTML = "";
  if (musiquesTagguees.length === 0) {
    zone.innerHTML = `<p style="color:#a8f0bc; font-size:13px;">Aucune identification.</p>`;
    return;
  }

  musiquesTagguees.forEach((m) => {
    const carte = document.createElement("div");
    carte.classList.add("carte-musique");
    carte.innerHTML = `
      <img src="${m.thumbnail}" alt="${m.titre}">
      <div class="musique-info">
        <p class="musique-titre">${m.titre}</p>
        <p class="musique-source">Ajouté par ${m.de}</p>
      </div>
    `;
    carte.addEventListener("click", () => jouerMusique(m));
    zone.appendChild(carte);
  });
}

// --- JOUER MUSIQUE ---
let playerActif = null;

function jouerMusique(m) {
  // Supprimer l'ancien player s'il existe
  const ancienPlayer = document.getElementById("mini-player");
  if (ancienPlayer) ancienPlayer.remove();

  const player = document.createElement("div");
  player.id = "mini-player";

  if (m.type === "youtube") {
    const videoId = extraireYoutubeId(m.url);
    player.innerHTML = `
      <div id="player-header">
        <span>${m.titre}</span>
        <button id="fermer-player">✕</button>
      </div>
      <iframe width="320" height="180"
        src="https://www.youtube.com/embed/${videoId}?autoplay=1"
        frameborder="0" allow="autoplay; encrypted-media" allowfullscreen>
      </iframe>
    `;
  } else {
    player.innerHTML = `
      <div id="player-header">
        <span>${m.titre}</span>
        <button id="fermer-player">✕</button>
      </div>
      <audio controls autoplay src="${m.url}" style="width:100%; margin-top:8px;"></audio>
    `;
  }

  document.body.appendChild(player);
  document.getElementById("fermer-player").addEventListener("click", () => player.remove());
}

// --- MODALES ---
function ouvrirModale(type) {
  const existante = document.getElementById("modale");
  if (existante) existante.remove();

  const modale = document.createElement("div");
  modale.id = "modale";

  if (type === "musique") {
    modale.innerHTML = `
      <div id="modale-contenu">
        <h2>Ajouter une musique</h2>
        <div class="champ">
          <label>Lien YouTube</label>
          <input type="text" id="input-youtube" placeholder="https://youtube.com/watch?v=...">
        </div>
        <p style="text-align:center; color:#a8f0bc; font-size:12px; margin: -8px 0 4px;">— ou —</p>
        <div class="champ">
          <label>Fichier MP3 / MP4</label>
          <input type="file" id="input-fichier" accept="audio/*,video/mp4">
        </div>
        <div class="champ">
          <label>Titre (optionnel)</label>
          <input type="text" id="input-titre" placeholder="Nom de la musique">
        </div>
        <div id="modale-actions">
          <button id="btn-valider-musique">Ajouter</button>
          <button id="btn-fermer-modale">Annuler</button>
        </div>
      </div>
    `;
    document.body.appendChild(modale);
    document.getElementById("btn-fermer-modale").addEventListener("click", () => modale.remove());
    document.getElementById("btn-valider-musique").addEventListener("click", () => ajouterMusique(modale));

  } else if (type === "modifier") {
    modale.innerHTML = `
      <div id="modale-contenu">
        <h2>Modifier le profil</h2>
        <div class="champ">
          <label>Pseudo</label>
          <input type="text" id="input-pseudo" value="${profilData.pseudo || ""}">
        </div>
        <div class="champ">
          <label>Bio</label>
          <input type="text" id="input-bio" value="${profilData.bio || ""}">
        </div>
        <div class="champ">
          <label>Photo de profil (URL ou fichier)</label>
          <input type="text" id="input-photo-url" placeholder="https://...">
          <input type="file" id="input-photo-fichier" accept="image/*" style="margin-top:8px;">
        </div>
        <div class="champ">
          <label>Dégradé de fond (ex: 160deg, #0a2e14, #1a7a38)</label>
          <input type="text" id="input-gradient" value="${profilData.theme?.gradient || "160deg, #0a2e14, #1a7a38"}">
        </div>
        <div id="modale-actions">
          <button id="btn-valider-modifier">Enregistrer</button>
          <button id="btn-fermer-modale">Annuler</button>
        </div>
      </div>
    `;
    document.body.appendChild(modale);
    document.getElementById("btn-fermer-modale").addEventListener("click", () => modale.remove());
    document.getElementById("btn-valider-modifier").addEventListener("click", () => modifierProfil(modale));
  }

  modale.addEventListener("click", (e) => {
    if (e.target === modale) modale.remove();
  });
}

// --- AJOUTER MUSIQUE ---
async function ajouterMusique(modale) {
  const youtubeUrl = document.getElementById("input-youtube").value.trim();
  const fichier = document.getElementById("input-fichier").files[0];
  const titreInput = document.getElementById("input-titre").value.trim();

  if (!youtubeUrl && !fichier) {
    alert("Ajoute un lien YouTube ou un fichier.");
    return;
  }

  let musique = {};

  if (youtubeUrl) {
    const videoId = extraireYoutubeId(youtubeUrl);
    if (!videoId) { alert("Lien YouTube invalide."); return; }

    // Récupérer le titre via oEmbed
    let titre = titreInput;
    if (!titre) {
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${youtubeUrl}&format=json`);
        const data = await res.json();
        titre = data.title;
      } catch {
        titre = "Musique YouTube";
      }
    }

    musique = {
      type: "youtube",
      url: youtubeUrl,
      videoId,
      titre,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      ajouteLe: new Date().toISOString()
    };

  } else if (fichier) {
    const storageRef = ref(storage, `musiques/${currentUser.uid}/${Date.now()}_${fichier.name}`);
    await uploadBytes(storageRef, fichier);
    const url = await getDownloadURL(storageRef);

    musique = {
      type: "fichier",
      url,
      titre: titreInput || fichier.name.replace(/\.[^/.]+$/, ""),
      thumbnail: "https://via.placeholder.com/300x300/061a0d/2bff63?text=♪",
      ajouteLe: new Date().toISOString()
    };
  }

  // Sauvegarder dans Firestore
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    musiques: arrayUnion(musique)
  });

  modale.remove();

  // Recharger les musiques
  profilData.musiques = [...(profilData.musiques || []), musique];
  afficherMusiques(profilData.musiques);

  // Mettre à jour les stats
  document.querySelector("#stats span:nth-child(1)").innerHTML = `<strong>${profilData.musiques.length}</strong> musiques`;
}

// --- MODIFIER PROFIL ---
async function modifierProfil(modale) {
  const pseudo = document.getElementById("input-pseudo").value.trim();
  const bio = document.getElementById("input-bio").value.trim();
  const photoUrl = document.getElementById("input-photo-url").value.trim();
  const photoFichier = document.getElementById("input-photo-fichier").files[0];
  const gradient = document.getElementById("input-gradient").value.trim();

  const updates = { pseudo, bio, theme: { gradient } };

  if (photoFichier) {
    const storageRef = ref(storage, `photos/${currentUser.uid}`);
    await uploadBytes(storageRef, photoFichier);
    updates.photoURL = await getDownloadURL(storageRef);
  } else if (photoUrl) {
    updates.photoURL = photoUrl;
  }

  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, updates);

  modale.remove();
  window.location.reload();
}

// --- LIKER ---
async function likerProfil(uid) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    likes: arrayUnion(currentUser.uid)
  });
  alert("Profil liké ! 👍");
}

// --- HELPERS ---
function extraireYoutubeId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function setOnglet(nom) {
  ongletActuel = nom;
  document.querySelectorAll("#onglets button").forEach(b => b.classList.remove("onglet-actif"));
  document.getElementById(`btn-${nom}`).classList.add("onglet-actif");
}

// Navigation barre gauche
document.getElementById("accueil").addEventListener("click", () => window.location.href = "index.html");
document.getElementById("profil").addEventListener("click", () => {
  if (currentUser) window.location.href = `profil.html?uid=${currentUser.uid}`;
});
document.getElementById("musique-fond").addEventListener("click", () => ouvrirModale("musique"));
document.getElementById("personnalisation").addEventListener("click", () => ouvrirModale("modifier"));
