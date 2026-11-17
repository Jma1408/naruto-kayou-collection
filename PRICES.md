# Mise à jour des prix (manuelle, par Claude Code via le navigateur)

Déclencheur : « mets à jour les prix ».

1. **Lot** : dans `data/watchlist.json`, prendre les 50 cartes dont le prix est absent de `data/prices.json` ou dont la `date` est la plus ancienne (ordre du fichier en cas d'égalité).
2. **Recherche** (navigateur intégré, une recherche toutes les 10 à 15 s) :
   - `https://www.ebay.fr/sch/i.html?_nkw=<code sans suffixe L> <nom>&LH_Sold=1&LH_Complete=1`
   - moins de 3 ventes retenues → compléter avec `ebay.com` puis `ebay.de` (même requête).
3. **Filtre** : ventes des 90 derniers jours ; exclure lots / bundles / « x2 », proxys / customs / fan-made / reprint, cartes gradées (PSA, BGS, CGC, PCA, Collect Aura…), versions chinoises (chinese, T4Wx, NRZ, NRB), le titre doit contenir le code (rareté + numéro).
4. **Calcul** : médiane en € (USD converti au taux BCE du jour), nombre de ventes, date du jour, source (`ebay.fr`, `ebay.fr+com`…).
5. **CAPTCHA / vérification eBay** : s'arrêter immédiatement, ne rien contourner, enregistrer ce qui est déjà fait.
6. **Écrire** `data/prices.json` (`{updated, cards: {code: {median, n, date, source, prev}}}`), changer `V` dans `sw.js`, commit + push.
7. **Récap** : cartes mises à jour, 5 plus chères, plus grosses hausses / baisses (vs `prev`), nombre restant sans prix.

Dans l'app : prix eBay affiché « ventes eBay · date · N ventes » ; le prix manuel de l'utilisateur reste prioritaire s'il est plus récent.
