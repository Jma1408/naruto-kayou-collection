// À exécuter dans une page de résultats eBay (navigateur) : ajoute les annonces de la page à localStorage.kdw.
// Usage : eval(<ce fichier>)('<tag>')  — tag libre (ex. 'S-q1p2' ventes, 'A-p1' annonces en cours).
// Une ligne par annonce : tag \t date \t prix \t pays \t url \t titre
(tag) => {
  const rows = [];
  for (const li of document.querySelectorAll('li.s-card')) {
    const t = li.innerText;
    if (/Shop on eBay|Sponsoris/i.test(t.slice(0, 40))) continue;
    const a = li.querySelector('a[href*="/itm/"]'); if (!a) continue;
    const ti = (li.querySelector('.s-card__title') || li).innerText.replace(/La page s'ouvre.*|Opens in a new.*|Wird in neuem.*/s, '').replace(/\s+/g, ' ').trim();
    const d = (t.match(/(?:Vendu le|Verkauft am|Sold)\s+([^\n]+?\d{4})/) || [])[1] || '';
    const p = (t.match(/(\d[\d\s. ]*,\d{2})\s*EUR/) || t.match(/EUR\s*(\d[\d. ]*,\d{2})/) || t.match(/(\$\s?\d[\d,]*\.\d{2})/) || [])[1] || '';
    const pays = (t.match(/livraison de\s+([^\n]+)/i) || t.match(/(?:aus|from)\s+([A-Z][^\n]+)/) || [])[1] || '';
    rows.push([tag, d, p, pays.trim(), a.href.split('?')[0], ti].join('\t'));
  }
  localStorage.kdw = (localStorage.kdw || '') + rows.join('\n') + '\n';
  return [(document.querySelector('.srp-controls__count-heading') || {}).innerText, rows.length, /captcha|Security Measure|Verification/i.test(document.title + location.href) ? 'CAPTCHA' : 'ok'];
}
