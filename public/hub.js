import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection as fsCollection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const modalRoot = document.getElementById("app-modale");
const backgroundAudio = document.getElementById("audio-fond");
let allProfiles = [];

const themes = [
  { name: "Studio nuit", colors: ["#101820", "#0d3b2e", "#2d6a4f"] },
  { name: "After doux", colors: ["#241734", "#5b2a86", "#f6d365"] },
  { name: "Ocean club", colors: ["#051923", "#006494", "#00a6fb"] },
  { name: "Rose cassette", colors: ["#2f0f1f", "#b51757", "#ffb3c6"] },
  { name: "Sunset tape", colors: ["#1b1b3a", "#6930c3", "#fcbf49"] },
  { name: "Minimal clair", colors: ["#eef2f3", "#8e9eab", "#29323c"] }
];

applySavedTheme();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "connexion.html";
    return;
  }

  await loadProfiles();
  renderProfiles();

  document.getElementById("accueil").addEventListener("click", () => window.location.href = "hub.html");
  document.getElementById("profil").addEventListener("click", () => window.location.href = `profil.html?uid=${user.uid}`);
  document.getElementById("musique-fond").addEventListener("click", openMusicModal);
  document.getElementById("personnalisation").addEventListener("click", openThemeModal);
});

async function loadProfiles() {
  const snapshot = await getDocs(fsCollection(db, "users"));
  allProfiles = [];
  snapshot.forEach((docSnap) => {
    allProfiles.push({ id: docSnap.id, ...docSnap.data() });
  });
}

function renderProfiles() {
  const grille = document.getElementById("grille-amis");
  const carteAjouter = grille.querySelector(".carte-ajouter");
  grille.innerHTML = "";

  allProfiles.forEach((profil) => {
    const carte = document.createElement("div");
    carte.classList.add("carte-ami");

    carte.innerHTML = `
      <img class="ami-photo" src="${escapeAttr(profil.photoURL || "https://via.placeholder.com/80")}" alt="Photo de profil">
      <p class="ami-pseudo">${escapeHTML(profil.pseudo || "Profil")}</p>
      <p class="ami-bio">${escapeHTML(profil.bio || "Aucune bio.")}</p>
      <button class="btn-voir" data-uid="${escapeAttr(profil.id)}">Voir le profil</button>
    `;

    grille.appendChild(carte);
  });

  if (carteAjouter) grille.appendChild(carteAjouter);

  grille.addEventListener("click", (event) => {
    if (event.target.classList.contains("btn-voir")) {
      window.location.href = `profil.html?uid=${event.target.dataset.uid}`;
    }
  });
}

function openMusicModal() {
  openModal(`
    <section class="modal-panel">
      <div class="modal-head">
        <h2>Musique de fond</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="profile-select">Profils</label>
          <select id="profile-select">
            ${allProfiles.map((profile) => `<option value="${escapeAttr(profile.id)}">${escapeHTML(profile.pseudo || "Profil")}</option>`).join("")}
          </select>
        </div>
        <div class="music-list" id="background-music-list"></div>
      </div>
    </section>
  `);

  const select = document.getElementById("profile-select");
  const renderList = () => {
    const profile = allProfiles.find((item) => item.id === select.value);
    const musics = (profile?.musiques || []).map(normalizeMusic);
    const list = document.getElementById("background-music-list");

    if (!musics.length) {
      list.innerHTML = `<p>Ce profil n'a pas encore ajoute de musique.</p>`;
      return;
    }

    list.innerHTML = musics.map((music) => `
      <div class="music-row">
        <img src="${escapeAttr(music.thumbnail || "https://via.placeholder.com/120")}" alt="">
        <div>
          <h3>${escapeHTML(music.title)}</h3>
          <p>${escapeHTML(music.artist)}</p>
        </div>
        <button class="primary-btn" data-music="${encodeURIComponent(JSON.stringify(music))}">Choisir</button>
      </div>
    `).join("");

    list.querySelectorAll("[data-music]").forEach((button) => {
      button.addEventListener("click", () => setBackgroundMusic(JSON.parse(decodeURIComponent(button.dataset.music))));
    });
  };

  select.addEventListener("change", renderList);
  renderList();
}

