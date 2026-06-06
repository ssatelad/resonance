import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  addDoc,
  arrayUnion,
  collection as fsCollection,
  doc,
  getDoc,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const params = new URLSearchParams(window.location.search);
const requestedUid = params.get("uid");
const modalRoot = document.getElementById("app-modale");
const backgroundAudio = document.getElementById("audio-fond");

let currentUser = null;
let currentUserData = null;
let profilData = null;
let profileUid = null;
let currentTab = "posts";
let displayMode = localStorage.getItem("resonanceProfileDisplay") || "grille";
let collectionAudio = null;
let collectionProgressTimer = null;

const themes = [
  { name: "Studio nuit", colors: ["#101820", "#0d3b2e", "#2d6a4f"] },
  { name: "After doux", colors: ["#241734", "#5b2a86", "#f6d365"] },
  { name: "Ocean club", colors: ["#051923", "#006494", "#00a6fb"] },
  { name: "Rose cassette", colors: ["#2f0f1f", "#b51757", "#ffb3c6"] },
  { name: "Sunset tape", colors: ["#1b1b3a", "#6930c3", "#fcbf49"] },
  { name: "Minimal clair", colors: ["#eef2f3", "#8e9eab", "#29323c"] }
];

const fallbackCovers = [
  "linear-gradient(135deg, #5cff9d, #0d3b2e)",
  "linear-gradient(135deg, #f6d365, #5b2a86)",
  "linear-gradient(135deg, #00a6fb, #051923)"
];

applySavedTheme();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "connexion.html";
    return;
  }

  currentUser = user;
  profileUid = requestedUid || user.uid;
  await Promise.all([loadCurrentUser(), loadProfile()]);
  renderProfile();
  setDisplayMode(displayMode);
  renderTab();
});

document.addEventListener("click", async (event) => {
  const actionElement = event.target.closest("[data-action]");
  const id = event.target.id;
  const action = actionElement?.dataset.action;

  if (id === "accueil") window.location.href = "hub.html";
  if (id === "profil") window.location.href = `profil.html?uid=${currentUser.uid}`;
  if (id === "musique-fond") openMusicModal();
  if (id === "personnalisation") openThemeModal();
  if (id === "btn-grille") setDisplayMode("grille");
  if (id === "btn-liste") setDisplayMode("liste");

  if (id?.startsWith("tab-")) {
    const tab = id.replace("tab-", "");
    currentTab = tab === "postes" ? "posts" : tab;
    setActiveTab(id);
    renderTab();
  }

  if (action === "comments") openCommentsModal(actionElement.dataset.type, actionElement.dataset.id);
  if (action === "repost") repostMusic(actionElement.dataset.id);
  if (action === "quote") openQuoteModal(actionElement.dataset.id);
  if (action === "play-music") playMusicById(actionElement.dataset.id);
  if (action === "play-background") setBackgroundMusic(JSON.parse(decodeURIComponent(actionElement.dataset.music)));
  if (action === "open-collection") openCollectionPlayer(actionElement.dataset.id);
  if (action === "add-music") openAddMusicModal();
  if (action === "add-collection") openAddCollectionModal();
  if (action === "edit-profile") openEditProfileModal();
  if (action === "my-profile") window.location.href = `profil.html?uid=${currentUser.uid}`;
  if (action === "logout") logout();
});

async function loadCurrentUser() {
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  currentUserData = snap.exists() ? snap.data() : {};
}

async function loadProfile() {
  const snap = await getDoc(doc(db, "users", profileUid));
  if (!snap.exists()) {
    window.location.href = "hub.html";
    return;
  }
  profilData = snap.data();
  applyProfileTheme(profilData);
}

