"""Prix d'une série (FR/international) ou d'une wave chinoise à partir d'un export eBay (voir PRICES.md).
  python3 tools/prices.py <set-id> --urls <ebay.fr|ebay.com|ebay.de> [S|A]  → liste JSON [[tag, url], …] pour tools/ebay-crawl.js
  python3 tools/prices.py <set-id> <export.txt|.json> [taux_usd]           → écrit data/prices.json et affiche le récap
Lignes de l'export (tools/ebay-extract.js) : tag \t date \t prix \t pays \t url \t titre ; tag 'S…' = vente réussie, 'A…' = annonce en cours.
Clés de data/prices.json : code pour les séries internationales, '<set-id>|<code>' pour les sets chinois (codes répétés d'une wave à l'autre)."""
import json, re, sys, statistics, datetime, collections, urllib.parse
SID = sys.argv[1]
meta = next(m for m in json.load(open('data/sets.json'))['sets'] if m['id'] == SID)
d = json.load(open(meta['file'])); pre = d['codePrefix']; CN = meta['region'] == 'cn'
W = re.match(r'T(\d(?:\.5)?)W(\d)$', meta['title']) if CN else None
SERIE = {'heaven-scroll': 'HEAVEN', 'chapter-jin-2': 'JIN', 'chapter-jin-3': 'JIN', 'chapter-jin-4': 'JIN', 'earth-scroll-1': 'EARTH', 'earth-scroll-2': 'EARTH', 'earth-scroll-3': 'EARTH', 'ninja-age': 'NINJA AGE'}.get(SID)
distinct = re.fullmatch(r'NR[ZB]\d\d', pre or '')  # préfixe propre à la wave (NRZ08, NRB09) ; 'NR' / 'NRSS' sont partagés
if CN: QUERIES = [f'Kayou Naruto {meta["title"]}', meta['title']] + ([pre] if distinct else []) if W else [f'Kayou Naruto {meta["title"]}']
else: QUERIES = [d['search'], pre]

if sys.argv[2] == '--urls':
    host, kind = sys.argv[3], (sys.argv[4] if len(sys.argv) > 4 else 'S')
    par = 'LH_Sold=1&LH_Complete=1' if kind == 'S' else 'LH_BIN=1'
    qs = QUERIES if kind == 'S' else QUERIES[:1]
    print(json.dumps([[f'{kind}-{host.split(".")[1]}{i}-p{p}', f'https://www.{host}/sch/i.html?_nkw={urllib.parse.quote_plus(q)}&{par}&_ipg=240&LH_PrefLoc=2&imm=1&_pgn={p}']
                      for i, q in enumerate(qs) for p in range(1, 6)]))
    sys.exit()

EXPORT = sys.argv[2]; USD = float(sys.argv[3]) if len(sys.argv) > 3 else 1.10
TODAY = datetime.date.today(); LIM = TODAY - datetime.timedelta(days=90)
raw = open(EXPORT, encoding='utf-8').read()
if raw.lstrip().startswith('['):  # sortie sauvegardée d'un outil navigateur
    t = json.loads(raw)[0]['text']; t = json.JSONDecoder().raw_decode(t)[0] if t.startswith('"') else t
    raw = json.loads(t[t.index('@@DATA@@') + 8:t.index('@@END@@')])
M = {'jan': 1, 'janv': 1, 'févr': 2, 'feb': 2, 'mars': 3, 'mar': 3, 'mär': 3, 'avr': 4, 'apr': 4, 'mai': 5, 'may': 5, 'juin': 6, 'jun': 6, 'juil': 7, 'jul': 7, 'août': 8, 'aug': 8, 'sept': 9, 'sep': 9, 'oct': 10, 'okt': 10, 'nov': 11, 'déc': 12, 'dec': 12, 'dez': 12}
def pdate(s):
    m = re.match(r'(\d{1,2})\.?\s+([^\s.\d]+)\.?\s+(\d{4})', s)
    if m: return datetime.date(int(m.group(3)), M.get(m.group(2).lower()[:4]) or M.get(m.group(2).lower()[:3], 1), int(m.group(1)))
    m = re.match(r'([A-Za-z]{3})\w*\s+(\d{1,2}),\s+(\d{4})', s)
    return datetime.date(int(m.group(3)), M.get(m.group(1).lower(), 1), int(m.group(2))) if m else None
def pprice(s):
    if not s: return None
    usd = '$' in s; s = re.sub(r'[^\d.,]', '', s)
    if re.search(r',\d{2}$', s): s = s.replace('.', '').replace(',', '.')
    else: s = s.replace(',', '')
    return float(s) / USD if usd else float(s)
rows = {}
for l in raw.split('\n'):
    p = l.split('\t')
    if len(p) >= 6: rows[(p[0][0], p[4] or p[5])] = p
