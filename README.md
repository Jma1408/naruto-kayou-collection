# Kayou Dex – Naruto

PWA vanilla (aucun build) pour suivre sa collection Kayou Naruto (international + Chine). Données : `data/<set>.json` (un fichier par set, listé dans `data/sets.json`), taux dans `data/odds.json`.

## Mise en ligne (GitHub Pages)
*Settings → Pages* → Source : **Deploy from a branch**, branche `main`, dossier `/ (root)`.

## Prix (manuels)
Chaque fiche carte a un champ « Mon prix » (€, daté) et deux boutons qui ouvrent les **ventes réussies** eBay FR / US pour le code de la carte. La valeur des classeurs = somme de mes prix × quantités. Les prix sont stockés avec la collection (IndexedDB) et inclus dans l'export JSON.

`archive/` contient l'ancien calcul automatique (script Node + workflow GitHub Actions, API eBay Browse), désactivé. Pour le réactiver avec une clé eBay : remettre `archive/prices.yml` dans `.github/workflows/`, `archive/update-prices.js` dans `scripts/`, `archive/package.json` à la racine, et ajouter les secrets `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`.

## Ajouter un set
Créer `data/<id>.json` (même format), l'ajouter dans `data/sets.json`, puis changer `V` (version du cache) dans `sw.js`.
