// node scripts/update-prices.js  (Node 20+, env EBAY_CLIENT_ID / EBAY_CLIENT_SECRET)
// Médiane des annonces eBay ACTIVES (prix fixe) par carte, FR/DE/US, convertie en EUR.
import { readFileSync, writeFileSync } from 'node:fs';

const { EBAY_CLIENT_ID: ID, EBAY_CLIENT_SECRET: SECRET } = process.env;
if (!ID || !SECRET) { console.error('EBAY_CLIENT_ID / EBAY_CLIENT_SECRET manquants'); process.exit(1); }
const MARKETS = { FR: 'EBAY_FR', DE: 'EBAY_DE', US: 'EBAY_US' };
const EXCLUDE = /\b(lot|lots|bundle|set of|complete set|playset|x\s?\d+|\d+\s?x|choose|pick|au choix|wählen|auswahl|proxy|fake|replica|reprint|custom|fan\s?made|orica|unofficial|non officiel|sticker|sleeve|binder|sealed|scellé|chinese|chinois|t4w6|empty)\b/i;
const GRADED = /\b(psa|bgs|cgc|sgc|beckett|graded|gradée?|gradiert)\b/i;
const PSA = /\bpsa\s?(\d{1,2})\b/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return +(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2).toFixed(2); };

async function token() {
  const r = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${ID}:${SECRET}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope')
  });
  if (!r.ok) throw new Error('OAuth eBay: ' + r.status + ' ' + await r.text());
  return (await r.json()).access_token;
}
async function rates() { // BCE, EUR -> devise
  const x = await (await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml')).text();
  const o = { EUR: 1 }; for (const m of x.matchAll(/currency='(\w+)' rate='([\d.]+)'/g)) o[m[1]] = +m[2]; return o;
}
async function search(tk, mkt, q) {
  const u = 'https://api.ebay.com/buy/browse/v1/item_summary/search?limit=100&filter=' + encodeURIComponent('buyingOptions:{FIXED_PRICE}') + '&q=' + encodeURIComponent(q);
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + tk, 'X-EBAY-C-MARKETPLACE-ID': mkt } });
    if (r.status === 429) { await sleep(5000); continue; }
    if (!r.ok) { console.warn(mkt, q, r.status); return []; }
    return (await r.json()).itemSummaries || [];
  }
  return [];
}

const [tk, fx] = await Promise.all([token(), rates()]);
const sets = JSON.parse(readFileSync('data/sets.json', 'utf8')).sets.filter(s => s.status === 'ok' && s.file);
const out = { updated: new Date().toISOString(), source: 'eBay Browse API – annonces actives, médiane', markets: Object.values(MARKETS), cards: {} };

for (const s of sets) {
  const set = JSON.parse(readFileSync(s.file, 'utf8'));
  for (const c of set.cards) {
    const [, rar, num] = c.code.split('-'), n = +num;
    // le titre doit citer la rareté + le numéro (ex. "SSR-019", "SSR 19", "NRSA01-SSR-019L3")
    const must = new RegExp(`(?<![A-Z])${rar.replace(/[^A-Z]/gi, '.?')}[\\s\\-#]*0*${n}(L\\d)?\\b`, 'i');
    const raw = [], psa = [], markets = {};
    for (const [m, id] of Object.entries(MARKETS)) {
      const seen = new Set(), mp = [];
      for (const q of [c.code]) { // 1 requête/carte/marché : ~4 000 appels/jour, sous la limite eBay de 5 000
        for (const it of await search(tk, id, q)) {
          if (seen.has(it.itemId)) continue; seen.add(it.itemId);
          const t = it.title || '', p = it.price;
          if (!p || !must.test(t) || EXCLUDE.test(t) || !/naruto|kayou/i.test(t)) continue;
          const eur = +p.value / (fx[p.currency] || NaN);
          if (!isFinite(eur) || eur <= 0) continue;
          if (GRADED.test(t)) { if (PSA.test(t)) psa.push(eur); continue; }
          mp.push(eur);
        }
        await sleep(150);
      }
      if (mp.length) markets[m] = { median: median(mp), n: mp.length };
      raw.push(...mp);
    }
    out.cards[c.code] = { median: median(raw), n: raw.length, markets, psa: psa.length ? { median: median(psa), n: psa.length } : null };
    console.log(c.code, out.cards[c.code].median ?? '-', `(${raw.length})`);
  }
}
writeFileSync('data/prices.json', JSON.stringify(out));