function renderProfile() {
  const musiques = getProfileMusics();
  const collections = profilData.collections || [];
  const reposts = profilData.reposts || [];

  document.getElementById("photo-profil").src = profilData.photoURL || "https://via.placeholder.com/160";
  document.getElementById("pseudo").textContent = profilData.pseudo || "pseudo";
  document.getElementById("bio").textContent = profilData.bio || "";
  document.querySelector("#stats span:nth-child(1)").innerHTML = `<strong>${musiques.length}</strong> musiques`;
  document.querySelector("#stats span:nth-child(2)").innerHTML = `<strong>${collections.length}</strong> collections`;
  document.querySelector("#stats span:nth-child(3)").innerHTML = `<strong>${reposts.length}</strong> reposts`;

  const actions = document.getElementById("actions-profil");
  actions.innerHTML = "";

  if (isOwner()) {
    actions.insertAdjacentHTML("beforeend", `
      <button class="ghost-btn" data-action="edit-profile">Modifier le profil</button>
      <button class="primary-btn" data-action="add-music">Ajouter une musique</button>
      <button class="ghost-btn" data-action="add-collection">Nouvelle collection</button>
      <button class="ghost-btn" data-action="logout">Deconnexion</button>
    `);
  } else {
    actions.insertAdjacentHTML("beforeend", `
      <button class="ghost-btn" data-action="my-profile">Voir mon profil</button>
    `);
  }
}

