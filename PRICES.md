# Mise à jour des prix — procédure de référence

**Commande** : « prix <série> » (ex. « prix Heaven Scroll »), « prix <wave> » (ex. « prix T4W6 », sets chinois, id `cn-…` dans `data/sets.json`) ou « prix tout » (toutes les séries et waves, une à la fois). À réception : suivre ce fichier **sans poser de question**.

| Série | id | code | requête large |
|---|---|---|---|
| Heaven Scroll | heaven-scroll | NRSA01 | Kayou Naruto Heaven Scroll |
| Chapter Jin S2 | chapter-jin-2 | NRSA02 | Kayou Naruto Chapter Jin |
| Chapter Jin S3 | chapter-jin-3 | NRSA03 | Kayou Naruto Chapter Jin |
| Chapter Jin S4 | chapter-jin-4 | NRSA04 | Kayou Naruto Chapter Jin |
| Earth Scroll S1 | earth-scroll-1 | NRI01 | Kayou Naruto Earth Scroll |
| Earth Scroll S2 | earth-scroll-2 | NREA02 | Kayou Naruto Earth Scroll |
| Earth Scroll S3 | earth-scroll-3 | NREA03 | Kayou Naruto Earth Scroll |
| Ninja Age | ninja-age | NRCCNA | Kayou Naruto Ninja Age |

**Périmètre** : séries internationales : cartes de `data/watchlist.json` (raretés au-dessus de UR). Sets chinois : watchlist générée depuis le fichier du set par `tools/prices.py` (raretés au-dessus de UR dans l'ordre du fichier, sans HR/PTR garanties ; set sans UR : au-dessus de SSR, sinon tout le set). Enregistrer aussi les UR et SSR trouvées au passage.

**Sets chinois** : requêtes larges « Kayou Naruto <wave> », « <wave> » et le préfixe propre à la wave (NRZxx, NRBxx). Les versions chinoises sont voulues : exclure les versions EN/FR (NRSA, NREA, NRI, NRCC, EN/FR, English, Heaven Scroll, Chapter Jin…), les annonces d'une autre wave, et un titre sans tag de wave ni préfixe propre (codes `NR-…` partagés entre waves). Ventes : ebay.fr, puis ebay.com, puis ebay.de (recherches larges sur chaque site). Clé dans `prices.json` : `<set-id>|<code>`.

**Navigateur** : Chrome de l'utilisateur via Claude in Chrome (connecté à eBay). Si Chrome n'est pas joignable : navigateur intégré de l'app (session eBay ouverte).

## A. Dernières ventes (fixent le prix)
1. 1 à 3 recherches larges sur ebay.fr : la requête large et le code de la série.
   `https://www.ebay.fr/sch/i.html?_nkw=<requête>&LH_Sold=1&LH_Complete=1&_ipg=240&LH_PrefLoc=2&imm=1&_pgn=<1..5>`
   (`imm=1` est indispensable : sans lui, eBay renvoie la page 1 quelle que soit `_pgn`). 5 pages max par recherche.
2. Carte avec moins de 2 ventes : une recherche par code (`<code> <nom>`) sur ebay.de puis ebay.com, mêmes paramètres ; conversion en € au taux BCE du jour.
3. Association annonce → carte : code dans le titre (sans suffixe L, séparateurs tolérés), sinon nom du perso + rareté s'il n'y a qu'une carte possible. Ignorer lots, proxys, customs, versions chinoises (chinese, T4Wx, NRZ, NRB), gradées (PSA, BGS, CGC, PCA, Collect Aura…), annonces « au choix », annonces d'une autre série, ambiguës.
4. Par carte : ventes des 90 derniers jours → médiane, nombre de ventes, 3 dernières ventes (date, prix, pays, lien). Moins de 2 ventes → `median: null`, note « pas assez de ventes ».

## B. Prix actuels (indicatif)
1 recherche large par série, annonces en cours en achat immédiat : `…&LH_BIN=1&_ipg=240&LH_PrefLoc=2&imm=1` (sans LH_Sold). Mêmes filtres et même association. Par carte : prix le plus bas et nombre d'annonces.

## C. Garde-fous
- Une page toutes les 15 à 20 s, une seule série à la fois.
- CAPTCHA, « Security Measure », vérification ou déconnexion eBay : **arrêter sans contourner**, enregistrer ce qui est fait, prévenir l'utilisateur.

## D. Sortie
`data/prices.json` → `cards.<code>` :
```json
{ "median": 45.0, "nbVentes": 23, "dernieresVentes": [{"date": "2026-11-15", "prix": 42.3, "pays": "France", "url": "https://www.ebay.fr/itm/…"}],
  "plusBasActuel": 39.9, "nbAnnonces": 12, "date": "2026-11-18", "source": "ebay.fr",
  "historique": [{"date": "2026-11-17", "median": 43.65}, {"date": "2026-11-18", "median": 45.0}] }
```
`historique` : ajouter la médiane du jour (remplacer l'entrée si même date). Mettre `updated` (date globale) et `series.<id>` (date de la dernière mise à jour de la série). Changer `V` dans `sw.js`, commit + push.

**Récap** : cartes chiffrées / sans ventes, top 5, plus grosses hausses et baisses vs le relevé précédent.

## Outils (dans le dépôt)
- `python3 tools/prices.py <set-id> --urls <ebay.fr|ebay.com|ebay.de> [S|A]` : liste des pages à relever (S = ventes, A = annonces en cours).
- `tools/ebay-extract.js` : extraction d'une page de résultats (`localStorage.kdg = <contenu>` ; tag `S…` = ventes, `A…` = annonces en cours). Les lignes s'accumulent dans `localStorage.kdw`.
- `tools/ebay-crawl.js` : dans un onglet du même site eBay **laissé au premier plan** (en arrière-plan, le navigateur ralentit fortement les minuteries), `eval(<contenu>)(<liste --urls>)` relève les pages une à une toutes les 15 à 20 s, saute les pages suivantes d'une requête épuisée, s'arrête sur CAPTCHA / vérification / déconnexion (`localStorage.kdst`, journal `localStorage.kdlog`).
- Export : renvoyer `'@@DATA@@'+JSON.stringify(localStorage.kdw)+'@@END@@'` complété d'espaces (> 100 ko) pour que la sortie soit enregistrée dans un fichier.
- `python3 tools/prices.py <série-id> <fichier exporté> <taux USD BCE>` : association, médianes, historique, écrit `data/prices.json` et affiche le récap.
