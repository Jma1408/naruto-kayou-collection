'use strict';
/* Données : IndexedDB « kayoudex » (stores col / photos), clé « <setId>|<code> » — NE PAS MODIFIER (voir CLAUDE.md). */
const $ = (s, r = document) => r.querySelector(s);
const V = $('#view'), SH = $('#sheet'), SB = $('#sheetBody');
const CONDS = ['Mint', 'NM', 'EX', 'GD', 'LP', 'PL', 'Abîmée'];
const S = { sets: [], setsSrc: '', odds: {}, col: {}, photos: {}, prices: null, data: {}, ctx: [], pack: [], opened: null, filt: { o: '' }, mf: { g: '', s: '', r: '', t: 'p' } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = v => v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const f1 = y => (Math.round(y * 10) / 10).toLocaleString('fr-FR');
const key = c => c.set + '|' + c.code;
const qty = c => (S.col[key(c)] || {}).q || 0;
const price = c => { const p = S.prices && S.prices.cards[c.code]; return p && p.n > 0 ? p : null; };
const meta = id => S.sets.find(m => m.id === id);
const rIdx = c => S.data[c.set].rarities.findIndex(x => x.id === c.rarity);
const land = c => c.land ?? c.rarity === 'R';
const isHigh = c => { const rs = S.data[c.set].rarities, u = rs.findIndex(x => x.id === 'UR'), i = rIdx(c); return c.rarity.includes('◇') || (u >= 0 ? i <= u : i < 4); };
const ownedIn = id => Object.keys(S.col).filter(k => k.startsWith(id + '|') && S.col[k].q > 0).length;
const vib = n => navigator.vibrate && navigator.vibrate(n);

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
const ph = c => `<div class="ph">${esc(c.name)}<br><small>${esc(c.code)}</small></div>`;
function img(c) {
  const src = S.photos[key(c)] || c.img;
  return src ? `<img src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer" alt="${esc(c.name)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:this.alt}))">` : ph(c);
}
function pDate() { if (!S.prices || !S.prices.updated) return ''; const d = new Date(S.prices.updated); return `Prix du ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }
async function loadPrices(force) {
  try { S.prices = await (await fetch('data/prices.json' + (force ? '?t=' + Date.now() : ''), { cache: 'no-store' })).json(); if (force) toast('Prix actualisés'); }
  catch { if (force) toast('Hors ligne : prix en cache'); }
}
async function loadSet(id) {
  if (S.data[id]) return S.data[id];
  const m = meta(id); if (!m || m.status !== 'ok') return null;
  const d = await (await fetch(m.file)).json(); d.cards.forEach(c => c.set = id); return (S.data[id] = d);
}
const loadAll = () => Promise.all(S.sets.filter(m => m.status === 'ok').map(m => loadSet(m.id)));
const allCards = () => Object.values(S.data).flatMap(d => d.cards);
const bar = (o, t) => `<div class="track"><i style="width:${t ? o / t * 100 : 0}%"></i></div><div class="mu">${o}/${t}</div>`;

/* ---------- navigation ---------- */
// Une entrée d'historique par écran (hash). « ! » sépare l'écran de base et la fiche carte ouverte en panneau.
const TIERS = () => [...new Set(S.sets.filter(m => m.region === 'cn').map(m => m.group))];
const LINES = () => [...new Set(S.sets.filter(m => m.region === 'intl').map(m => m.line))];
const parse = h => { const [b, card] = decodeURIComponent(h.replace(/^#/, '') || 'c').split('!'); return { base: b, seg: b.split('/'), card }; };
function parent(h) {
  const { base, seg, card } = parse(h);
  if (card) return '#' + base;
  const [a, b] = seg;
  if (a === 'c') return seg.length > 1 ? '#' + seg.slice(0, -1).join('/') : null;
  if (a === 's' || a === 'w') { const m = meta(b); return m ? (m.region === 'intl' ? `#c/intl/${m.line}` : `#c/cn/${TIERS().indexOf(m.group)}`) : '#c'; }
  if (a === 'i') return '#s/' + b;
  if (a === 'q') return '#c';
  if (a === 'b') return seg.length > 1 ? '#' + seg.slice(0, -1).join('/') : null;
  return null;
}
function crumbs(seg, card) {
  const out = [], m = meta(seg[1]);
  const regionC = r => out.push([r === 'intl' ? 'France / International' : 'Chine', '#c/' + r]);
  const setC = m => { regionC(m.region); m.region === 'intl' ? out.push([m.line, `#c/intl/${m.line}`]) : out.push([m.group.split(' — ')[0], `#c/cn/${TIERS().indexOf(m.group)}`]); out.push([m.title, '#s/' + m.id]); };
  switch (seg[0]) {
    case 'c': if (seg[1]) regionC(seg[1]); if (seg[2] != null) out.push(seg[1] === 'intl' ? [seg[2], '#c/intl/' + seg[2]] : [TIERS()[seg[2]].split(' — ')[0], '#c/cn/' + seg[2]]); break;
    case 's': case 'w': if (m) setC(m); break;
    case 'i': if (m) { setC(m); out.push(["C'est quel set ?", '#i/' + m.id]); } break;
    case 'q': out.push(['Recherche', '#q']); break;
    case 'm': out.push(['Ma collection', '#m']); break;
    case 'b': out.push(['Booster', '#b']); if (m) out.push([m.title, '#b/' + m.id]); if (seg[2]) out.push(['Ouverture', '#b/' + m.id + '/open']); break;
    case 'r': out.push(['Réglages', '#r']); break;
  }
  if (card) out.push([card.name, '']);
  return out;
}
let curBase = null, navN = ((history.state && history.state.n) || 0) + 1;
const SCR = {};
history.scrollRestoration = 'manual';
function go(h) { location.hash = h; }
let lastHash = null;
function replaceTo(h) { history.replaceState(history.state, '', h); route(); }
// Retour : revient à l'écran d'où l'on vient s'il est connu, sinon au parent logique (lien direct, pas de cul-de-sac).
function back() {
  const st = history.state, cur = parse(location.hash), prev = st && st.prev ? parse(st.prev) : null;
  if (cur.card) return prev && prev.base === cur.base && !prev.card ? history.back() : replaceTo('#' + cur.base);
  if (prev) return history.back();
  replaceTo(parent(location.hash) || '#c');
}
async function route() {
  if (!history.state) history.replaceState({ n: navN++, prev: lastHash }, '');
  const { base, seg, card } = parse(location.hash);
  if (base !== curBase) {
    if (curBase != null) SCR[curBase] = scrollY;
    curBase = base;
    const html = await (views[seg[0]] || views.c)(...seg.slice(1));
    if (base !== curBase) return; // navigation plus récente entre-temps
    V.innerHTML = html; V.classList.remove('in'); void V.offsetWidth; V.classList.add('in');
    (binds[seg[0]] || (() => { }))(...seg.slice(1));
    scrollTo(0, SCR[base] || 0);
  }
  let cardObj = null;
  if (card) { const [sid, code] = card.split('/'); const d = await loadSet(sid); cardObj = d && d.cards.find(c => c.code === code); }
  cardObj ? openSheet(cardObj) : closeSheet();
  const cr = crumbs(seg, cardObj);
  $('#crumbs').innerHTML = cr.map(([l, h], i) => h && i < cr.length - 1 ? `<a href="${h}">${esc(l)}</a>` : `<span>${esc(l)}</span>`).join('<i>›</i>');
  $('#crumbs').hidden = !cr.length; document.body.classList.toggle('nc', !cr.length);
  $('#back').hidden = !parent(location.hash);
  $('#title').innerHTML = TITLES[seg[0]] ? TITLES[seg[0]](seg) : 'Kayou <b>Dex</b>';
  const tab = { c: 'c', s: 'c', w: 'c', i: 'c', q: 'c', m: 'm', b: 'b', r: 'r' }[seg[0]] || 'c';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
  lastHash = location.hash;
}
const TITLES = { s: s => esc(meta(s[1])?.title || ''), w: s => esc(meta(s[1])?.title || ''), m: () => 'Ma collection', b: () => 'Booster', r: () => 'Réglages', q: () => 'Recherche', i: () => "C'est quel set ?" };
$('#back').onclick = back;
addEventListener('hashchange', route);

/* ---------- vues ---------- */
const catTile = (href, imgSrc, title, sub, o, t, extra = '') => `<a class="cat" href="${href}"><div class="cimg">${imgSrc ? `<img src="${esc(imgSrc)}" referrerpolicy="no-referrer" loading="lazy" alt="">` : '<span>⏳</span>'}</div>
  <div class="cbody"><b>${esc(title)}</b>${sub ? `<div class="mu">${esc(sub)}</div>` : ''}${t ? bar(o, t) : ''}${extra}</div></a>`;
const sum = list => list.filter(m => m.status === 'ok').reduce((a, m) => [a[0] + ownedIn(m.id), a[1] + m.count], [0, 0]);
function setTile(m, href) {
  const l = m.link && meta(m.link) ? `<span class="lk">↔ ${esc(m.linkLabel)}</span>` : '';
  if (m.status !== 'ok') return catTile(`#w/${m.id}`, null, m.title, [m.price, m.pack].filter(Boolean).join(' · '), 0, 0, `<span class="rb">en cours</span>${l}`);
  return catTile(href || `#s/${m.id}`, m.box || m.cover, m.title, m.sub, ownedIn(m.id), m.count, l);
}
const views = {
  c(region, sub) {
    if (!region) {
      const i = sum(S.sets.filter(m => m.region === 'intl')), c = sum(S.sets.filter(m => m.region === 'cn'));
      return `<a class="search" href="#q">🔍 Rechercher un perso ou un code…</a><div class="cats">
        ${catTile('#c/intl', meta('heaven-scroll').box, 'France / International', 'Gamme Smriti (NRSA, NRI, NREA…)', ...i)}
        ${catTile('#c/cn', meta('cn-t4w6')?.cover, 'Chine', 'Tier / Wave (T1 → T4)', ...c)}</div>`;
    }
    if (region === 'intl' && sub == null) return `<div class="cats">${LINES().map(l => { const ms = S.sets.filter(m => m.line === l); return catTile(`#c/intl/${l}`, ms[0].box, l, `${ms.length} série${ms.length > 1 ? 's' : ''}`, ...sum(ms)); }).join('')}</div>`;
    if (region === 'intl') return `<div class="cats">${S.sets.filter(m => m.line === sub).map(m => setTile(m)).join('')}</div>`;
    if (sub == null) return `<div class="cats">${TIERS().map((g, i) => { const ms = S.sets.filter(m => m.group === g), ok = ms.filter(m => m.status === 'ok'); return catTile(`#c/cn/${i}`, ok[0]?.cover, g.split(' — ')[0], `${g.split(' — ')[1] || ''} · ${ms.length} boîte${ms.length > 1 ? 's' : ''}${ok.length < ms.length ? ` · ${ms.length - ok.length} en cours` : ''}`, ...sum(ms)); }).join('')}</div>
      <p class="note">Source : ${esc(S.setsSrc)}.</p>`;
    return `<div class="cats">${S.sets.filter(m => m.group === TIERS()[sub]).map(m => setTile(m)).join('')}</div>`;
  },
  w(id) {
    const m = meta(id); if (!m) return '<p>Set introuvable.</p>';
    return `<section class="box"><h2>${esc(m.title)}</h2><p>${esc(m.sub || '')}</p><p>${esc(m.price || '')}</p><p>${esc(m.pack || '')}</p>
      <p><span class="rb">en cours</span> La liste des cartes n'est pas encore saisie : aucune carte n'est inventée.</p>
      ${m.link ? `<a class="btn g w" href="#s/${m.link}">${esc(m.linkLabel)}</a>` : ''}<p class="note">Source : ${esc(S.setsSrc)}.</p></section>`;
  },
  async s(id) {
    const d = await loadSet(id); if (!d) return views.w(id);
    localStorage.setItem('set', id);
    const own = d.cards.filter(qty).length, t = d.cards.length, pct = Math.round(own / t * 1000) / 10;
    const val = d.cards.reduce((a, c) => a + (price(c) ? price(c).median * qty(c) : 0), 0);
    const closed = JSON.parse(sessionStorage.getItem('closed:' + id) || '[]');
    const o = S.filt.o, keep = c => !o || (o === 'own' ? qty(c) : o === 'miss' ? !qty(c) : qty(c) > 1);
    S.ctx = [];
    const secs = d.rarities.map(r => {
      const cs = d.cards.filter(c => c.rarity === r.id), vis = cs.filter(keep); vis.forEach(c => S.ctx.push(c));
      if (!vis.length) return '';
      return `<details class="sec" data-r="${esc(r.id)}"${closed.includes(r.id) ? '' : ' open'}><summary><span class="rb ${esc(r.id)}">${esc(r.id)}</span> ${esc(r.label)}<em>${cs.filter(qty).length}/${cs.length}</em></summary>
        <div class="grid">${vis.map(tile).join('')}</div></details>`;
    }).join('');
    return `<section class="box hero"><div class="ring" style="--p:${pct}"><div><b>${pct}%</b>${own}/${t}</div></div>
      <div><div class="mu">${esc(d.line)}</div><div style="font-weight:700">${esc(d.name)}</div>
      <div class="mu">Valeur estimée : ${eur(val)}</div><a class="mu" href="#i/${id}">C'est quel set ?</a></div></section>
      <div class="chipsel">${[['', 'Toutes'], ['own', 'Possédées'], ['miss', 'Manquantes'], ['dup', 'Doublons']].map(([v, l]) => `<button data-o="${v}" class="${o === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="secs">${secs || '<p class="mu">Aucune carte.</p>'}</div><p class="note">Appui long sur une carte = +1.</p>`;
  },
  async i(id) {
    const st = await loadSet(id); if (!st) return '';
    const o = st.origin, ex = st.cards.find(c => c.rarity === 'SSR') || st.cards[0];
    return `<section class="box"><h2>C'est quel set ?</h2>
      <table><tr><td>Nom</td><td><b>${esc(st.name)}</b><br>${esc(st.line)}</td></tr>
      <tr><td>Code cartes</td><td><b>${esc(st.codePrefix)}</b>-RARETÉ-NNN<br><span class="mu">ex. ${esc(ex.full || ex.code)}</span></td></tr>
      ${st.model ? `<tr><td>Boîte</td><td>${esc(st.model)} · ${esc(st.release || '')}<br>${st.pack ? `${st.pack.cards} cartes/booster · ${st.pack.box} boosters/boîte` : ''}</td></tr>` : ''}
      ${o ? `<tr><td>Origine Chine</td><td><b>${esc(o.name)}</b><br>Boîte ${esc(o.box)}, cartes ${esc(o.codePrefix)}-…<br>${esc(o.pack)} · ${esc(o.price)}<br><span class="mu">${esc(o.note)}</span></td></tr>` : ''}
      ${st.source ? `<tr><td>Source</td><td class="mu">${esc(st.source)}</td></tr>` : ''}
      <tr><td>Contenu</td><td>${st.cards.length} cartes, ${st.rarities.length} raretés</td></tr></table></section>
    <section class="box"><h2>Ne pas confondre</h2>
      <p><b>Tier / Wave</b> (T1…T4, ex. « T2W1 », boosters de 1 à 10 ¥) : gamme chinoise. Certaines séries internationales reprennent les illustrations d'une wave chinoise (Heaven Scroll S1 ↔ T4W6), mais numérotation, promos et taux diffèrent : deux collections séparées dans l'app.</p>
      <p><b>« Heaven & Earth Scroll »</b> (Chine) : autre produit, liste différente.</p></section>`;
  },
  async q(qs = '') {
    await loadAll();
    return `<div class="tools"><input id="gq" type="search" placeholder="Nom (FR/EN/中文) ou code, tous les sets" value="${esc(qs)}" autocomplete="off"></div><div class="mu" id="gcnt"></div><div class="grid" id="gres"></div>`;
  },
  async m() {
    await Promise.all(S.sets.filter(m => m.status === 'ok' && ownedIn(m.id)).map(m => loadSet(m.id)));
    const f = S.mf, sets = S.sets.filter(m => S.data[m.id] && ownedIn(m.id));
    const rars = [...new Set(allCards().filter(qty).map(c => c.rarity))];
    const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
    return `<div class="tools"><div class="sel">
      <select id="mg" class="${f.g ? 'on' : ''}">${opt('', 'Gamme', f.g)}${opt('intl', 'France / Inter.', f.g)}${opt('cn', 'Chine', f.g)}</select>
      <select id="ms" class="${f.s ? 'on' : ''}">${opt('', 'Set', f.s)}${sets.map(m => opt(m.id, m.title, f.s)).join('')}</select>
      <select id="mr" class="${f.r ? 'on' : ''}">${opt('', 'Rareté', f.r)}${rars.map(r => opt(r, r, f.r)).join('')}</select>
      <select id="mt">${opt('p', 'Tri : prix', f.t)}${opt('r', 'Tri : rareté', f.t)}${opt('s', 'Tri : set', f.t)}</select></div></div>
      <div class="mu" id="mcnt"></div><div class="grid" id="mres"></div>`;
  },
  b(id, step) {
    if (!id) return `<p class="mu" style="margin:4px 0 12px">Choisis le set du booster ouvert</p><div class="cats">${S.sets.filter(m => m.status === 'ok').map(m => setTile(m, '#b/' + m.id)).join('')}</div>`;
    if (step === 'open') return views.reveal(id);
    return views.pack(id);
  },
  async pack(id) {
    const d = await loadSet(id); if (!d) return '';
    S.ctx = d.cards;
    return `<section class="box pk"><div class="pkh"><b>Booster : <span id="pn">0</span>/${PK(d)}</b><button class="btn" id="pv" disabled>Ouvrir ✦</button></div><div class="chips" id="pc"></div></section>
      <div id="pkg">${d.rarities.map(r => `<h3 class="gh">${esc(r.id)} · ${esc(r.label)}</h3><div class="grid g4">${d.cards.filter(c => c.rarity === r.id).map(c => tile(c).replace('class="c ', 'class="c b ')).join('')}</div>`).join('')}</div>`;
  },
  reveal(id) {
    const o = S.opened; if (!o || o.set !== id) { setTimeout(() => replaceTo('#b/' + id)); return ''; }
    return `<div class="reveal">${o.cards.map((c, i) => `<div class="flip" style="--d:${i * 0.45}s"><div class="fi"><div class="fb"></div><div class="ff ${land(c) ? 'l' : ''} ${isHigh(c) ? 'holo' : ''}">${img(c)}</div></div>
      <div class="fl">${o.isNew[i] ? '<b class="nw">NOUVELLE</b>' : '<span class="mu">doublon</span>'} <span class="rb ${esc(c.rarity)}">${esc(c.rarity)}</span></div></div>`).join('')}</div>
      <section class="box recap" style="--d:${o.cards.length * 0.45 + 0.3}s"><h2>Récap</h2>
      <div class="row"><span>Nouvelles cartes</span><b>${o.isNew.filter(Boolean).length}</b></div>
      <div class="row"><span>Doublons</span><b>${o.isNew.filter(x => !x).length}</b></div>
      <div class="row"><span>Valeur estimée du booster</span><b>${eur(o.cards.reduce((a, c) => a + (price(c)?.median || 0), 0))}</b></div>
      <p class="note">Valeur = somme des médianes eBay disponibles (${o.cards.filter(price).length}/${o.cards.length} cartes avec un prix).</p>
      <a class="btn w" href="#b/${id}" data-replace>Nouveau booster</a><a class="btn g w" href="#s/${id}">Voir le set</a></section>`;
  },
  r() {
    return `<section class="box"><h2>Sauvegarde</h2><p class="mu">Ta collection est stockée sur ce téléphone (IndexedDB). Exporte-la régulièrement.</p>
      <button class="btn w" id="ex">⤓ Exporter (JSON)</button>
      <label class="btn g w">⤒ Importer un backup<input id="im" type="file" accept="application/json,.json" hidden></label></section>
    <section class="box"><h2>Prix</h2><p class="mu">${pDate() || 'Aucun prix'} — ${S.prices ? Object.values(S.prices.cards).filter(p => p.n).length : 0} cartes avec au moins une annonce. Estimation basée sur les annonces eBay actives, pas une cote officielle.</p>
      <button class="btn g w" id="refresh">↻ Actualiser</button></section>
    <section class="box"><h2>Données</h2><p class="mu">Cartes internationales : kayouofficial.com. Chine : ${esc(S.setsSrc)}.</p></section>`;
  }
};
const PK = d => (d.pack && d.pack.cards) || 8;
const tile = c => `<div class="c ${land(c) ? 'l' : ''} ${qty(c) ? '' : 'no'}" data-k="${esc(c.set + '/' + c.code)}">${img(c)}${qty(c) ? `<span class="q">×${qty(c)}</span>` : ''}<span class="n">${esc(c.rarity)} · ${esc(c.name)}</span></div>`;
const byKey = k => { const [s, c] = k.split('/'); return S.data[s] && S.data[s].cards.find(x => x.code === c); };
function refreshTile(el) { const c = byKey(el.dataset.k), n = document.createElement('div'); n.innerHTML = tile(c); const nc = n.firstChild; if (el.classList.contains('b')) nc.classList.add('b'); el.replaceWith(nc); return nc; }

/* appui court = ouvrir, appui long = +1 */
function press(el, onTap, onLong) {
  let t, x, y, fired, moved;
  el.addEventListener('pointerdown', e => { if (!e.target.closest('.c')) return; fired = moved = false; x = e.clientX; y = e.clientY; t = setTimeout(() => { fired = true; onLong(e.target.closest('.c')); }, 450); });
  el.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x, e.clientY - y) > 10) { moved = true; clearTimeout(t); } });
  el.addEventListener('pointerup', e => { clearTimeout(t); const c = e.target.closest('.c'); if (c && !fired && !moved) onTap(c); });
  el.addEventListener('pointercancel', () => clearTimeout(t));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
