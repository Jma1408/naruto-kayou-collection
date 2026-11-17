# Règles de données (impératif)
- Ne jamais modifier : nom IndexedDB `kayoudex`, stores `col` / `photos`, format de clé `<setId>|<code EU>` (ex. `heaven-scroll|NRSA01-SSR-019`), ni l'URL du site (https://jma1408.github.io/naruto-kayou-collection/).
- Si le format des données change : incrémenter la version IDB, écrire une migration dans `onupgradeneeded` qui conserve la collection existante, garder `importJSON` compatible avec les anciens backups (`{app:'kayoudex', v:1, col, photos}`), et tester l'import d'un ancien backup v1 avant de publier.
- Changer `V` dans `sw.js` dès qu'un fichier de l'app change.