function setActiveTab(id) {
  document.querySelectorAll("#onglets button").forEach((button) => button.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function renderTab() {
  const zone = document.getElementById("zone-musiques");
  zone.innerHTML = "";
  renderTabActions();
  setDisplayMode(displayMode);

  if (currentTab === "posts") renderPosts(zone);
  if (currentTab === "collections") renderCollections(zone);
  if (currentTab === "identifications") renderIdentifications(zone);
  if (currentTab === "reposts") renderReposts(zone);
}

function renderTabActions() {
  const target = document.getElementById("actions-onglet");
  if (!target) return;

  target.innerHTML = "";
  if (!isOwner()) return;

  if (currentTab === "posts") {
    target.innerHTML = `<button class="primary-btn" data-action="add-music">Ajouter une musique</button>`;
  }

  if (currentTab === "collections") {
    target.innerHTML = `<button class="primary-btn" data-action="add-collection">Ajouter une collection</button>`;
  }
}

function setDisplayMode(mode) {
  displayMode = mode === "liste" ? "liste" : "grille";
  localStorage.setItem("resonanceProfileDisplay", displayMode);

  const zone = document.getElementById("zone-musiques");
  if (zone) {
    zone.classList.toggle("liste", displayMode === "liste");
    zone.classList.toggle("grille", displayMode === "grille");
  }

  document.getElementById("btn-grille")?.classList.toggle("actif", displayMode === "grille");
  document.getElementById("btn-liste")?.classList.toggle("actif", displayMode === "liste");
}

function renderPosts(zone) {
  const musiques = getProfileMusics();

  if (!musiques.length) {
    zone.innerHTML = `<p class="empty-state">Aucune musique pour le moment.</p>`;
    return;
  }

  musiques.forEach((music) => {
    zone.insertAdjacentHTML("beforeend", `
      <article class="post-card" data-action="play-music" data-id="${escapeAttr(music.id)}" title="Cliquer pour ecouter">
        <div class="vinyl-shell">
          <div class="vinyl-disc" style="${vinylStyle(music)}"></div>
        </div>
        <div class="post-body">
          <h3 class="card-title">${escapeHTML(music.title)}</h3>
          <p class="card-subtitle">${escapeHTML(music.artist)}</p>
          <p class="card-meta">${escapeHTML(music.sourceName)}</p>
          <span class="play-chip">Ecouter</span>
          <div class="post-actions">
            <button data-action="comments" data-type="music" data-id="${escapeAttr(music.id)}">Commentaires</button>
            <button data-action="repost" data-id="${escapeAttr(music.id)}">Repost</button>
            <button data-action="quote" data-id="${escapeAttr(music.id)}">Citer</button>
          </div>
        </div>
      </article>
    `);
  });
}

function renderCollections(zone) {
  const collections = profilData.collections || [];

  if (!collections.length) {
    zone.innerHTML = `<p class="empty-state">Aucune collection pour le moment.${isOwner() ? " Utilise le bouton Ajouter une collection pour commencer." : ""}</p>`;
    return;
  }

  collections.forEach((collectionItem, index) => {
    const id = getCollectionId(collectionItem, index);
    const covers = getCollectionCovers(collectionItem);
    zone.insertAdjacentHTML("beforeend", `
      <article class="collection-card" data-action="open-collection" data-id="${escapeAttr(id)}">
        <div class="collection-stack">
          ${covers.map((cover) => `<div class="collection-cover" style="${coverStyle(cover)}"></div>`).join("")}
        </div>
        <div class="post-body">
          <h3 class="card-title">${escapeHTML(collectionItem.nom || collectionItem.name || "Collection")}</h3>
          <p class="card-subtitle">${(collectionItem.items || []).length} musiques</p>
          <span class="play-chip">Ouvrir</span>
        </div>
      </article>
    `);
  });
}

function renderIdentifications(zone) {
  const tags = profilData.identifications || [];

  if (!tags.length) {
    zone.innerHTML = `<p class="empty-state">Aucune identification pour le moment.</p>`;
    return;
  }

  tags.forEach((tag) => {
    const music = normalizeMusic(tag);
    zone.insertAdjacentHTML("beforeend", `
      <article class="post-card">
        <div class="vinyl-shell">
          <div class="vinyl-disc" style="${vinylStyle(music)}"></div>
        </div>
        <h3 class="card-title">${escapeHTML(music.title)}</h3>
        <p class="card-subtitle">Identifie par ${escapeHTML(tag.by || "un ami")}</p>
      </article>
    `);
  });
}

function renderReposts(zone) {
  const reposts = profilData.reposts || [];

  if (!reposts.length) {
    zone.innerHTML = `<p class="empty-state">Aucun repost pour le moment.</p>`;
    return;
  }

  reposts.forEach((repost) => {
    zone.insertAdjacentHTML("beforeend", `
      <article class="repost-card">
        ${repost.quote ? `<div class="quote-box">${escapeHTML(repost.quote)}</div>` : ""}
        <div class="repost-source">
          <img src="${escapeAttr(repost.thumbnail || "https://via.placeholder.com/120")}" alt="">
          <div>
            <h3 class="card-title">${escapeHTML(repost.title || "Musique repostee")}</h3>
            <p class="card-subtitle">${escapeHTML(repost.artist || "Artiste inconnu")}</p>
            <p class="card-meta">Depuis ${escapeHTML(repost.originalProfileName || "un profil")}</p>
          </div>
        </div>
      </article>
    `);
  });
}

function playMusicById(musicId) {
  const music = findMusic(musicId);
  if (!music) return;
  playMusic(music);
}

function playMusic(music) {
  const oldPlayer = document.getElementById("mini-player");
  if (oldPlayer) oldPlayer.remove();

  const player = document.createElement("div");
  player.id = "mini-player";

  if (music.type === "youtube" || music.videoId) {
    const videoId = music.videoId || getYoutubeId(music.url);
    if (!videoId) {
      showToast("Lien YouTube invalide.");
      return;
    }

    player.innerHTML = `
      <div id="player-header">
        <span>${escapeHTML(music.title)}</span>
        <button id="fermer-player" type="button">x</button>
      </div>
      <iframe height="210"
        src="https://www.youtube.com/embed/${escapeAttr(videoId)}?autoplay=1"
        frameborder="0"
        allow="autoplay; encrypted-media"
        allowfullscreen></iframe>
    `;
  } else if (music.audioUrl) {
    player.innerHTML = `
      <div id="player-header">
        <span>${escapeHTML(music.title)}</span>
        <button id="fermer-player" type="button">x</button>
      </div>
      <audio controls autoplay src="${escapeAttr(music.audioUrl)}"></audio>
    `;
  } else {
    showToast("Cette musique n'a pas encore de lien audio lisible.");
    return;
  }

  document.body.appendChild(player);
  document.getElementById("fermer-player").addEventListener("click", () => player.remove());
}

async function openCommentsModal(type, targetId) {
  const comments = await loadComments(type, targetId);
  const targetMusic = findMusic(targetId);

  openModal(`
    <section class="modal-panel compact">
      <div class="modal-head">
        <h2>Commentaires</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="modal-body">
        <p class="card-subtitle">${escapeHTML(targetMusic?.title || "Publication")}</p>
        <div class="comment-list" id="comment-list">
          ${comments.length ? comments.map(renderComment).join("") : `<p class="empty-state">Aucun commentaire pour le moment.</p>`}
        </div>
        <form id="comment-form">
          <div class="field">
            <label for="comment-text">Ajouter un commentaire</label>
            <textarea id="comment-text" maxlength="400" placeholder="Ecris ton avis..."></textarea>
          </div>
          <button class="primary-btn" type="submit">Publier</button>
        </form>
      </div>
    </section>
  `);

  document.getElementById("comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = document.getElementById("comment-text").value.trim();
    if (!text) return;

    await addDoc(fsCollection(db, "comments"), {
      targetProfileId: profileUid,
      targetType: type,
      targetId,
      authorId: currentUser.uid,
      authorName: currentUserData.pseudo || currentUser.displayName || "Anonyme",
      text,
      createdAt: Date.now()
    });

    openCommentsModal(type, targetId);
  });
}

async function loadComments(type, targetId) {
  const snapshot = await getDocs(fsCollection(db, "comments"));
  const comments = [];
  snapshot.forEach((docSnap) => {
    const comment = docSnap.data();
    if (
      comment.targetProfileId === profileUid &&
      comment.targetType === type &&
      comment.targetId === targetId
    ) {
      comments.push(comment);
    }
  });
  return comments.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function renderComment(comment) {
  return `
    <div class="comment-item">
      <strong>${escapeHTML(comment.authorName || "Anonyme")}</strong>
      <p>${escapeHTML(comment.text || "")}</p>
    </div>
  `;
}

async function repostMusic(musicId, quote = "") {
  const music = findMusic(musicId);
  if (!music) return;

  const repost = {
    id: `${music.id}-${Date.now()}`,
    originalProfileId: profileUid,
    originalProfileName: profilData.pseudo || "Profil",
    title: music.title,
    artist: music.artist,
    thumbnail: music.thumbnail,
    audioUrl: music.audioUrl,
    quote,
    createdAt: Date.now()
  };

  await updateDoc(doc(db, "users", currentUser.uid), {
    reposts: arrayUnion(repost)
  });

  await loadCurrentUser();
  if (currentUser.uid === profileUid) {
    await loadProfile();
    renderProfile();
    renderTab();
  }

  showToast(quote ? "Citation ajoutee a ton profil." : "Repost ajoute a ton profil.");
  closeModal();
}

function openQuoteModal(musicId) {
  const music = findMusic(musicId);
  if (!music) return;

  openModal(`
    <section class="modal-panel compact">
      <div class="modal-head">
        <h2>Citer cette musique</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="modal-body">
        <p class="card-title">${escapeHTML(music.title)}</p>
        <p class="card-subtitle">${escapeHTML(music.artist)}</p>
        <form id="quote-form">
          <div class="field">
            <label for="quote-text">Ta citation</label>
            <textarea id="quote-text" maxlength="280" placeholder="Ajoute ton commentaire comme sur Twitter..."></textarea>
          </div>
          <button class="primary-btn" type="submit">Citer sur mon profil</button>
        </form>
      </div>
    </section>
  `);

  document.getElementById("quote-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const quote = document.getElementById("quote-text").value.trim();
    if (!quote) return;
    await repostMusic(musicId, quote);
  });
}

function openCollectionPlayer(collectionId) {
  const collectionIndex = (profilData.collections || []).findIndex((item, index) => getCollectionId(item, index) === collectionId);
  const collectionItem = (profilData.collections || [])[collectionIndex];
  if (!collectionItem) return;

  const items = (collectionItem.items || []).map((music, index) => normalizeMusic(music, index));
  let activeIndex = 0;

  openModal(`
    <section class="modal-panel">
      <div class="modal-head">
        <h2>${escapeHTML(collectionItem.nom || collectionItem.name || "Collection")}</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="collection-player" id="collection-player">
        <div class="coverflow" id="coverflow"></div>
        <div class="player-box">
          <h3 class="player-title" id="player-title">${items.length ? escapeHTML(items[0].title) : "Collection vide"}</h3>
          <p class="player-artist" id="player-artist">${items.length ? escapeHTML(items[0].artist) : "Ajoute un son pour lancer le player"}</p>
          <input class="progress" id="collection-progress" type="range" min="0" value="0">
          <div class="player-controls">
            <button class="round-btn" id="collection-prev"><<</button>
            <button class="round-btn play" id="collection-play">Play</button>
            <button class="round-btn" id="collection-next">>></button>
          </div>
          ${isOwner() ? `<div class="modal-actions"><button class="primary-btn" id="add-to-collection">Ajouter un son a cette collection</button></div>` : ""}
        </div>
      </div>
    </section>
  `);

  collectionAudio = new Audio();
  renderCoverflow(items, activeIndex);
  updateCollectionTrack(items, activeIndex, false);

  document.getElementById("collection-prev").addEventListener("click", () => {
    if (!items.length) return;
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    renderCoverflow(items, activeIndex);
    updateCollectionTrack(items, activeIndex, true);
  });

  document.getElementById("collection-next").addEventListener("click", () => {
    if (!items.length) return;
    activeIndex = (activeIndex + 1) % items.length;
    renderCoverflow(items, activeIndex);
    updateCollectionTrack(items, activeIndex, true);
  });

  document.getElementById("collection-play").addEventListener("click", () => {
    if (!items.length) return;
    if (items[activeIndex].type === "youtube" || items[activeIndex].videoId) {
      playMusic(items[activeIndex]);
      return;
    }
    if (!items[activeIndex].audioUrl) {
      showToast("Cette musique n'a pas de lien audio lisible.");
      return;
    }
    if (collectionAudio.paused) playCollectionAudio();
    else pauseCollectionAudio();
  });

  document.getElementById("collection-progress").addEventListener("input", (event) => {
    if (collectionAudio) collectionAudio.currentTime = Number(event.target.value);
  });

  document.getElementById("coverflow").addEventListener("click", (event) => {
    const slide = event.target.closest(".cover-slide");
    if (!slide) return;
    activeIndex = Number(slide.dataset.index);
    renderCoverflow(items, activeIndex);
    updateCollectionTrack(items, activeIndex, true);
  });

  const addButton = document.getElementById("add-to-collection");
  if (addButton) {
    addButton.addEventListener("click", () => openAddMusicToCollectionModal(collectionIndex));
  }
}

function renderCoverflow(items, activeIndex) {
  const coverflow = document.getElementById("coverflow");
  if (!coverflow) return;

  if (!items.length) {
    coverflow.innerHTML = `<p class="empty-state">Cette collection est vide.</p>`;
    return;
  }

  coverflow.innerHTML = items.map((item, index) => {
    const offset = index - activeIndex;
    const clamped = Math.max(-3, Math.min(3, offset));
    const scale = index === activeIndex ? 1 : 0.78;
    const opacity = Math.abs(offset) > 3 ? 0 : index === activeIndex ? 1 : 0.62;
    return `
      <button class="cover-slide ${index === activeIndex ? "is-active" : ""}" data-index="${index}" style="--offset:${clamped};--scale:${scale};--opacity:${opacity};">
        <img src="${escapeAttr(item.thumbnail || "https://via.placeholder.com/320")}" alt="">
      </button>
    `;
  }).join("");
}

function updateCollectionTrack(items, activeIndex, autoplay) {
  const track = items[activeIndex];
  const title = document.getElementById("player-title");
  const artist = document.getElementById("player-artist");
  const progress = document.getElementById("collection-progress");

  if (!track || !collectionAudio) return;

  title.textContent = track.title;
  artist.textContent = track.artist;
  collectionAudio.src = track.audioUrl || "";
  progress.value = 0;
  progress.disabled = !track.audioUrl;

  collectionAudio.onloadedmetadata = () => {
    progress.max = collectionAudio.duration || 0;
  };

  collectionAudio.onended = () => {
    document.getElementById("collection-next")?.click();
  };

  if (autoplay && (track.type === "youtube" || track.videoId)) playMusic(track);
  else if (autoplay && track.audioUrl) playCollectionAudio();
  else pauseCollectionAudio();
}

function playCollectionAudio() {
  collectionAudio.play().then(() => {
    document.getElementById("collection-play").textContent = "Pause";
    trackCollectionProgress();
  }).catch(() => showToast("Le navigateur demande un clic avant de lancer l'audio."));
}

function pauseCollectionAudio() {
  if (collectionAudio) collectionAudio.pause();
  const button = document.getElementById("collection-play");
  if (button) button.textContent = "Play";
  if (collectionProgressTimer) clearInterval(collectionProgressTimer);
}

function trackCollectionProgress() {
  if (collectionProgressTimer) clearInterval(collectionProgressTimer);
  collectionProgressTimer = setInterval(() => {
    const progress = document.getElementById("collection-progress");
    if (progress && collectionAudio) progress.value = collectionAudio.currentTime || 0;
  }, 300);
}

function openAddMusicToCollectionModal(collectionIndex) {
  openMusicForm("Ajouter a la collection", async (music) => {
    const collections = [...(profilData.collections || [])];
    const selected = { ...collections[collectionIndex] };
    selected.items = [...(selected.items || []), music];
    collections[collectionIndex] = selected;

    await updateDoc(doc(db, "users", currentUser.uid), { collections });
    await loadProfile();
    renderProfile();
    renderTab();
    showToast("Musique ajoutee a la collection.");
    closeModal();
  });
}

function openEditProfileModal() {
  openModal(`
    <section class="modal-panel compact">
      <div class="modal-head">
        <h2>Modifier le profil</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="modal-body">
        <form id="profile-form">
          <div class="field">
            <label for="profile-pseudo">Pseudo</label>
            <input id="profile-pseudo" value="${escapeAttr(profilData.pseudo || "")}">
          </div>
          <div class="field">
            <label for="profile-bio">Bio</label>
            <textarea id="profile-bio">${escapeHTML(profilData.bio || "")}</textarea>
          </div>
          <div class="field">
            <label for="profile-photo-url">Photo de profil URL</label>
            <input id="profile-photo-url" placeholder="https://...">
          </div>
          <div class="field">
            <label for="profile-photo-file">Photo de profil fichier</label>
            <input id="profile-photo-file" type="file" accept="image/*">
          </div>
          <button class="primary-btn" type="submit">Enregistrer</button>
        </form>
      </div>
    </section>
  `);

  document.getElementById("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const updates = {
      pseudo: document.getElementById("profile-pseudo").value.trim() || "Sans pseudo",
      bio: document.getElementById("profile-bio").value.trim()
    };
    const photoUrl = document.getElementById("profile-photo-url").value.trim();
    const photoFile = document.getElementById("profile-photo-file").files[0];

    if (photoFile) {
      const storageRef = ref(storage, `photos/${currentUser.uid}`);
      await uploadBytes(storageRef, photoFile);
      updates.photoURL = await getDownloadURL(storageRef);
    } else if (photoUrl) {
      updates.photoURL = photoUrl;
    }

    await updateDoc(doc(db, "users", currentUser.uid), updates);
    await loadProfile();
    renderProfile();
    renderTab();
    closeModal();
  });
}