OTHER = re.compile(r'NRSA0\d|NREA0\d|NRI0\d|NRCC\w*|NR[ZB]\d\d', re.I)
BAD = re.compile(r'\blots?\b|bundle|\bx\s?[2-9]\b|\b[2-9]\s?x\b|proxy|custom|fan.?made|reprint|\bpsa\b|bgs|cgc|\bpca\b|collect ?aura|grad[ée]|graded|set of|complete|playset|au choix|choose|choice|pick|select|choisi|à choisir|liste|booster|display|scell|sealed', re.I)
FOREIGN = re.compile(r'chin|t\dw\d|tier\s?\d|nrz\d|nrb\d|\bcn\b', re.I)  # séries FR : versions chinoises exclues
LOCAL = re.compile(r'\b(?:EN|FR|ENG)\b|(?i:english|anglais|fran[cç]ais|french|heaven scroll|chapter jin|earth scroll|ninja age|smriti)')  # sets chinois : versions EN/FR exclues
WTAG = re.compile(r'\bT\s?(\d(?:\.5)?)\s?[-_/ ]?\s?W(?:AVE)?\s?0?(\d)\b|TIER\s?(\d(?:\.5)?)\s*WAVE\s?(\d)', re.I)
rars = sorted({c['rarity'] for c in d['cards']}, key=len, reverse=True)
RRE = re.compile(r'(?<![A-Z])(' + '|'.join(re.escape(r) for r in rars) + r')[\s\-*_#.]*0*(\d{1,3})(?:L\d)?(?!\d)')
bycode = {(c['rarity'], int(re.search(r'(\d+)$', c['code']).group(1))): c for c in d['cards']}
realname = lambda c: c['name'] and c['name'].lower() != c['code'].split('-', 1)[1].lower()
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
    if CN:
        if LOCAL.search(title): stats['version EN/FR'] += 1; continue
        if {x.upper() for x in OTHER.findall(T)} - {pre}: stats['autre série'] += 1; continue
        tags = {(a or c, b or e) for a, b, c, e in WTAG.findall(T)}
        if W and tags - {W.groups()}: stats['autre wave'] += 1; continue
        if W and not tags and not (distinct and pre in T): stats['hors wave'] += 1; continue
        if not W and tags: stats['autre wave'] += 1; continue
    else:
        if FOREIGN.search(title): stats['exclu'] += 1; continue
        if {x.upper() for x in OTHER.findall(T)} - {pre}: stats['autre série'] += 1; continue
        if pre not in T and SERIE not in T: stats['hors série'] += 1; continue
    hits = {(r, int(n)) for r, n in RRE.findall(T) if (r, int(n)) in bycode}
    if len(hits) == 1: card = bycode[hits.pop()]; stats['par code'] += 1
    elif hits: stats['ambigu'] += 1; continue
    else:
        rr = [r for r in rars if re.search(r'(?<![A-Z])' + re.escape(r) + r'(?![A-Z])', T)]
        cand = [c for c in d['cards'] if rr and c['rarity'] == rr[0] and realname(c) and any(w in T for w in words(c['name']))]
        if len(cand) != 1: stats['non associé'] += 1; continue
        card = cand[0]; stats['par nom'] += 1
    if kind == 'S': sales[card['code']].append({'date': str(dt), 'prix': round(v, 2), 'pays': pays.strip() or {'ebay.fr': 'France', 'ebay.de': 'Allemagne', 'ebay.com': 'États-Unis'}.get(re.sub(r'https?://(www\.)?([^/]+).*', r'\2', url), ''), 'url': url})
    else: ads[card['code']].append(v)
if CN:  # watchlist chinoise : raretés au-dessus de UR (ordre du fichier, HR/PTR exclues car garanties), sinon tout le set
    order = [r['id'] for r in d['rarities']]; cut = next((order.index(r) for r in ('UR', 'SSR', 'SR', 'R') if r in order), len(order))
    watch = [c['code'] for c in d['cards'] if c['rarity'] in order[:cut] and c['rarity'] not in ('HR', 'PTR')]
else: watch = [c['code'] for c in json.load(open('data/watchlist.json'))['cards'] if c['set'] == SID]
bonus = [c['code'] for c in d['cards'] if c['rarity'] in ('UR', 'SSR', 'UAR', 'URA') and c['code'] not in watch]
K = (lambda c: f'{SID}|{c}') if CN else (lambda c: c)
pj = json.load(open('data/prices.json')); cards = pj.setdefault('cards', {})
upd = {}
for code in watch + bonus:
    s = sorted(sales.get(code, []), key=lambda x: x['date'], reverse=True); a = ads.get(code, [])
    if code in bonus and not s and not a: continue
    old = cards.get(K(code), {}); hist = [h for h in old.get('historique', []) if h['date'] != str(TODAY)]
    med = round(statistics.median([x['prix'] for x in s]), 2) if len(s) >= 2 else None
    if med is not None: hist.append({'date': str(TODAY), 'median': med})
    e = {'median': med, 'nbVentes': len(s), 'dernieresVentes': s[:3], 'plusBasActuel': round(min(a), 2) if a else None, 'nbAnnonces': len(a),
         'date': str(TODAY), 'source': '+'.join(sorted({re.sub(r'https?://(www\.)?([^/]+).*', r'\2', x['url']) for x in s})) or 'ebay', 'historique': hist[-24:]}
    if med is None: e['note'] = 'pas assez de ventes'
    cards[K(code)] = e; upd[code] = e
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
