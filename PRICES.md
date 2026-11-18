# Mise à jour des prix — par série (Claude Code, via Claude in Chrome)

Commandes : « prix <série> » (ex. « prix Heaven Scroll », « prix Chapter Jin S2 ») ou « prix tout » (les 8 séries internationales à la suite).

| Série | id | code |
|---|---|---|
| Heaven Scroll | heaven-scroll | NRSA01 |
| Chapter Jin S2 / S3 / S4 | chapter-jin-2 / -3 / -4 | NRSA02 / 03 / 04 |
| Earth Scroll S1 / S2 / S3 | earth-scroll-1 / -2 / -3 | NRI01 / NREA02 / NREA03 |
| Ninja Age | ninja-age | NRCCNA |

1. **Navigateur** : Chrome de l'utilisateur (Claude in Chrome), connecté à eBay.
2. **Recherches larges** (1 à 3) sur ebay.fr, ventes réussies, 240 résultats/page :
   `https://www.ebay.fr/sch/i.html?_nkw=<requête>&LH_Sold=1&LH_Complete=1&_ipg=240&_pgn=<page>`
   requêtes : « Kayou Naruto <nom de série> », « <code série> ». 5 pages max par recherche, **une page toutes les 15 à 20 s**.
3. **Association annonce → carte** : d'abord le code dans le titre (sans suffixe L, séparateurs tolérés : `NRSA01-SSR-019`, `NRSA01 SSR 019`…), sinon nom du perso + rareté, uniquement s'il n'y a qu'une carte possible. Ignorer lots, proxys/customs, gradées (PSA, BGS, CGC, PCA, Collect Aura…), versions chinoises, annonces ambiguës.
4. **Calcul** : ventes des 90 derniers jours, médiane en € par carte de la watchlist (`data/watchlist.json`) ; moins de 2 ventes → « pas assez de ventes » (`median: null`). Bonus : UR et SSR trouvées au passage aussi enregistrées.
5. **Vérification / CAPTCHA eBay** : s'arrêter immédiatement sans contourner, enregistrer ce qui est fait.
6. **Écrire** `data/prices.json` (`cards.<code> = {median, n, date, source, prev}`), changer `V` dans `sw.js`, commit + push.
7. **Récap** : cartes chiffrées / sans ventes, top 5, plus grosses variations (vs `prev`).

Dans l'app : prix eBay affiché « ventes eBay · date · N ventes » ; le prix manuel reste prioritaire s'il est plus récent.
