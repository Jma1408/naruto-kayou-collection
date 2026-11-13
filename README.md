# Kayou Dex – Naruto Heaven Scroll

PWA vanilla (aucun build) pour suivre sa collection Kayou Naruto. Données : `data/<set>.json` (un fichier par set, listé dans `data/sets.json`). Prix : `data/prices.json` généré chaque jour par GitHub Actions.

## 1. Mettre en ligne (GitHub Pages)
1. Crée un dépôt GitHub et pousse ces fichiers à la racine.
2. *Settings → Pages* → Source : **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. L'app est sur `https://<pseudo>.github.io/<depot>/`.

## 2. Clé eBay (gratuite)
1. Crée un compte sur https://developer.ebay.com → *Hi <nom> → Application Keysets*.
2. Crée un keyset **Production** (pas Sandbox). Si eBay demande la « Marketplace Account Deletion », choisis l'option d'exemption (l'app ne stocke aucune donnée utilisateur eBay).
3. Note **App ID (Client ID)** et **Cert ID (Client Secret)**.

## 3. Secrets GitHub
*Settings → Secrets and variables → Actions → New repository secret* :
- `EBAY_CLIENT_ID` = App ID
- `EBAY_CLIENT_SECRET` = Cert ID

Puis *Actions → Prix eBay → Run workflow* pour le premier calcul (ensuite tous les jours à 5 h UTC).
Si le push échoue : *Settings → Actions → General → Workflow permissions* → **Read and write**.

## Prix
Médiane des annonces **actives** à prix fixe sur eBay FR/DE/US, converties en EUR (taux BCE). Sont exclus : lots, proxys/customs, versions chinoises, scellé, et cartes gradées (PSA comptées à part). Une estimation, pas une cote.

## Ajouter un set
Créer `data/earth-scroll.json` (même format) et l'ajouter dans `data/sets.json`, puis l'ajouter à `SHELL` dans `sw.js` et changer `V` (version du cache).
