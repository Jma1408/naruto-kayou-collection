"""Calcule les prix d'une série à partir d'un export d'annonces eBay (voir PRICES.md).
Usage : python3 tools/prices.py <série-id> <export.txt|.json> [taux_usd]
L'export contient les lignes de tools/ebay-extract.js (tag \t date \t prix \t pays \t url \t titre) ;
tags commençant par 'S' = ventes réussies, 'A' = annonces en cours. Écrit data/prices.json et affiche le récap."""
import json, re, sys, statistics, datetime, collections
SID, EXPORT = sys.argv[1], sys.argv[2]
USD = float(sys.argv[3]) if len(sys.argv) > 3 else 1.10
TODAY = datetime.date.today(); LIM = TODAY - datetime.timedelta(days=90)
raw = open(EXPORT, encoding='utf-8').read()
if raw.lstrip().startswith('['):  # sortie sauvegardée d'un outil navigateur
    t = json.loads(raw)[0]['text']; t = json.JSONDecoder().raw_decode(t)[0] if t.startswith('"') else t
    raw = json.loads(t[t.index('@@DATA@@') + 8:t.index('@@END@@')])
M = {'jan': 1, 'janv': 1, 'févr': 2, 'feb': 2, 'mars': 3, 'mar': 3, 'mär': 3, 'avr': 4, 'apr': 4, 'mai': 5, 'may': 5, 'juin': 6, 'jun': 6, 'juil': 7, 'jul': 7, 'août': 8, 'aug': 8, 'sept': 9, 'sep': 9, 'oct': 10, 'okt': 10, 'nov': 11, 'déc': 12, 'dec': 12, 'dez': 12}
def pdate(s):
    m = re.match(r'(\d{1,2})\.?\s+([^\s.\d]+)\.?\s+(\d{4})', s) or None
    if m: return datetime.date(int(m.group(3)), M.get(m.group(2).lower()[:4]) or M.get(m.group(2).lower()[:3], 1), int(m.group(1)))
    m = re.match(r'([A-Za-z]{3})\w*\s+(\d{1,2}),\s+(\d{4})', s)
    return datetime.date(int(m.group(3)), M.get(m.group(1).lower(), 1), int(m.group(2))) if m else None
def pprice(s):
    if not s: return None
    if '$' in s: return float(re.sub(r'[^\d.]', '', s)) / USD
    return float(re.sub(r'[\s. ]', '', s).replace(',', '.'))
rows = {}
for l in raw.split('\n'):
    p = l.split('\t')
    if len(p) >= 6: rows[(p[0][0], p[4] or p[5])] = p
