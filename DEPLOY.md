# Resonance - deploiement Firebase

## Tester l'interface

```powershell
npm.cmd run serve:hosting
```

Ouvre ensuite :

```text
http://127.0.0.1:5000
```

Le script `npm.cmd run serve` lance aussi Firestore et Storage, mais il faut Java/JDK compatible sur la machine. Si Firestore Emulator refuse de demarrer, le deploiement Firebase reste possible.

## Deployer

```powershell
npm.cmd run deploy
```

Commandes separees si besoin :

```powershell
npm.cmd run hosting
npm.cmd run firestore
npm.cmd run storage
```

## Pages principales

- `public/index.html`
- `public/hub.html`
- `public/profil.html`
- `public/connexion.html`
- `public/creation.html`

## Fonctionnalites preparees

- hub des profils
- profil avec onglets postes, collections, identifications, reposts
- posts en disque vinyle avec rotation au survol
- commentaires Firestore
- repost et citation
- collections musicales avec lecteur coverflow
- ajout de musique et creation de collections
- modale musique de fond
- modale personnalisation avec themes et degrade custom
