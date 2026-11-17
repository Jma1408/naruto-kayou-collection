'use strict';
/* Données : IndexedDB « kayoudex » (stores col / photos), clé « <setId>|<code> » — NE PAS MODIFIER (voir CLAUDE.md). */
const $ = (s, r = document) => r.querySelector(s);
const V = $('#view');
const CONDS = ['Mint', 'NM', 'EX', 'GD', 'LP', 'PL', 'Abîmée'];
const S = { sets: [], setsSrc: '', odds: {}, col: {}, photos: {}, prices: null, data: {}, ctx: [], pack: [], opened: null, cls: {}, q: '' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = v => v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const f1 = y => (Math.round(y * 10) / 10).toLocaleString('fr-FR');
const key = c => c.set + '|' + c.code;
const qty = c => (S.col[key(c)] || {}).q || 0;
const price = c => { const p = S.prices && S.prices.cards[c.code]; return p && p.n > 0 ? p : null; };
const meta = id => S.sets.find(m => m.id === id);
const rarOf = c => S.data[c.set].rarities.find(x => x.id === c.rarity) || { id: c.rarity, label: c.rarity };
const rIdx = c => S.data[c.set].rarities.findIndex(x => x.id === c.rarity);
const land = c => c.land ?? c.rarity === 'R';
const isHigh = c => { const rs = S.data[c.set].rarities, u = rs.findIndex(x => x.id === 'UR'), i = rIdx(c); return c.rarity.includes('◇') || (u >= 0 ? i <= u : i < 4); };
const ownedIn = id => Object.keys(S.col).filter(k => k.startsWith(id + '|') && S.col[k].q > 0).length;
const vib = n => { try { navigator.vibrate && navigator.vibrate(n); } catch { } };

/* ---------- IndexedDB ---------- */
const dbp = new Promise((res, rej) => {
  const q = indexedDB.open('kayoudex', 1);
  q.onupgradeneeded = () => { q.result.createObjectStore('col'); q.result.createObjectStore('photos'); };
  q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
});
const idb = (st, mode, fn) => dbp.then(d => new Promise((res, rej) => {
  const t = d.transaction(st, mode), r = fn(t.objectStore(st));
  t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
}));
const allOf = st => dbp.then(d => new Promise(res => {
  const o = {}, c = d.transaction(st).objectStore(st).openCursor();
  c.onsuccess = () => { const k = c.result; if (k) { o[k.key] = k.value; k.continue(); } else res(o); };
}));
const saveCol = k => S.col[k] && (S.col[k].q || S.col[k].cond)
  ? idb('col', 'readwrite', s => s.put(S.col[k], k)) : idb('col', 'readwrite', s => s.delete(k));

/* ---------- utils ---------- */
let tt;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1400); }
function add(c, d = 1) { const k = key(c), e = S.col[k] || (S.col[k] = { q: 0, cond: 'NM' }); e.q = Math.max(0, e.q + d); saveCol(k); }
// Carte sans image : placeholder nom + code + rareté (l'ajout n'est jamais bloqué).
const ph = c => `<div class="ph"><b>${esc(c.rarity)}</b>${esc(c.name || '')}<small>${esc(c.code)}</small></div>`;
function img(c) {
  const src = S.photos[key(c)] || c.img;
  if (!src) return ph(c);
  return `<img src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer" alt="" onerror="this.outerHTML=this.nextElementSibling.innerHTML"><template>${ph(c)}</template>`;
}
const ring = (o, t, size = 46) => `<div class="ring" style="--p:${t ? o / t * 100 : 0};--s:${size}px"><span>${t ? Math.round(o / t * 100) : 0}%</span></div>`;
function pDate() { if (!S.prices || !S.prices.updated) return ''; const d = new Date(S.prices.updated); return `Prix du ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }
async function loadPrices(force) {
  try { S.prices = await (await fetch('data/prices.json' + (force ? '?t=' + Date.now() : ''), { cache: 'no-store' })).json(); if (force) toast('Prix actualisés'); }
  catch { if (force) toast('Hors ligne : prix en cache'); }
}
async function loadSet(id) {
  if (S.data[id]) return S.data[id];
  const m = meta(id); if (!m || !m.file) return null;
  const d = await (await fetch(m.file)).json(); d.cards.forEach(c => c.set = id); return (S.data[id] = d);
}
const loadAll = () => Promise.all(S.sets.filter(m => m.file).map(m => loadSet(m.id)));
const allCards = () => Object.values(S.data).flatMap(d => d.cards);

/* ---------- navigation : une entrée d'historique par écran ---------- */
const parse = h => (decodeURIComponent(h.replace(/^#/, '')) || 'h').split('/');
function parent(h) {
  const [a, b, c] = parse(h);
  if (a === 's') return c ? '#s/' + b : '#h';
  if (a === 'g') return meta(b) && meta(b).file ? '#s/' + b : '#h';
  if (a === 'b') return c ? '#b/' + b : b ? '#b' : null;
  if (a === 'k') return '#r';
  return null;
}
let curBase = null, lastHash = null, navN = ((history.state && history.state.n) || 0) + 1;
const SCR = {};
history.scrollRestoration = 'manual';
const go = h => { location.hash = h; };
function replaceTo(h) { history.replaceState(history.state, '', h); route(); }
function back() { if (history.state && history.state.prev) history.back(); else replaceTo(parent(location.hash) || '#h'); }
async function route() {
  if (!history.state) history.replaceState({ n: navN++, prev: lastHash }, '');
  const seg = parse(location.hash), base = seg.join('/');
  if (curBase != null) SCR[curBase] = scrollY;
  curBase = base;
  const html = await (views[seg[0]] || views.h)(...seg.slice(1));
  if (base !== curBase) return;
  V.innerHTML = html; V.classList.remove('in'); void V.offsetWidth; V.classList.add('in');
  (binds[seg[0]] || (() => { }))(...seg.slice(1));
  scrollTo(0, SCR[base] || 0);
  $('#back').hidden = !parent(location.hash);
  $('#title').innerHTML = TITLE(seg);
  const tab = { b: 'b', r: 'r', k: 'r' }[seg[0]] || 'h';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
  lastHash = location.hash;
}
function TITLE(seg) {
  const m = meta(seg[1]);
  if (seg[0] === 's' || seg[0] === 'g') return esc((seg[0] === 'g' ? 'Guide · ' : '') + (m ? m.title : ''));
  return { b: 'Booster', r: 'Réglages', k: 'Comprendre Kayou' }[seg[0]] || 'Kayou <b>Dex</b>';
}
$('#back').onclick = back;
addEventListener('hashchange', route);

/* ---------- vues ---------- */
const ROWS = () => {
  const intl = [...new Set(S.sets.filter(m => m.region === 'intl').map(m => m.line))].map(l => ({ title: l, region: 'intl', sets: S.sets.filter(m => m.line === l) }));
  const cn = [...new Set(S.sets.filter(m => m.region === 'cn').map(m => m.group))].map(g => ({ title: 'Chine · ' + g, region: 'cn', sets: S.sets.filter(m => m.group === g) }));
  return [...intl, ...cn];
};
function shelfTile(m, href) {
  const t = m.count || 0, o = ownedIn(m.id), wip = !m.file;
  return `<a class="st${wip ? ' wip' : ''}" href="${href || (wip ? '#g/' + m.id : '#s/' + m.id)}"><div class="sti">${m.box || m.cover ? `<img src="${esc(m.box || m.cover)}" referrerpolicy="no-referrer" loading="lazy" alt="">` : '<span>⏳</span>'}</div>
    <b>${esc(m.title)}</b><span class="cn">${esc(m.titleCn || '')}</span>
    <div class="stp">${wip ? '<span class="rb">en cours</span>' : `${ring(o, t, 30)}<span>${o}/${t}</span>${m.partial ? '<span class="rb">partiel</span>' : ''}`}</div></a>`;
}
const views = {
  async h() {
    const reg = localStorage.getItem('reg') || 'all';
    return `<div class="band"><div class="seg">${[['fr', 'FR'], ['cn', 'Chine'], ['all', 'Tout']].map(([v, l]) => `<button data-reg="${v}" class="${reg === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <input id="gq" type="search" placeholder="🔍 Perso, nom chinois ou code (tous les sets)" value="${esc(S.q)}" autocomplete="off"></div>
      <div id="res"></div>
      <div id="shelves">${ROWS().filter(r => reg === 'all' || (reg === 'fr' ? r.region === 'intl' : r.region === 'cn')).map(r => `<section class="shelf"><h3>${esc(r.title)}</h3><div class="row">${r.sets.map(m => shelfTile(m)).join('')}</div></section>`).join('')}</div>`;
  },
  async s(id, code) {
    const d = await loadSet(id); if (!d) return views.g(id);
    return code ? views.card(d, code) : views.binder(d);
  },
  binder(d) {
    const id = d.id, f = S.cls[id] || (S.cls[id] = { r: '', own: false });
    const own = d.cards.filter(qty).length, t = d.cards.length, val = d.cards.reduce((a, c) => a + (price(c) ? price(c).median * qty(c) : 0), 0);
    const tabs = [{ id: '', label: 'Tout' }, ...d.rarities.slice().reverse()];
    S.ctx = d.cards.filter(c => (!f.r || c.rarity === f.r) && (!f.own || qty(c)));
    return `<section class="bh">${ring(own, t, 64)}<div><div class="big">${own}/${t}</div><div class="mu">Valeur estimée : ${eur(val)}</div></div>
      <a class="btn g" href="#g/${id}">📖 Guide</a></section>
      ${d.partial ? '<p class="note">Liste partielle (codes et raretés publiés, sans noms ni images) : ajoute tes cartes, puis ta photo depuis la fiche.</p>' : ''}
      <div class="ctabs">${tabs.map(r => { const cs = r.id ? d.cards.filter(c => c.rarity === r.id) : d.cards; return `<button data-r="${esc(r.id)}" class="${f.r === r.id ? 'on' : ''}">${esc(r.id || r.label)} <small>${cs.filter(qty).length}/${cs.length}</small></button>`; }).join('')}</div>
      <label class="own"><input type="checkbox" id="own" ${f.own ? 'checked' : ''}> Possédées seulement</label>
      <div class="grid" id="grid">${S.ctx.map(tile).join('') || '<p class="mu">Aucune carte.</p>'}</div>
      <p class="note">Tap = fiche · appui long = +1.</p>`;
  },
  card(d, code) {
    const c = d.cards.find(x => x.code === code); if (!c) return '<p>Carte introuvable.</p>';
    if (!S.ctx.includes(c)) S.ctx = d.cards;
    const e = S.col[key(c)] || { q: 0, cond: 'NM' }, p = price(c), r = rarOf(c), m = meta(c.set), i = S.ctx.indexOf(c);
    const q = encodeURIComponent(`kayou naruto ${c.code}`);
    const twin = (cd, sid) => sid && meta(sid) && meta(sid).file ? `<a href="#s/${sid}/${esc(cd)}">${esc(cd)}</a>` : esc(cd);
    return `<div class="det"><div class="card3d ${land(c) ? 'l' : ''} ${isHigh(c) ? 'holo' : ''}" id="c3">${img(c)}</div></div>
    <div class="nav"><button data-step="-1" ${i > 0 ? '' : 'disabled'}>‹</button><span class="mu">${i + 1}/${S.ctx.length} · glisse ← →</span><button data-step="1" ${i < S.ctx.length - 1 ? '' : 'disabled'}>›</button></div>
    <section class="box"><div class="qty"><button data-d="-1" aria-label="Retirer">−</button><div><b id="qv">${e.q}</b><small>possédée(s)</small></div><button data-d="1" aria-label="Ajouter">+</button></div></section>
    ${isHigh(c) && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission ? '<button class="btn g w" id="gyro">Activer l\'effet gyroscope</button>' : ''}
    <section class="box"><div style="font-size:20px;font-weight:800">${esc(c.name || c.code)}</div>${c.nameCn && c.nameCn !== c.name ? `<div>${esc(c.nameCn)}</div>` : ''}
      <div class="mu"><span class="rb ${esc(c.rarity)}">${esc(c.rarity)}</span> ${esc(r.label)} · ${esc(m.title)}</div>
      <table style="margin-top:10px"><tr><td>Code</td><td><b>${esc(c.full || c.code)}</b></td></tr>
      ${c.alias && c.alias.eu && c.alias.eu !== c.code ? `<tr><td>Code FR/EU</td><td>${twin(c.alias.eu, m.link)}</td></tr>` : ''}
      ${c.alias && c.alias.cn && c.alias.cn !== c.code ? `<tr><td>Code CN</td><td>${twin(c.alias.cn, m.link)}</td></tr>` : ''}
      <tr><td>État</td><td><select id="cond">${CONDS.map(x => `<option${x === e.cond ? ' selected' : ''}>${x}</option>`).join('')}</select></td></tr></table></section>
    <section class="box"><h2>Prix marché</h2>
      ${p ? `<div class="big">${eur(p.median)}</div><div class="mu">Médiane de ${p.n} annonce${p.n > 1 ? 's' : ''} eBay actives · ${pDate()}</div>
        ${p.psa ? `<div class="mu">Gradées PSA : ${eur(p.psa.median)} (${p.psa.n})</div>` : ''}`
        : '<div class="big" style="color:var(--mu)">pas de prix</div><div class="mu">0 annonce trouvée lors de la dernière mise à jour.</div>'}
      <div class="note">Estimation basée sur les annonces eBay, jamais une cote officielle.</div>
      <div class="links">${['fr', 'de', 'com'].map(t => `<a class="btn g" target="_blank" rel="noopener" href="https://www.ebay.${t}/sch/i.html?_nkw=${q}">eBay ${t === 'com' ? 'US' : t.toUpperCase()}</a>`).join('')}</div></section>
    <section class="box"><h2>Taux de drop</h2>${oddsLine(c)}<a class="mu" href="#g/${c.set}">Détail et source dans le guide ›</a></section>
    <section class="box"><h2>Ma photo</h2>
      <label class="btn w">📷 ${S.photos[key(c)] ? 'Remplacer ma photo' : 'Ajouter ma photo'}<input id="ph" type="file" accept="image/*" capture="environment" hidden></label>
      ${S.photos[key(c)] ? '<button class="btn g w" id="phx">Revenir à l\'image officielle</button>' : ''}</section>`;
  },
  async g(id) {
    const m = meta(id); if (!m) return '<p>Set introuvable.</p>';
    const d = await loadSet(id), o = S.odds[id], tw = m.link && meta(m.link);
    const rows = d ? d.rarities.map(r => { const x = rateOf(id, r.id); return `<tr><td><span class="rb ${esc(r.id)}">${esc(r.id)}</span></td><td>${esc(r.label)}</td><td>${r.count}</td><td>${x.booster}</td><td>${x.box}</td></tr>`; }).join('') : '';
    return `<section class="box"><h2>${esc(m.title)}</h2>${m.titleCn ? `<p>${esc(m.titleCn)}</p>` : ''}
      <table><tr><td>Sortie</td><td>${esc((d && d.release) || m.release || 'non trouvée')}</td></tr>
      <tr><td>Booster</td><td>${esc(d && d.pack && d.pack.cards ? d.pack.cards + ' cartes' : (m.pack || 'non trouvé'))}</td></tr>
      <tr><td>Boîte</td><td>${esc(d && d.pack && d.pack.box ? d.pack.box + ' boosters' : '—')}${d && d.model ? ' · ' + esc(d.model) : ''}</td></tr>
      <tr><td>Prix</td><td>${esc(m.price || (m.region === 'intl' ? 'prix public non indiqué par Kayou' : 'non trouvé'))}</td></tr>
      <tr><td>Équivalence</td><td>${tw ? `<a href="${tw.file ? '#s/' + tw.id : '#g/' + tw.id}">${esc(tw.title)}${tw.titleCn ? ' · ' + esc(tw.titleCn) : ''}</a><br><span class="mu">${esc(m.linkLabel || '')}</span>` : '<span class="mu">aucune équivalence connue</span>'}</td></tr>
      ${d && d.pack && d.pack.probabilities && d.pack.probabilities.length ? `<tr><td>Contenu officiel</td><td>${d.pack.probabilities.map(x => `${esc(x.ratio)} : ${esc(x.slots)}`).join('<br>')}</td></tr>` : ''}
      ${TIERX(m) ? `<tr><td>Ce tier</td><td>${TIERX(m)}</td></tr>` : ''}
      ${d && d.source ? `<tr><td>Source liste</td><td class="mu">${esc(d.source)}</td></tr>` : ''}</table></section>
      ${d ? `<section class="box"><h2>Raretés</h2><div class="tw"><table class="rt"><tr><th></th><th>Nom</th><th>Cartes</th><th>Par booster</th><th>Par boîte</th></tr>${rows}</table></div>
        <p class="note">Source des taux : ${esc(o && o.source || 'aucune répartition publiée trouvée')}. ${esc(S.odds.openingData || '')}</p>
        ${o && o.checks && o.checks.length ? `<p class="note">Contrôle : ${o.checks.map(esc).join(' · ')}</p>` : ''}</section>`
        : `<section class="box"><p><span class="rb">en cours</span> Liste des cartes pas encore relevée : rien n'est inventé.</p></section>`}
      <a class="btn g w" href="#k">Comprendre Kayou (Tier, Wave, codes, raretés)</a>`;
  },
  b(id, step) {
    if (!id) return `<p class="mu">Choisis le set du booster ouvert</p><div class="row wrap">${S.sets.filter(m => m.file).map(m => shelfTile(m, '#b/' + m.id)).join('')}</div>`;
    return step === 'open' ? views.reveal(id) : views.pack(id);
  },
  async pack(id) {
    const d = await loadSet(id); if (!d) return '';
    return `<section class="box pk"><div class="pkh"><b>Booster : <span id="pn">0</span>/${PK(d)}</b><button class="btn" id="pv" disabled>Ouvrir ✦</button></div><div class="chips" id="pc"></div></section>
      <div id="pkg">${d.rarities.map(r => `<h3 class="gh">${esc(r.id)} · ${esc(r.label)}</h3><div class="grid g4">${d.cards.filter(c => c.rarity === r.id).map(c => tile(c).replace('class="c ', 'class="c b ')).join('')}</div>`).join('')}</div>`;
  },
  reveal(id) {
    const o = S.opened; if (!o || o.set !== id) { setTimeout(() => replaceTo('#b/' + id)); return ''; }
    return `<div class="reveal">${o.cards.map((c, i) => `<div class="flip" style="--d:${i * 0.45}s"><div class="fi"><div class="fb"></div><div class="ff ${land(c) ? 'l' : ''} ${isHigh(c) ? 'holo' : ''}">${img(c)}</div></div>
      <div class="fl">${o.isNew[i] ? '<b class="nw">NOUVELLE</b>' : '<span class="mu">doublon</span>'} <span class="rb ${esc(c.rarity)}">${esc(c.rarity)}</span></div></div>`).join('')}</div>
      <section class="box recap" style="--d:${o.cards.length * 0.45 + 0.3}s"><h2>Récap</h2>
      <div class="rw"><span>Nouvelles cartes</span><b>${o.isNew.filter(Boolean).length}</b></div>
      <div class="rw"><span>Doublons</span><b>${o.isNew.filter(x => !x).length}</b></div>
      <div class="rw"><span>Valeur estimée du booster</span><b>${eur(o.cards.reduce((a, c) => a + (price(c)?.median || 0), 0))}</b></div>
      <p class="note">Somme des médianes eBay disponibles (${o.cards.filter(price).length}/${o.cards.length} cartes avec un prix).</p>
      <a class="btn w" href="#b/${id}" data-replace>Nouveau booster</a><a class="btn g w" href="#s/${id}">Voir le classeur</a></section>`;
  },
  r() {
    return `<a class="btn w" href="#k">📖 Comprendre Kayou</a>
    <section class="box"><h2>Sauvegarde</h2><p class="mu">Ta collection est stockée sur ce téléphone (IndexedDB). Exporte-la régulièrement.</p>
      <button class="btn w" id="ex">⤓ Exporter (JSON)</button>
      <label class="btn g w">⤒ Importer un backup<input id="im" type="file" accept="application/json,.json" hidden></label></section>
    <section class="box"><h2>Prix</h2><p class="mu">${pDate() || 'Aucun prix'} — ${S.prices ? Object.values(S.prices.cards).filter(p => p.n).length : 0} cartes avec au moins une annonce. Estimation basée sur les annonces eBay actives, pas une cote officielle.</p>
      <button class="btn g w" id="refresh">↻ Actualiser</button></section>
    <section class="box"><h2>Données</h2><p class="mu">International : kayouofficial.com. Chine : ${esc(S.setsSrc)}.</p></section>`;
  },
  k() {
    const LEX = [['R', 'Rare', 'commune'], ['SR', 'Super Rare', ''], ['SSR', 'Super Super Rare', ''], ['TR / TGR', 'Transparent (Gold) Rare', '5 ¥ seulement'], ['HR', 'Holographique Rare', '10 ¥ seulement'], ['UR', 'Ultra Rare', '3 à 5 par boîte en moyenne'], ['ZR', 'Zekkyou Rare', '2 ¥, dès la wave 4'], ['AR', 'Absolute Rare', '1 à 4 par boîte'], ['OR', 'Over Rare', '1 à 4 par boîte'], ['SLR', 'Shadow Light Rare', '10 ¥, versions noire et blanche'], ['CP', 'Character Partner', '3 ¥ (T2.5) seulement'], ['SP', 'Special Portrait', '≈ 1 boîte sur 2'], ['MR', 'Memorial Rare', '≈ 1 boîte sur 3, dès la wave 2'], ['GP', 'Gold Pack', '1 ¥, ≈ 1 boîte sur 6'], ['CR', 'Commemorative Rare', '2 ¥, ≈ 1 boîte sur 24'], ['NR', 'New Rare', '5 ¥, ≈ 1 boîte sur 24'], ['BP', 'Bonus Pack', '10 ¥, ≈ 1 boîte sur 18'], ['SE', 'Special Edition', 'tirage limité, ≈ 1 boîte sur 180 (10 ¥, waves 4-5)'], ['PTR / PU', 'Platinum Rare / Parallel Universe', 'apparues avec T4W6'], ['◇', 'version « diamant » (Ninja Age)', 'plus rare que la version simple'], ['NRSS-…', 'cartes de coffrets (collector)', 'SSR < UR < AR < OR < HR < SP < SE < SV argent < SV or']];
    return `<section class="box"><h2>Tier, Wave et Yuan</h2>
      <p>En Chine, Kayou range Naruto par <b>yuan</b> (prix du booster) et par <b>série</b>. En anglais on dit <b>Tier</b> et <b>Wave</b> : « T4W6 » = 10 ¥, série 6.</p>
      <table><tr><td><b>1 ¥</b> = Tier 1</td><td>36 boosters · garanti : 1 R non brillante · exclusivité GP</td></tr>
      <tr><td><b>2 ¥</b> = Tier 2</td><td>30 boosters · garanti : 1 SR · exclusivités CR, ZR</td></tr>
      <tr><td><b>3 ¥</b> = Tier 2.5</td><td>50 boosters · série 1 uniquement · exclusivité CP</td></tr>
      <tr><td><b>5 ¥</b> = Tier 3</td><td>20 boosters · garanti : 1 TR ou TGR · exclusivité NR</td></tr>
      <tr><td><b>10 ¥</b> = Tier 4</td><td>18 boosters · garanti : 1 HR · exclusivités BP, SE, SLR</td></tr></table>
      <p class="note">Toujours 5 cartes par booster. Plus le yuan est élevé, moins il y a de boosters par boîte, mais meilleures sont les cartes. Le chiffre du yuan est dans le cercle en haut de la boîte, la série en caractère chinois sur le bandeau du bas.</p>
      <p>Les boîtes sortent d'usine par cartons (48 boîtes pour 1, 2 et 5 ¥ ; 36 pour 3 et 10 ¥). Kayou fixe les raretés les plus hautes par carton, d'où par exemple « 2 BP par carton de 10 ¥ » (≈ 1 boîte sur 18).</p>
      <p>Hits moyens par boîte (hors SSR) : 2-3 en 1 ¥, 4-7 en 2 ¥, 7-10 en 3 ¥, 6-7 en 5 ¥, 7-8 en 10 ¥.</p></section>
    <section class="box"><h2>Chine ou international ?</h2>
      <p>La gamme internationale <b>Smriti</b> (Heaven Scroll, Chapter Jin, Earth Scroll, Ninja Age) reprend souvent les illustrations d'une wave chinoise (Heaven Scroll S1 ↔ T4W6, Chapter Jin S2 ↔ T4W7), mais avec d'autres codes, des boosters de 8 cartes au lieu de 5 et d'autres taux. Ce sont deux cartes différentes à collectionner, avec des prix différents.</p></section>
    <section class="box"><h2>Lire un code de carte</h2>
      <p class="code">NRZ06-SSR-149L3</p>
      <table><tr><td><b>NR</b></td><td>Naruto</td></tr><tr><td><b>Z</b></td><td>la gamme : Z = 10 ¥ (阵之章, Tier 4), B = 2 ¥ (兵之章, Tier 2) ; SA / I / EA = international</td></tr>
      <tr><td><b>06</b></td><td>la série (wave)</td></tr><tr><td><b>SSR</b></td><td>la rareté</td></tr><tr><td><b>149</b></td><td>le numéro dans la rareté</td></tr><tr><td><b>L3</b></td><td>niveau de rareté imprimé (L1 = commune … L5 = la plus haute)</td></tr></table>
      <p class="note">Avant T4W6 / T2W7, les cartes portent un code court (« UR-013 », « NR-SP-016 ») numéroté sur toute la gamme, toutes boîtes confondues.</p></section>
    <section class="box"><h2>Lexique des raretés</h2><table>${LEX.map(([a, b, c]) => `<tr><td><b>${a}</b></td><td>${b}${c ? `<br><span class="mu">${c}</span>` : ''}</td></tr>`).join('')}</table>
      <p class="note">Noms, exclusivités et moyennes : guides de la boutique Narutopia (narutopia.fr) ; raretés internationales : kayouofficial.com. Les moyennes sont indicatives, une boîte peut en contenir plus ou moins.</p></section>`;
  }
};
const YUAN = { 1: ['1 ¥', 36, 'R non brillante', 'GP'], 2: ['2 ¥', 30, '1 SR', 'CR (+ ZR dès la wave 4)'], 25: ['3 ¥', 50, 'SR minimum', 'CP'], 3: ['5 ¥', 20, '1 TR ou TGR', 'NR (+ TR/TGR)'], 4: ['10 ¥', 18, '1 HR (waves 1-5)', 'BP, SE (+ HR, SLR)'] };
const TIERX = m => { const t = (m.id.match(/^cn-t(\d+)w/) || [])[1]; const y = YUAN[t]; return y ? `${y[0]} le booster · ${y[1]} boosters de 5 cartes par boîte · garanti par booster : ${y[2]} · exclusivités : ${y[3]} <span class="mu">(Narutopia)</span>` : ''; };
const PK = d => (d.pack && d.pack.cards) || 8;
const tile = c => `<div class="c ${land(c) ? 'l' : ''} ${qty(c) ? '' : 'no'}" data-k="${esc(c.set + '/' + c.code)}">${img(c)}${qty(c) > 1 ? `<span class="q">×${qty(c)}</span>` : ''}</div>`;
const byKey = k => { const i = k.indexOf('/'), s = k.slice(0, i), c = k.slice(i + 1); return S.data[s] && S.data[s].cards.find(x => x.code === c); };
function refreshTile(el) { const n = document.createElement('div'); n.innerHTML = tile(byKey(el.dataset.k)); const nc = n.firstChild; if (el.classList.contains('b')) nc.classList.add('b'); el.replaceWith(nc); return nc; }

/* taux par rareté : officiel / minimum officiel / inconnu */
function rateOf(id, rar) {
  const o = S.odds[id], r = o && o.rarities && o.rarities[rar], B = o && o.boxPacks;
  if (!r || (!r.k && !r.min)) return { booster: 'taux inconnu', box: '—', r };
  if (r.k) return { booster: r.k >= 1 ? `${f1(r.k)} (garanti)` : `1 sur ${f1(1 / r.k)}`, box: r.range ? r.range.replace(' par boîte', '') : `≈ ${f1(r.k * B)}`, r };
  return { booster: `≥ ${f1(r.min)}`, box: `≥ ${f1(r.min * B)}`, r };
}
function oddsLine(c) {
  const x = rateOf(c.set, c.rarity), n = rarOf(c).count, r = x.r;
  if (!r || (!r.k && !r.min)) return `<p><b>${esc(c.rarity)}</b> : taux inconnu</p>`;
  const k = r.k || r.min, pc = 1 - Math.pow(1 - 1 / n, k);
  return `<p><b>${esc(c.rarity)}</b> : ${x.booster} par booster · ${x.box} par boîte${r.k ? '' : ' (minimum)'}${r.status && r.status.startsWith('moyenne') ? ' <span class="mu">(moyenne)</span>' : ''}</p><p class="note">Cette carte : ${r.k ? '' : 'au moins '}1 chance sur ${f1(1 / pc)} boosters.</p>`;
}

/* appui court = ouvrir, appui long = +1 */
function press(el, onTap, onLong) {
  if (!el) return;
  let t, x, y, fired, moved;
  el.addEventListener('pointerdown', e => { if (!e.target.closest('.c')) return; fired = moved = false; x = e.clientX; y = e.clientY; t = setTimeout(() => { fired = true; onLong(e.target.closest('.c')); }, 450); });
  el.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x, e.clientY - y) > 10) { moved = true; clearTimeout(t); } });
  el.addEventListener('pointerup', e => { clearTimeout(t); const c = e.target.closest('.c'); if (c && !fired && !moved) onTap(c); });
  el.addEventListener('pointercancel', () => clearTimeout(t));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
const openCard = c => go('#s/' + c.dataset.k);
const longAdd = c => { const card = byKey(c.dataset.k); add(card); vib(25); refreshTile(c).classList.add('pop'); toast(`+1 ${card.name || card.code} (×${qty(card)})`); };

const binds = {
  h() {
    const inp = $('#gq');
    const draw = async () => {
      S.q = inp.value.trim(); const q = S.q.toLowerCase(), on = q.length >= 2;
      $('#shelves').hidden = on;
      if (!on) { $('#res').innerHTML = ''; return; }
      await loadAll(); if (S.q.toLowerCase() !== q) return;
      const reg = localStorage.getItem('reg') || 'all';
      const res = allCards().filter(c => (reg === 'all' || (meta(c.set).region === 'intl') === (reg === 'fr')) && [c.name, c.nameCn, c.code, c.full, c.alias && c.alias.cn, c.alias && c.alias.eu].join(' ').toLowerCase().includes(q)).slice(0, 150);
      S.ctx = res;
      $('#res').innerHTML = `<p class="mu">${res.length} résultat${res.length > 1 ? 's' : ''}${res.length === 150 ? ' (150 max)' : ''}</p><div class="grid">${res.map(tile).join('')}</div>`;
    };
    inp.oninput = draw; draw();
    press($('#res'), openCard, longAdd);
    V.querySelectorAll('[data-reg]').forEach(b => b.onclick = () => { localStorage.setItem('reg', b.dataset.reg); curBase = null; route(); });
  },
  s(id, code) {
    if (code) return bindCard(byKey(id + '/' + code));
    const f = S.cls[id]; if (!f) return;
    V.querySelectorAll('.ctabs button').forEach(b => b.onclick = () => { f.r = b.dataset.r; SCR[curBase] = 0; curBase = null; route(); });
    $('#own').onchange = e => { f.own = e.target.checked; curBase = null; route(); };
    press($('#grid'), openCard, longAdd);
    const on = V.querySelector('.ctabs .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  },
  b(id, step) {
    if (!id || step) return;
    const d = S.data[id];
    const draw = () => {
      $('#pn').textContent = S.pack.length; $('#pv').disabled = !S.pack.length;
      $('#pc').innerHTML = S.pack.map((k, i) => `<button class="chip" data-i="${i}">${esc(k.slice(k.indexOf('/') + 1).replace(d.codePrefix + '-', ''))}</button>`).join('') || '<span class="mu">Tape les cartes tirées.</span>';
    };
    if (S.pack.some(k => !k.startsWith(id + '/'))) S.pack = [];
    draw();
    press($('#pkg'), c => { if (S.pack.length >= PK(d)) return toast(PK(d) + ' cartes max'); S.pack.push(c.dataset.k); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); vib(15); draw(); }, () => { });
    $('#pc').onclick = e => { const b = e.target.closest('.chip'); if (b) { S.pack.splice(+b.dataset.i, 1); draw(); } };
    $('#pv').onclick = () => {
      const seen = new Set(), cards = S.pack.map(byKey);
      const isNew = cards.map(c => { const n = !qty(c) && !seen.has(c.code); seen.add(c.code); return n; });
      cards.forEach(c => add(c)); S.opened = { set: id, cards, isNew }; S.pack = [];
      go(`#b/${id}/open`);
    };
  },
  r() { $('#ex').onclick = exportJSON; $('#im').onchange = e => e.target.files[0] && importJSON(e.target.files[0]); }
};
document.addEventListener('click', async e => {
  const r = e.target.closest('#refresh'); if (r) { await loadPrices(true); curBase = null; route(); return; }
  const a = e.target.closest('a[data-replace]'); if (a) { e.preventDefault(); replaceTo(a.getAttribute('href')); }
});