const openCard = c => go(`#${curBase}!${c.dataset.k}`);
const longAdd = c => { const card = byKey(c.dataset.k); add(card); vib(25); refreshTile(c).classList.add('pop'); toast(`+1 ${card.name} (×${qty(card)})`); };

const binds = {
  s(id) {
    press($('#secs'), openCard, longAdd);
    V.querySelectorAll('.chipsel button').forEach(b => b.onclick = () => { S.filt.o = b.dataset.o; curBase = null; route(); });
    V.querySelectorAll('details.sec').forEach(d => d.addEventListener('toggle', () => {
      const cl = [...V.querySelectorAll('details.sec:not([open])')].map(x => x.dataset.r); sessionStorage.setItem('closed:' + id, JSON.stringify(cl));
    }));
  },
  q() {
    const inp = $('#gq'), draw = () => {
      const q = inp.value.trim().toLowerCase(); curBase = 'q/' + inp.value; history.replaceState(history.state, '', '#q/' + encodeURIComponent(inp.value));
      const res = q.length < 2 ? [] : allCards().filter(c => [c.name, c.nameCn, c.code, c.full, c.alias && c.alias.cn, c.alias && c.alias.eu].join(' ').toLowerCase().includes(q)).slice(0, 120);
      S.ctx = res; $('#gres').innerHTML = res.map(c => tile(c).replace(/<\/span><\/div>$/, ` · ${esc(meta(c.set).title)}</span></div>`)).join('');
      $('#gcnt').textContent = q.length < 2 ? 'Tape au moins 2 caractères.' : `${res.length} résultat${res.length > 1 ? 's' : ''}${res.length === 120 ? ' (120 max)' : ''}`;
    };
    inp.oninput = draw; draw(); if (!inp.value) inp.focus();
    press($('#gres'), openCard, longAdd);
  },
  m() {
    const draw = () => {
      const f = S.mf; let cs = allCards().filter(c => qty(c) && (!f.g || meta(c.set).region === f.g) && (!f.s || c.set === f.s) && (!f.r || c.rarity === f.r));
      cs.sort(f.t === 'p' ? (a, b) => (price(b)?.median ?? -1) - (price(a)?.median ?? -1) : f.t === 'r' ? (a, b) => rIdx(a) - rIdx(b) : (a, b) => S.sets.indexOf(meta(a.set)) - S.sets.indexOf(meta(b.set)) || a.n - b.n);
      S.ctx = cs; $('#mres').innerHTML = cs.map(c => tile(c).replace(/<\/span><\/div>$/, `${price(c) ? ' · ' + eur(price(c).median) : ''}</span></div>`)).join('');
      const tot = cs.reduce((a, c) => a + (price(c) ? price(c).median * qty(c) : 0), 0);
      $('#mcnt').textContent = cs.length ? `${cs.length} carte${cs.length > 1 ? 's' : ''} · ${cs.reduce((a, c) => a + qty(c), 0)} exemplaires · ${eur(tot)} estimés` : 'Aucune carte possédée pour ces filtres.';
    };
    [['mg', 'g'], ['ms', 's'], ['mr', 'r'], ['mt', 't']].forEach(([id, k]) => $('#' + id).onchange = e => { S.mf[k] = e.target.value; e.target.classList.toggle('on', !!e.target.value && k !== 't'); draw(); });
    draw(); press($('#mres'), openCard, longAdd);
  },
  b(id, step) {
    if (!id || step) return;
    const d = S.data[id];
    const draw = () => {
      $('#pn').textContent = S.pack.length; $('#pv').disabled = !S.pack.length;
      $('#pc').innerHTML = S.pack.map((k, i) => `<button class="chip" data-i="${i}">${esc(k.split('/')[1].replace(d.codePrefix + '-', ''))}</button>`).join('') || '<span class="mu">Tape les cartes tirées.</span>';
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
  r() {
    $('#ex').onclick = exportJSON;
    $('#im').onchange = e => e.target.files[0] && importJSON(e.target.files[0]);
  }
};
document.addEventListener('click', async e => {
  const r = e.target.closest('#refresh'); if (r) { await loadPrices(true); curBase = null; route(); return; }
  const a = e.target.closest('a[data-replace]'); if (a) { e.preventDefault(); replaceTo(a.getAttribute('href')); }
});

/* ---------- fiche carte (panneau) ---------- */
function oddsHTML(c) {
  const o = S.odds[c.set]; if (!o || !o.rarities) return '';
  const r = o.rarities[c.rarity] || { status: 'taux inconnu' }, n = S.data[c.set].rarities.find(x => x.id === c.rarity).count, B = o.boxPacks;
  const [pn, pd] = (r.possibleIn || '').split(':');
  let main, sub = '', card = '';
  if (r.k) {
    main = r.k >= 1 ? `${f1(r.k)} par booster (garanti)` : `1 chance sur ${f1(1 / r.k)} boosters`;
    sub = `environ ${f1(r.k * B)} par boîte de ${B}`;
    const pc = 1 - Math.pow(1 - 1 / n, r.k); card = `Cette carte : 1 chance sur ${f1(1 / pc)} boosters (≈ ${f1(pc * B)} par boîte)`;
  } else if (r.min) {
    main = 'taux exact inconnu'; sub = `au moins ${f1(r.min)} par booster · au moins ${f1(r.min * B)} par boîte (officiel)`;
    card = `Cette carte : au moins 1 chance sur ${f1(1 / (1 - Math.pow(1 - 1 / n, r.min)))} boosters`;
  } else main = 'taux inconnu';
  const shared = r.sharedWith ? `<p class="mu">Peut aussi sortir d'une case partagée avec ${r.sharedWith.map(esc).join(', ')} : ${f1(r.sharedSlots)} case(s) par booster (${f1(r.sharedSlots * B)} par boîte), répartition non publiée.</p>` : '';
  const poss = pn && pn !== pd ? `<p class="mu">Possible seulement dans ${pn} boosters sur ${pd}.</p>` : '';
  const pack = S.data[c.set].pack;
  return `<section class="box"><h2>Taux de drop — rareté ${esc(c.rarity)}</h2>
    <div class="big" style="${r.k ? '' : 'color:var(--mu)'}">${main}</div><div>${sub}</div>${poss}${shared}
    ${card ? `<p class="note">${card} (${n} cartes ${esc(c.rarity)}).</p>` : ''}
    <details class="note"><summary>Méthode, source et contrôle</summary><p>${esc(S.odds.method)}</p><p>Source : ${esc(o.source)}.</p>
    <p>Booster : ${o.packCards} cartes · boîte : ${B} boosters.${pack && pack.probabilities ? pack.probabilities.map(x => `<br>${esc(x.ratio)} : ${esc(x.slots)}`).join('') : ''}</p>
    <p>${(o.checks || []).map(esc).join('<br>')}</p><p>${esc(S.odds.openingData)}</p></details></section>`;
}
function sheetHTML(c) {
  const e = S.col[key(c)] || { q: 0, cond: 'NM' }, p = price(c), d = S.data[c.set], r = d.rarities.find(x => x.id === c.rarity), m = meta(c.set);
  const q = encodeURIComponent(`kayou naruto ${c.code}`), i = S.ctx.indexOf(c);
  const twin = (code, sid) => sid && meta(sid) && meta(sid).status === 'ok' ? `<a href="#${curBase}!${sid}/${esc(code)}" data-replace>${esc(code)}</a>` : esc(code);
  return `<div class="grab"></div>
    <div class="det"><div class="card3d ${land(c) ? 'l' : ''} ${isHigh(c) ? 'holo' : ''}" id="c3">${img(c)}</div></div>
    ${i >= 0 ? `<div class="nav"><button data-step="-1" ${i ? '' : 'disabled'}>‹</button><span class="mu">${i + 1}/${S.ctx.length} · glisse ← →</span><button data-step="1" ${i < S.ctx.length - 1 ? '' : 'disabled'}>›</button></div>` : ''}
    ${isHigh(c) && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission ? '<button class="btn g w" id="gyro">Activer l\'effet gyroscope</button>' : ''}
    <section class="box"><div style="font-size:20px;font-weight:800">${esc(c.name)}</div>${c.nameCn ? `<div>${esc(c.nameCn)}</div>` : ''}
      <div class="mu"><span class="rb ${esc(c.rarity)}">${esc(c.rarity)}</span> ${esc(r.label)} · ${esc(m.title)}</div>
      <table style="margin-top:10px"><tr><td>Code</td><td><b>${esc(c.full || c.code)}</b></td></tr>
      ${m.region === 'cn' && c.alias && c.alias.eu ? `<tr><td>Code EU</td><td>${twin(c.alias.eu, m.link)}</td></tr>` : ''}
      ${d.origin ? `<tr><td>Code CN</td><td>${c.alias.cn ? twin(c.alias.cn, m.link) : `<span class="mu">à compléter (${esc(d.origin.codePrefix)}-…)</span>`}</td></tr>` : ''}
      <tr><td>Possédée</td><td><b id="qv2">×${e.q}</b></td></tr></table></section>
    <section class="box">
      <div class="row"><span>Quantité</span><div class="qty"><button data-d="-1">−</button><b id="qv">${e.q}</b><button data-d="1">+</button></div></div>
      <div class="row"><span>Doublons</span><b id="dv">${Math.max(0, e.q - 1)}</b></div>
      <div class="row"><span>État</span><select id="cond">${CONDS.map(x => `<option${x === e.cond ? ' selected' : ''}>${x}</option>`).join('')}</select></div></section>
    <section class="box"><h2>Prix marché</h2>
      ${p ? `<div class="big">${eur(p.median)}</div><div class="mu">Médiane de ${p.n} annonce${p.n > 1 ? 's' : ''} eBay actives · ${pDate()}</div>
        ${p.markets ? `<div class="mu">${Object.entries(p.markets).map(([k, v]) => `${k} : ${eur(v.median)} (${v.n})`).join(' · ')}</div>` : ''}
        ${p.psa ? `<div class="mu" style="margin-top:6px">Gradées PSA : ${eur(p.psa.median)} (${p.psa.n} annonces)</div>` : ''}`
        : '<div class="big" style="color:var(--mu)">pas de prix</div><div class="mu">0 annonce trouvée lors de la dernière mise à jour.</div>'}
      <div class="note">Estimation basée sur les annonces eBay, jamais une cote officielle.</div>
      <div class="links" style="margin-top:10px">${['fr', 'de', 'com'].map(t => `<a class="btn g" target="_blank" rel="noopener" href="https://www.ebay.${t}/sch/i.html?_nkw=${q}">eBay ${t === 'com' ? 'US' : t.toUpperCase()}</a>`).join('')}</div></section>
    ${oddsHTML(c)}
    <section class="box"><h2>Ma photo</h2>
      <label class="btn w">📷 ${S.photos[key(c)] ? 'Remplacer ma photo' : 'Ajouter ma photo'}<input id="ph" type="file" accept="image/*" capture="environment" hidden></label>
      ${S.photos[key(c)] ? '<button class="btn g w" id="phx">Revenir à l\'image officielle</button>' : ''}</section>`;
}
let sheetCard = null;
function openSheet(c) {
  const wasOpen = SH.classList.contains('on');
  sheetCard = c; SB.innerHTML = sheetHTML(c); SB.scrollTop = 0;
  if (!wasOpen) { SH.hidden = false; void SH.offsetWidth; SH.classList.add('on'); document.documentElement.classList.add('lock'); }
  bindSheet(c);
}
function closeSheet() {
  if (SH.hidden) return;
  SH.classList.remove('on'); document.documentElement.classList.remove('lock'); SB.style.transform = '';
  const k = sheetCard && V.querySelector(`.c[data-k="${CSS.escape(sheetCard.set + '/' + sheetCard.code)}"]`); if (k) refreshTile(k);
  sheetCard = null; setTimeout(() => { if (!SH.classList.contains('on')) SH.hidden = true; }, 300);
}
function step(dir) {
  const i = S.ctx.indexOf(sheetCard), n = S.ctx[i + dir]; if (!n) return;
  SB.classList.add(dir > 0 ? 'sl' : 'sr'); setTimeout(() => SB.classList.remove('sl', 'sr'), 250);
  replaceTo(`#${curBase}!${n.set}/${n.code}`);
}
function bindSheet(c) {
  const k = key(c), c3 = $('#c3');
  SB.querySelectorAll('.qty button').forEach(b => b.onclick = () => { add(c, +b.dataset.d); $('#qv').textContent = qty(c); $('#qv2').textContent = '×' + qty(c); $('#dv').textContent = Math.max(0, qty(c) - 1); vib(15); });
  SB.querySelectorAll('.nav button').forEach(b => b.onclick = () => step(+b.dataset.step));
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
    const b = await shrink(f); await idb('photos', 'readwrite', s => s.put(b, k)); S.photos[k] = URL.createObjectURL(b); toast('Photo enregistrée'); openSheet(c);
  };
  if ($('#phx')) $('#phx').onclick = async () => { await idb('photos', 'readwrite', s => s.delete(k)); delete S.photos[k]; openSheet(c); };
}
/* gestes : glisser vers le bas pour fermer, gauche/droite pour carte suivante/précédente */
(() => {
  let x0, y0, dx, dy, mode;
  SB.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = dy = 0; mode = null; }, { passive: true });
  SB.addEventListener('touchmove', e => {
    const t = e.touches[0]; dx = t.clientX - x0; dy = t.clientY - y0;
    if (!mode && Math.hypot(dx, dy) > 12) mode = Math.abs(dx) > Math.abs(dy) ? 'h' : (dy > 0 && SB.scrollTop <= 0 ? 'v' : 's');
    if (mode === 'v') { e.preventDefault(); SB.style.transform = `translateY(${Math.max(0, dy)}px)`; }
    if (mode === 'h') SB.style.transform = `translateX(${dx * .4}px)`;
  }, { passive: false });
  SB.addEventListener('touchend', () => {
    SB.style.transform = '';
    if (mode === 'v' && dy > 110) back();
    else if (mode === 'h' && Math.abs(dx) > 70) step(dx < 0 ? 1 : -1);
  });
  $('#backdrop').onclick = back;
})();

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
  if (!location.hash || location.hash === '#menu') history.replaceState(history.state, '', '#c'); route();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
init();
