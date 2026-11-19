// Relevé automatique dans un onglet eBay déjà ouvert (même domaine que les URL) : une page toutes les 15 à 20 s.
// Prérequis : localStorage.kdg = contenu de tools/ebay-extract.js. Usage : eval(<ce fichier>)([[tag, url], …]) (sans await).
// Suivi : localStorage.kdst (run / done / CAPTCHA …) et localStorage.kdlog. Arrêt : localStorage.kdst = 'stop'.
async (jobs) => {
  const ex = eval(localStorage.kdg), box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px'; document.body.append(box);
  localStorage.kdst = 'run'; const short = new Set();
  for (const [tag, url] of jobs) {
    if (localStorage.kdst !== 'run') return;
    const q = tag.replace(/-p\d+$/, ''); if (short.has(q)) continue;
    let r, h;
    try { r = await fetch(url, { credentials: 'include' }); h = await r.text(); } catch (e) { localStorage.kdst = 'erreur ' + tag; return; }
    const doc = new DOMParser().parseFromString(h, 'text/html');
    if (/captcha|splashui|signin/i.test(r.url) || /Security Measure|Pardon Our Interruption|V[ée]rification|Verify/i.test(doc.title)) { localStorage.kdst = 'CAPTCHA ' + tag; return; }
    doc.querySelectorAll('img,script,style,link').forEach(n => n.remove());
    const li = [...doc.querySelectorAll('li.s-card, .srp-river-answer--REWRITE_START')], cut = li.findIndex(n => !n.matches('li.s-card')); // sans les résultats « moins de mots »
    box.replaceChildren(...(cut < 0 ? li : li.slice(0, cut)));
    const [cnt, n] = ex(tag, box);
    localStorage.kdlog = (localStorage.kdlog || '') + `${tag}\t${n}\t${cnt || ''}\n`;
    if (n < 200) short.add(q);
    await new Promise(z => setTimeout(z, 15000 + Math.random() * 5000));
  }
  box.remove(); localStorage.kdst = 'done';
}