/* ---------- fiche plein écran ---------- */
function step(cur, dir) { const n = S.ctx[S.ctx.indexOf(cur) + dir]; if (!n) return; V.classList.add(dir > 0 ? 'sl' : 'sr'); setTimeout(() => V.classList.remove('sl', 'sr'), 250); replaceTo(`#s/${n.set}/${n.code}`); }
function bindCard(c) {
  if (!c) return;
  const k = key(c), c3 = $('#c3');
  V.querySelectorAll('.qty button').forEach(b => b.onclick = () => { add(c, +b.dataset.d); $('#qv').textContent = qty(c); vib(15); });
  V.querySelectorAll('.nav button').forEach(b => b.onclick = () => step(c, +b.dataset.step));
  $('#cond').onchange = e => { (S.col[k] || (S.col[k] = { q: 0 })).cond = e.target.value; saveCol(k); };
  const tilt = (px, py) => { c3.style.setProperty('--mx', px * 100 + '%'); c3.style.setProperty('--my', py * 100 + '%'); c3.style.setProperty('--ry', (px - .5) * 24 + 'deg'); c3.style.setProperty('--rx', (.5 - py) * 24 + 'deg'); };
  if (isHigh(c)) {
    c3.onpointermove = e => { if (e.pointerType === 'touch') return; const r = c3.getBoundingClientRect(); tilt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    c3.onpointerleave = () => tilt(.5, .5);
    removeEventListener('deviceorientation', window._og || (() => { }));
    window._og = e => { if (e.gamma == null || !document.body.contains(c3)) return; tilt(Math.min(1, Math.max(0, .5 + e.gamma / 60)), Math.min(1, Math.max(0, .5 + (e.beta - 45) / 60))); };
    const on = () => addEventListener('deviceorientation', window._og);
    if ($('#gyro')) $('#gyro').onclick = () => DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') { on(); $('#gyro').remove(); } }); else on();
  }
  $('#ph').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const b = await shrink(f); await idb('photos', 'readwrite', s => s.put(b, k)); S.photos[k] = URL.createObjectURL(b); toast('Photo enregistrée'); curBase = null; route();
  };
  if ($('#phx')) $('#phx').onclick = async () => { await idb('photos', 'readwrite', s => s.delete(k)); delete S.photos[k]; curBase = null; route(); };
  let x0, y0; // glisser gauche/droite = carte suivante/précédente (bord gauche laissé au geste retour iOS)
  V.ontouchstart = e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
  V.ontouchend = e => { const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; if (x0 > 30 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) step(c, dx < 0 ? 1 : -1); };
}
addEventListener('hashchange', () => { if (!/^#s\/[^/]+\/./.test(location.hash)) V.ontouchstart = V.ontouchend = null; });

/* ---------- photos / backup (format v1 inchangé) ---------- */
function shrink(f) {
  return new Promise(res => {
    const im = new Image(); im.onload = () => {
      const s = Math.min(1, 900 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = im.width * s; cv.height = im.height * s; cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      cv.toBlob(res, 'image/jpeg', .85); URL.revokeObjectURL(im.src);
    }; im.src = URL.createObjectURL(f);
  });
}
const b2d = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function exportJSON() {
  const ph = await allOf('photos'), photos = {};
  for (const k in ph) photos[k] = await b2d(ph[k]);
  const blob = new Blob([JSON.stringify({ app: 'kayoudex', v: 1, date: new Date().toISOString(), col: S.col, photos })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kayoudex-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  toast('Backup exporté');
}
async function importJSON(f) {
  try {
    const d = JSON.parse(await f.text()); if (d.app !== 'kayoudex' || !d.col) throw 0;
    if (!confirm('Remplacer la collection actuelle par ce backup ?')) return;
    await idb('col', 'readwrite', s => s.clear()); await idb('photos', 'readwrite', s => s.clear());
    await idb('col', 'readwrite', s => { for (const k in d.col) s.put(d.col[k], k); });
    const blobs = {}; for (const k in d.photos || {}) blobs[k] = await (await fetch(d.photos[k])).blob();
    await idb('photos', 'readwrite', s => { for (const k in blobs) s.put(blobs[k], k); });
    toast('Backup importé'); setTimeout(() => location.reload(), 600);
  } catch { toast('Fichier invalide'); }
}

async function init() {
  const [sj, od] = await Promise.all([fetch('data/sets.json').then(r => r.json()), fetch('data/odds.json').then(r => r.json())]);
  S.sets = Array.isArray(sj) ? sj : sj.sets; S.setsSrc = sj.source || ''; S.odds = od;
  S.col = await allOf('col');
  const ph = await allOf('photos'); for (const k in ph) S.photos[k] = URL.createObjectURL(ph[k]);
  await loadPrices();
  const h = parse(location.hash)[0];
  if (!location.hash || !views[h] || ['c', 'm', 'q', 'i', 'w', 'menu'].includes(h)) history.replaceState(history.state, '', '#h'); // anciennes URL → accueil
  route();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
init();