d = json.load(open(f'data/{SID}.json')); pre = d['codePrefix']
OTHER = re.compile(r'NRSA0\d|NREA0\d|NRI0\d|NRCC\w*', re.I)
BAD = re.compile(r'\blots?\b|bundle|\bx\s?[2-9]\b|\b[2-9]\s?x\b|proxy|custom|fan.?made|reprint|\bpsa\b|bgs|cgc|\bpca\b|collect ?aura|grad[ée]|graded|chin|t\dw\d|nrz\d|nrb\d|\bcn\b|set of|complete|playset|au choix|choose|pick|à choisir|liste|booster|display|scell|sealed', re.I)
SERIE = {'heaven-scroll': 'HEAVEN', 'chapter-jin-2': 'JIN', 'chapter-jin-3': 'JIN', 'chapter-jin-4': 'JIN', 'earth-scroll-1': 'EARTH', 'earth-scroll-2': 'EARTH', 'earth-scroll-3': 'EARTH', 'ninja-age': 'NINJA AGE'}[SID]
rars = sorted({c['rarity'] for c in d['cards']}, key=len, reverse=True)
RRE = re.compile(r'(?<![A-Z])(' + '|'.join(re.escape(r) for r in rars) + r')[\s\-*_#.]*0*(\d{1,3})(?:L\d)?(?!\d)')
bycode = {(c['rarity'], int(re.search(r'(\d+)$', c['code']).group(1))): c for c in d['cards']}
words = lambda n: [w for w in re.split(r'\s+', n.upper()) if len(w) > 2]
stats = collections.Counter(); sales = collections.defaultdict(list); ads = collections.defaultdict(list)
for kind, date, price, pays, url, title in [[r[0][0]] + r[1:6] for r in rows.values()]:
    T = title.upper(); v = pprice(price)
    if v is None: stats['prix?'] += 1; continue
    if kind == 'S':
        dt = pdate(date)
        if not dt: stats['date?'] += 1; continue
        if dt < LIM: stats['>90 j'] += 1; continue
    if BAD.search(title): stats['exclu'] += 1; continue
    if {x.upper() for x in OTHER.findall(T)} - {pre}: stats['autre série'] += 1; continue
    if pre not in T and SERIE not in T: stats['hors série'] += 1; continue
    hits = {(r, int(n)) for r, n in RRE.findall(T) if (r, int(n)) in bycode}
    if len(hits) == 1: card = bycode[hits.pop()]; stats['par code'] += 1
    elif hits: stats['ambigu'] += 1; continue
    else:
        rr = [r for r in rars if re.search(r'(?<![A-Z])' + re.escape(r) + r'(?![A-Z])', T)]
        cand = [c for c in d['cards'] if rr and c['rarity'] == rr[0] and any(w in T for w in words(c['name']))]
        if len(cand) != 1: stats['non associé'] += 1; continue
        card = cand[0]; stats['par nom'] += 1
    if kind == 'S': sales[card['code']].append({'date': str(dt), 'prix': round(v, 2), 'pays': pays.strip() or 'France', 'url': url})
    else: ads[card['code']].append(v)
watch = [c['code'] for c in json.load(open('data/watchlist.json'))['cards'] if c['set'] == SID]
bonus = [c['code'] for c in d['cards'] if c['rarity'] in ('UR', 'SSR')]
pj = json.load(open('data/prices.json')); cards = pj.setdefault('cards', {})
upd = {}; host = sorted({re.sub(r'https?://(www\.)?([^/]+).*', r'\2', s['url']) for v in sales.values() for s in v}) or ['ebay.fr']
for code in watch + bonus:
    s = sorted(sales.get(code, []), key=lambda x: x['date'], reverse=True); a = ads.get(code, [])
    if code in bonus and not s and not a: continue
    old = cards.get(code, {}); hist = [h for h in old.get('historique', []) if h['date'] != str(TODAY)]
    med = round(statistics.median([x['prix'] for x in s]), 2) if len(s) >= 2 else None
    if med is not None: hist.append({'date': str(TODAY), 'median': med})
    e = {'median': med, 'nbVentes': len(s), 'dernieresVentes': s[:3], 'plusBasActuel': round(min(a), 2) if a else None, 'nbAnnonces': len(a),
         'date': str(TODAY), 'source': '+'.join(sorted({re.sub(r'https?://(www\.)?([^/]+).*', r'\2', x['url']) for x in s})) or 'ebay.fr', 'historique': hist[-24:]}
    if med is None: e['note'] = 'pas assez de ventes'
    cards[code] = e; upd[code] = e
pj['updated'] = str(TODAY); pj.setdefault('series', {})[SID] = str(TODAY)
json.dump(pj, open('data/prices.json', 'w'), ensure_ascii=False, indent=0)
names = {c['code']: c['name'] for c in d['cards']}
ok = [c for c in watch if upd[c]['median'] is not None]; low = [c for c in watch if upd[c]['median'] is None]
print('annonces', len(rows), dict(stats))
print(f'watchlist {len(watch)} : chiffrées {len(ok)} ; pas assez de ventes {len(low)} {low}')
print('bonus UR/SSR', sum(1 for c in bonus if c in upd and upd[c]['median'] is not None))
print('top5', [(c, names[c], upd[c]['median'], upd[c]['nbVentes']) for c in sorted(ok, key=lambda c: -upd[c]['median'])[:5]])
var = [(c, h[-2]['median'], h[-1]['median']) for c in ok if len(h := upd[c]['historique']) >= 2]
var.sort(key=lambda x: (x[2] - x[1]) / x[1])
print('baisses', var[:3]); print('hausses', var[-3:][::-1])