function setBackgroundMusic(music) {
  if (!music.audioUrl) {
    showToast("Cette musique n'a pas encore de lien mp3 utilisable.");
    return;
  }

  backgroundAudio.src = music.audioUrl;
  backgroundAudio.volume = 0.45;
  backgroundAudio.play().catch(() => showToast("Clique une fois sur la page pour autoriser l'audio."));
  localStorage.setItem("resonanceBackgroundMusic", JSON.stringify(music));

  let player = document.querySelector(".background-player");
  if (!player) {
    player = document.createElement("div");
    player.className = "background-player";
    document.body.appendChild(player);
  }

  player.innerHTML = `
    <strong>${escapeHTML(music.title)}</strong>
    <p>${escapeHTML(music.artist)}</p>
    <div class="modal-actions">
      <button class="mini-btn" id="toggle-background-audio">Pause</button>
      <button class="mini-btn" id="stop-background-audio">Stop</button>
    </div>
  `;

  document.getElementById("toggle-background-audio").onclick = () => {
    if (backgroundAudio.paused) {
      backgroundAudio.play();
      document.getElementById("toggle-background-audio").textContent = "Pause";
    } else {
      backgroundAudio.pause();
      document.getElementById("toggle-background-audio").textContent = "Play";
    }
  };

  document.getElementById("stop-background-audio").onclick = () => {
    backgroundAudio.pause();
    backgroundAudio.removeAttribute("src");
    localStorage.removeItem("resonanceBackgroundMusic");
    player.remove();
  };

  closeModal();
}

function openThemeModal() {
  openModal(`
    <section class="modal-panel">
      <div class="modal-head">
        <h2>Personnalisation</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="modal-body">
        <div class="theme-grid">
          ${themes.map((theme, index) => `
            <button class="theme-card" data-theme-index="${index}" style="--preview: linear-gradient(140deg, ${theme.colors.join(", ")});">
              ${escapeHTML(theme.name)}
            </button>
          `).join("")}
        </div>
        <div class="field">
          <label>Creer un degrade</label>
          <div class="theme-builder">
            <input type="color" id="theme-a" value="#101820">
            <input type="color" id="theme-b" value="#0d3b2e">
            <input type="color" id="theme-c" value="#2d6a4f">
          </div>
        </div>
        <div class="modal-actions">
          <button class="primary-btn" id="apply-custom-theme">Appliquer</button>
          <button class="ghost-btn" id="reset-theme">Reinitialiser</button>
        </div>
      </div>
    </section>
  `);

  document.querySelectorAll("[data-theme-index]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(themes[Number(button.dataset.themeIndex)].colors, true));
  });

  document.getElementById("apply-custom-theme").addEventListener("click", () => {
    applyTheme([
      document.getElementById("theme-a").value,
      document.getElementById("theme-b").value,
      document.getElementById("theme-c").value
    ], true);
  });

  document.getElementById("reset-theme").addEventListener("click", () => {
    localStorage.removeItem("resonanceTheme");
    applyTheme(themes[0].colors, false);
  });
}

function openModal(content) {
  modalRoot.className = "modal-layer";
  modalRoot.setAttribute("aria-hidden", "false");
  modalRoot.innerHTML = content;
  modalRoot.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
  modalRoot.addEventListener("click", closeOnBackdrop);
}

function closeOnBackdrop(event) {
  if (event.target === modalRoot) closeModal();
}

function closeModal() {
  modalRoot.className = "modale-cachee";
  modalRoot.setAttribute("aria-hidden", "true");
  modalRoot.innerHTML = "";
  modalRoot.removeEventListener("click", closeOnBackdrop);
}

function applySavedTheme() {
  const saved = localStorage.getItem("resonanceTheme");
  if (saved) applyTheme(JSON.parse(saved), false);
}

function applyTheme(colors, persist) {
  document.documentElement.style.setProperty("--bg-a", colors[0]);
  document.documentElement.style.setProperty("--bg-b", colors[1]);
  document.documentElement.style.setProperty("--bg-c", colors[2]);
  if (persist) localStorage.setItem("resonanceTheme", JSON.stringify(colors));
}

function normalizeMusic(music, index = 0) {
  const title = music.titre || music.title || music.nom || "Titre inconnu";
  const artist = music.artiste || music.artist || music.name || "Artiste inconnu";
  const audioUrl = music.source || music.audioUrl || music.audioURL || music.url || "";

  return {
    ...music,
    id: music.id || `${title}-${artist}-${index}`,
    title,
    artist,
    audioUrl,
    thumbnail: music.thumbnail || music.cover || music.image || ""
  };
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "background-player";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHTML(value).replaceAll("`", "&#096;");
}