function openAddMusicModal() {
  openMusicForm("Ajouter une musique", async (music) => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      musiques: arrayUnion(music)
    });

    await loadProfile();
    renderProfile();
    renderTab();
    closeModal();
  });
}

function openMusicForm(title, onSubmit) {
  openModal(`
    <section class="modal-panel compact">
      <div class="modal-head">
        <h2>${escapeHTML(title)}</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="modal-body">
        <form id="music-form">
          <div class="field">
            <label for="music-youtube">Lien YouTube</label>
            <input id="music-youtube" placeholder="https://youtube.com/watch?v=...">
          </div>
          <div class="field">
            <label for="music-file">Fichier audio</label>
            <input id="music-file" type="file" accept="audio/*,video/mp4">
          </div>
          <div class="field">
            <label for="music-title">Titre</label>
            <input id="music-title" placeholder="Instant Crush">
          </div>
          <div class="field">
            <label for="music-artist">Artiste</label>
            <input id="music-artist" placeholder="Daft Punk">
          </div>
          <div class="field">
            <label for="music-cover">Image de couverture</label>
            <input id="music-cover" placeholder="https://...">
          </div>
          <div class="field">
            <label for="music-audio">Lien MP3 direct</label>
            <input id="music-audio" placeholder="https://...mp3">
          </div>
          <button class="primary-btn" type="submit">Enregistrer</button>
        </form>
      </div>
    </section>
  `);

  document.getElementById("music-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const youtubeUrl = document.getElementById("music-youtube").value.trim();
    const file = document.getElementById("music-file").files[0];
    const audioLink = document.getElementById("music-audio").value.trim();
    const titleValue = document.getElementById("music-title").value.trim();
    const artistValue = document.getElementById("music-artist").value.trim();
    const coverValue = document.getElementById("music-cover").value.trim();

    if (!youtubeUrl && !file && !audioLink) {
      showToast("Ajoute un lien YouTube, un fichier audio ou un lien MP3.");
      return;
    }

    const music = {
      id: `music-${Date.now()}`,
      titre: titleValue || "Musique sans titre",
      artiste: artistValue || "Artiste inconnu",
      thumbnail: coverValue,
      createdAt: Date.now()
    };

    if (youtubeUrl) {
      const videoId = getYoutubeId(youtubeUrl);
      if (!videoId) {
        showToast("Lien YouTube invalide.");
        return;
      }

      music.type = "youtube";
      music.url = youtubeUrl;
      music.videoId = videoId;
      music.thumbnail = coverValue || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      if (!titleValue) music.titre = "Musique YouTube";
    } else if (file) {
      const storageRef = ref(storage, `musiques/${currentUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      music.type = "fichier";
      music.source = await getDownloadURL(storageRef);
      music.thumbnail = coverValue || "https://via.placeholder.com/600/061a0d/2bff63?text=Music";
      if (!titleValue) music.titre = file.name.replace(/\.[^/.]+$/, "");
    } else {
      music.type = "fichier";
      music.source = audioLink;
      music.thumbnail = coverValue || "https://via.placeholder.com/600/061a0d/2bff63?text=Music";
    }

    await onSubmit(music);
  });
}

function openAddCollectionModal() {
  openModal(`
    <section class="modal-panel compact">
      <div class="modal-head">
        <h2>Nouvelle collection</h2>
        <button class="close-btn" data-close-modal>x</button>
      </div>
      <div class="modal-body">
        <form id="collection-form">
          <div class="field">
            <label for="collection-name">Nom</label>
            <input id="collection-name" required placeholder="Sons pour minuit">
          </div>
          <div class="field">
            <label for="collection-desc">Description</label>
            <textarea id="collection-desc" placeholder="Ambiance, souvenirs, mood..."></textarea>
          </div>
          <button class="primary-btn" type="submit">Creer</button>
        </form>
      </div>
    </section>
  `);

  document.getElementById("collection-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const collectionItem = {
      id: `collection-${Date.now()}`,
      nom: document.getElementById("collection-name").value.trim(),
      description: document.getElementById("collection-desc").value.trim(),
      items: [],
      createdAt: Date.now()
    };

    await updateDoc(doc(db, "users", currentUser.uid), {
      collections: arrayUnion(collectionItem)
    });

    await loadProfile();
    renderProfile();
    currentTab = "collections";
    setActiveTab("tab-collections");
    renderTab();
    closeModal();
  });
}

async function openMusicModal() {
  const snapshot = await getDocs(fsCollection(db, "users"));
  const profiles = [];
  snapshot.forEach((docSnap) => profiles.push({ id: docSnap.id, ...docSnap.data() }));

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
            ${profiles.map((profile) => `<option value="${escapeAttr(profile.id)}">${escapeHTML(profile.pseudo || "Profil")}</option>`).join("")}
          </select>
        </div>
        <div class="music-list" id="background-music-list"></div>
      </div>
    </section>
  `);

  const select = document.getElementById("profile-select");
  const renderList = () => {
    const profile = profiles.find((item) => item.id === select.value);
    const musics = (profile?.musiques || []).map((music, index) => normalizeMusic(music, index));
    const list = document.getElementById("background-music-list");

    if (!musics.length) {
      list.innerHTML = `<p class="empty-state">Ce profil n'a pas encore ajoute de musique.</p>`;
      return;
    }

    list.innerHTML = musics.map((music) => `
      <div class="music-row">
        <img src="${escapeAttr(music.thumbnail || "https://via.placeholder.com/120")}" alt="">
        <div>
          <h3 class="card-title">${escapeHTML(music.title)}</h3>
          <p class="card-subtitle">${escapeHTML(music.artist)}</p>
        </div>
        <button class="primary-btn" data-action="play-background" data-music="${encodeURIComponent(JSON.stringify(music))}">Choisir</button>
      </div>
    `).join("");
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
    <section class="modal-panel compact">
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
          <label>Créer un dégradé</label>
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

function applySavedTheme() {
  const saved = localStorage.getItem("resonanceTheme");
  if (saved) applyTheme(JSON.parse(saved), false);

  const savedMusic = localStorage.getItem("resonanceBackgroundMusic");
  if (savedMusic) {
    const startOnClick = () => {
      setBackgroundMusic(JSON.parse(savedMusic));
      document.removeEventListener("click", startOnClick);
    };
    document.addEventListener("click", startOnClick, { once: true });
  }
}

function applyProfileTheme(data) {
  if (data?.theme?.colors?.length === 3) {
    applyTheme(data.theme.colors, false);
    return;
  }

  if (data?.theme?.gradient) {
    const colors = extractThemeColors(data.theme.gradient);
    if (colors) applyTheme(colors, false);
  }
}

function applyTheme(colors, persist) {
  document.documentElement.style.setProperty("--bg-a", colors[0]);
  document.documentElement.style.setProperty("--bg-b", colors[1]);
  document.documentElement.style.setProperty("--bg-c", colors[2]);
  if (persist) localStorage.setItem("resonanceTheme", JSON.stringify(colors));
  if (persist && currentUser) {
    updateDoc(doc(db, "users", currentUser.uid), {
      theme: { colors, gradient: `140deg, ${colors.join(", ")}` }
    }).catch(() => {});
  }
}

function extractThemeColors(gradient = "") {
  const matches = String(gradient).match(/#[0-9a-fA-F]{3,8}/g);
  if (!matches || matches.length < 2) return null;
  return [matches[0], matches[1], matches[2] || matches[1]];
}

function openModal(content) {
  pauseCollectionAudio();
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
  pauseCollectionAudio();
  if (collectionAudio) {
    collectionAudio.pause();
    collectionAudio = null;
  }
  modalRoot.className = "modale-cachee";
  modalRoot.setAttribute("aria-hidden", "true");
  modalRoot.innerHTML = "";
  modalRoot.removeEventListener("click", closeOnBackdrop);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "background-player";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

async function logout() {
  await signOut(auth);
  window.location.href = "connexion.html";
}

function getProfileMusics() {
  return (profilData.musiques || []).map((music, index) => normalizeMusic(music, index));
}

function normalizeMusic(music, index = 0) {
  const title = music.titre || music.title || music.nom || "Titre inconnu";
  const artist = music.artiste || music.artist || music.name || "Artiste inconnu";
  const url = music.url || music.lien || music.link || "";
  const audioUrl = music.source || music.audioUrl || music.audioURL || (music.type === "youtube" ? "" : url);
  const thumbnail = music.thumbnail || music.cover || music.image || "";

  return {
    ...music,
    id: music.id || slug(`${title}-${artist}-${index}`),
    title,
    artist,
    url,
    audioUrl,
    thumbnail,
    type: music.type || (isYoutubeUrl(url) ? "youtube" : "fichier"),
    videoId: music.videoId || getYoutubeId(url),
    sourceName: music.sourceName || music.platform || (isYoutubeUrl(url) ? "YouTube" : "Musique")
  };
}

function findMusic(musicId) {
  return getProfileMusics().find((music) => music.id === musicId);
}

function getCollectionId(collectionItem, index) {
  return collectionItem.id || slug(`${collectionItem.nom || collectionItem.name || "collection"}-${index}`);
}

function getCollectionCovers(collectionItem) {
  const items = (collectionItem.items || []).map((music, index) => normalizeMusic(music, index));
  const covers = items.map((item) => item.thumbnail).filter(Boolean).slice(0, 3);
  while (covers.length < 3) covers.push(fallbackCovers[covers.length]);
  return covers;
}

function coverStyle(cover) {
  if (cover.startsWith("linear-gradient")) return `background: ${cover};`;
  return `background-image: url('${escapeAttr(cover || "https://via.placeholder.com/320")}');`;
}

function vinylStyle(music) {
  const cover = music.thumbnail ? `url('${escapeAttr(music.thumbnail)}')` : "none";
  const color = colorFromString(music.title);
  return `--thumb: ${cover}; --cover: ${color};`;
}

function colorFromString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 78%, 58%)`;
}

function getYoutubeId(url = "") {
  const match = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function isYoutubeUrl(url = "") {
  return Boolean(getYoutubeId(url));
}

function slug(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function isOwner() {
  return currentUser?.uid === profileUid;
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
