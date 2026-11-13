'use strict';
const $ = (s, r = document) => r.querySelector(s);
const V = $('#view');
const HIGH = ['SE', 'SP', 'BP', 'MR', 'PU', 'PTR', 'UR'];
const CONDS = ['Mint', 'NM', 'EX', 'GD', 'LP', 'PL', 'Abîmée'];
const S = { sets: [], set: null, col: {}, photos: {}, prices: null, odds: null, f: { q: '', r: '', o: '', p: '', s: 'n' }, pack: [] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = v => v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const qty2 = id => c => (S.col[id + '|' + c.code] || {}).q > 0;
const key = c => S.set.id + '|' + c.code;
const qty = c => (S.col[key(c)] || {}).q || 0;
const price = c => { const p = S.prices && S.prices.cards[c.code]; return p && p.n > 0 ? p : null; };
const rIdx = r => S.set.rarities.findIndex(x => x.id === r);
const land = c => c.rarity === 'R';

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
function add(c, d = 1) {
  const k = key(c), e = S.col[k] || (S.col[k] = { q: 0, cond: 'NM' });
  e.q = Math.max(0, e.q + d); saveCol(k);
}
function img(c, cls = '') {
  const ph = `<div class="ph">${esc(c.name)}<br>${c.code}</div>`;
  const src = S.photos[key(c)] || c.img;
  return src ? `<img class="${cls}" src="${src}" loading="lazy" referrerpolicy="no-referrer" alt="${esc(c.name)}" onerror="this.outerHTML=this.dataset.ph" data-ph='${ph.replace(/'/g, '&#39;')}'>` : ph;
}
function prog() {
  const own = S.set.cards.filter(c => qty(c) > 0);
  return { own, n: own.length, t: S.set.cards.length, val: S.set.cards.reduce((a, c) => a + (price(c) ? price(c).median * qty(c) : 0), 0) };
}
function pDate() { if (!S.prices || !S.prices.updated) return ''; const d = new Date(S.prices.updated); return `Prix du ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }

/* ---------- data ---------- */
async function loadPrices(force) {
  try {
    const r = await fetch('data/prices.json' + (force ? '?t=' + Date.now() : ''), { cache: 'no-store' });
    S.prices = await r.json(); if (force) toast('Prix actualisés');
  } catch { if (force) toast('Hors ligne : prix en cache'); }
  $('#pdate').textContent = pDate();
}
async function init() {
  S.sets = await (await fetch('data/sets.json')).json();
  S.odds = await (await fetch('data/odds.json')).json();
  S.col = await allOf('col');
  const ph = await allOf('photos');
  for (const k in ph) S.photos[k] = URL.createObjectURL(ph[k]);
  await loadPrices();
  if (!location.hash) location.hash = 'menu'; else route();
}
const sets = {};
async function loadSet(id) {
  const m = S.sets.find(x => x.id === id && x.status === 'ok'); if (!m) return false;
  S.set = sets[id] || (sets[id] = await (await fetch(m.file)).json());
  localStorage.setItem('set', id); return true;
}
const fmtX = x => x <= 1 ? '≥ 1 par booster' : '1 sur ' + (x < 10 ? x.toFixed(1).replace('.', ',') : Math.round(x).toLocaleString('fr-FR'));
const perBox = (x, b) => { const v = x / b, f = y => (Math.round(y * 10) / 10).toString().replace('.', ','); return v < 1 ? `≈ ${f(1 / v)} par boîte de ${b}` : `≈ 1 boîte sur ${f(v)}`; };
function oddsHTML(c) {
  const o = S.odds[S.set.id]; if (!o) return '';
  const n = S.set.rarities.find(r => r.id === c.rarity).count;
  return `<section class="box"><h2>Chance de tirage</h2><table><tr><td></td>${Object.values(o).map(e => `<td><b>${e.label.replace('Édition ', '')}</b><br><span class="mu">${e.packCards} cartes/booster</span></td>`).join('')}</tr>
    <tr><td>Rareté ${c.rarity}</td>${Object.values(o).map(e => { const r = e.rarities[c.rarity]; return `<td>${r ? fmtX(1 / r.k) : '—'}</td>`; }).join('')}</tr>
    <tr><td>Cette carte</td>${Object.values(o).map(e => { const r = e.rarities[c.rarity]; return `<td><b class="hl">${r ? fmtX(1 / (1 - Math.pow(1 - 1 / n, r.k))) : '—'}</b>${r && r.est ? '<br><span class="est">estimation</span>' : ''}${r ? `<br><span class="mu">${perBox(1 / (1 - Math.pow(1 - 1 / n, r.k)), e.boxPacks)}</span>` : ''}</td>`; }).join('')}</tr></table>
    <details class="note"><summary>Méthode et sources</summary><p>${esc(S.odds.method)}</p>${Object.values(o).map(e => `<p><b>${e.label}</b> — ${esc((e.rarities[c.rarity] || {}).src || 'n/a')}</p>`).join('')}</details></section>`;
}

/* ---------- views ---------- */
const views = {
  menu() {
    const last = localStorage.getItem('set');
    return `<p class="mu" style="margin:4px 0 12px">Choisis ta collection</p>${S.sets.map(m => {
      if (m.status !== 'ok') return `<div class="tile soon"><div class="cv">?</div><div><b>${esc(m.eu)}</b><div class="mu">${esc(m.euSub)}</div><span class="rb">Bientôt</span></div></div>`;
      const d = sets[m.id], own = d ? d.cards.filter(qty2(m.id)).length : Object.keys(S.col).filter(k => k.startsWith(m.id + '|') && S.col[k].q > 0).length;
      return `<a class="tile${m.id === last ? ' last' : ''}" href="#home" data-set="${m.id}"><div class="cv"><img src="${m.cover}" referrerpolicy="no-referrer" alt=""></div><div style="flex:1;min-width:0">
        <b>${esc(m.eu)}</b><div class="mu">${esc(m.euSub)}</div><div class="cn"><b>${esc(m.cn)}</b><div class="mu">${esc(m.cnSub)}</div></div>
        <div class="track" style="margin-top:8px"><i style="width:${own / m.count * 100}%"></i></div><div class="mu">${own}/${m.count}${m.id === last ? ' · dernière ouverte' : ''}</div></div></a>`;
    }).join('')}`;
  },
  home() {
    const p = prog(), pct = Math.round(p.n / p.t * 1000) / 10;
    const top = p.own.filter(price).sort((a, b) => price(b).median - price(a).median).slice(0, 5);
    return `<section class="box hero"><div class="ring" style="--p:${pct}"><div><b>${pct}%</b>${p.n}/${p.t}</div></div>
      <div><div class="mu">${esc(S.set.line)}</div><div style="font-weight:700">${esc(S.set.name)}</div>
      <div class="mu">Origine : ${esc(S.set.origin.name)}</div><a class="mu" href="#about">C'est quel set ?</a></div></section>
    <section class="box"><h2>Valeur estimée</h2><div class="big">${eur(p.val)}</div>
      <div class="note">Estimation basée sur les annonces eBay actives (médiane FR/DE/US), pas une cote officielle. ${pDate() || 'Aucun prix chargé.'}</div>
      <button class="btn g w" id="refresh">↻ Actualiser les prix</button></section>
    <section class="box"><h2>Par rareté</h2>${S.set.rarities.map(r => {
      const cs = S.set.cards.filter(c => c.rarity === r.id), o = cs.filter(c => qty(c)).length;
      return `<a class="bar" href="#cards" data-r="${r.id}" style="color:inherit;text-decoration:none"><span class="rb ${r.id}">${r.id}</span><span class="track"><i style="width:${o / cs.length * 100}%"></i></span><span>${o}/${cs.length}</span></a>`;
    }).join('')}</section>
    <section class="box"><h2>Top 5 de mes cartes</h2>${top.length ? top.map(c => `<a class="top" href="#card/${c.code}">${img(c)}<div><div>${esc(c.name)}</div><div class="mu">${c.code} · ×${qty(c)}</div></div><b>${eur(price(c).median)}</b></a>`).join('') : '<p class="mu">Ajoute des cartes pour voir ton top.</p>'}</section>`;
  },
  cards() {
    const f = S.f, chars = [...new Set(S.set.cards.map(c => c.name.replace(/ \d\/5$/, '')))].sort();
    const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
    return `<div class="tools"><input id="q" type="search" placeholder="Rechercher nom ou code…" value="${esc(f.q)}">
      <div class="sel">
      <select id="fr" class="${f.r ? 'on' : ''}">${opt('', 'Rareté')}${S.set.rarities.map(r => opt(r.id, r.id, f.r)).join('')}</select>
      <select id="fo" class="${f.o ? 'on' : ''}">${opt('', 'Toutes', f.o)}${opt('own', 'Possédées', f.o)}${opt('miss', 'Manquantes', f.o)}${opt('dup', 'Doublons', f.o)}</select>
      <select id="fp" class="${f.p ? 'on' : ''}">${opt('', 'Perso')}${chars.map(n => opt(n, n, f.p)).join('')}</select>
      <select id="fs">${opt('n', 'Tri : n°', f.s)}${opt('r', 'Tri : rareté', f.s)}${opt('p', 'Tri : prix', f.s)}</select>
      </div></div><div class="mu" id="cnt"></div><div class="grid" id="grid"></div>
      <p class="note">Appui long sur une carte = +1.</p>`;
  },
  card(code) {
    const c = S.set.cards.find(x => x.code === code); if (!c) return '<p>Carte introuvable.</p>';
    const e = S.col[key(c)] || { q: 0, cond: 'NM' }, p = price(c), r = S.set.rarities[rIdx(c.rarity)];
    const q = encodeURIComponent(`kayou naruto ${c.code}`), qcn = encodeURIComponent(`kayou naruto T4W6 ${c.rarity} ${c.name.replace(/ \d\/5$/, '')}`);
    return `<div class="det"><div class="card3d ${land(c) ? 'l' : ''} ${HIGH.includes(c.rarity) ? 'holo' : ''}" id="c3">${img(c)}</div></div>
    ${HIGH.includes(c.rarity) && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission ? '<button class="btn g w" id="gyro" style="margin:-6px 0 12px">Activer l\'effet gyroscope</button>' : ''}
    <section class="box"><div style="font-size:20px;font-weight:800">${esc(c.name)}</div>
      <div class="mu">${c.code} · <span class="rb ${c.rarity}">${c.rarity}</span> ${esc(r.label)}</div>
      <table style="margin-top:10px"><tr><td>Code EU</td><td><b>${c.alias.eu}</b></td></tr><tr><td>Code CN</td><td>${c.alias.cn ? '<b>' + c.alias.cn + '</b>' : '<span class="mu">à compléter (' + S.set.origin.codePrefix + '-…)</span>'}</td></tr>
      <tr><td>Possédée</td><td><b id="qv2">×${e.q}</b></td></tr></table></section>
    <section class="box">
      <div class="row"><span>Quantité</span><div class="qty"><button data-d="-1">−</button><b id="qv">${e.q}</b><button data-d="1">+</button></div></div>
      <div class="row"><span>Doublons</span><b id="dv">${Math.max(0, e.q - 1)}</b></div>
      <div class="row"><span>État</span><select id="cond">${CONDS.map(x => `<option${x === e.cond ? ' selected' : ''}>${x}</option>`).join('')}</select></div></section>
    <section class="box"><h2>Prix marché</h2>
      ${p ? `<div class="big">${eur(p.median)}</div><div class="mu">Médiane de ${p.n} annonce${p.n > 1 ? 's' : ''} eBay actives · ${pDate()}</div>
        ${p.markets ? `<div class="mu">${Object.entries(p.markets).map(([m, v]) => `${m} : ${eur(v.median)} (${v.n})`).join(' · ')}</div>` : ''}
        ${p.psa ? `<div class="mu" style="margin-top:6px">Gradées PSA : ${eur(p.psa.median)} (${p.psa.n} annonces)</div>` : ''}`
        : '<div class="big" style="color:var(--mu)">pas de prix</div><div class="mu">0 annonce trouvée lors de la dernière mise à jour.</div>'}
      <div class="note">Estimation basée sur les annonces eBay, jamais une cote officielle.</div>
      <div class="links" style="margin-top:10px">
        <a class="btn g" target="_blank" rel="noopener" href="https://www.ebay.fr/sch/i.html?_nkw=${q}">eBay FR</a>
        <a class="btn g" target="_blank" rel="noopener" href="https://www.ebay.de/sch/i.html?_nkw=${q}">eBay DE</a>
        <a class="btn g" target="_blank" rel="noopener" href="https://www.ebay.com/sch/i.html?_nkw=${q}">eBay US</a>
        <a class="btn g" target="_blank" rel="noopener" href="https://www.ebay.com/sch/i.html?_nkw=${qcn}">Version CN (T4W6)</a></div></section>
    ${oddsHTML(c)}
    <section class="box"><h2>Ma photo</h2>
      <label class="btn w">📷 ${S.photos[key(c)] ? 'Remplacer ma photo' : 'Prendre ma carte en photo'}<input id="ph" type="file" accept="image/*" capture="environment" hidden></label>
      ${S.photos[key(c)] ? '<button class="btn g w" id="phx">Revenir à l\'image officielle</button>' : ''}</section>`;
  },
  booster() {
    return `<section class="box pk"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Booster : <span id="pn">${S.pack.length}</span>/8</b>
      <button class="btn" id="pv" ${S.pack.length ? '' : 'disabled'}>Valider</button></div>
      <div class="chips" id="pc"></div></section>
      <div class="tools" style="position:static"><input id="bq" type="search" placeholder="Filtrer (nom, code, rareté)…"></div>
      <div class="grid" id="bg"></div>`;
  },
  more() {
    return `<section class="box"><h2>Sauvegarde</h2><p class="mu">Ta collection est stockée sur ce téléphone (IndexedDB). Exporte-la régulièrement.</p>
      <button class="btn w" id="ex">⤓ Exporter (JSON)</button>
      <label class="btn g w">⤒ Importer un backup<input id="im" type="file" accept="application/json,.json" hidden></label></section>
    <section class="box"><h2>Set</h2>${S.sets.length > 1 ? `<select id="ss" class="btn g w">${S.sets.map(s => `<option value="${s.id}"${s.id === S.set.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : `<p>${esc(S.set.name)}</p>`}
      <a class="btn g w" href="#about">C'est quel set ?</a></section>
    <section class="box"><h2>Prix</h2><p class="mu">${pDate() || 'Aucun prix'} — ${S.prices ? Object.values(S.prices.cards).filter(p => p.n).length : 0} cartes avec au moins une annonce.</p>
      <button class="btn g w" id="refresh">↻ Actualiser</button></section>`;
  },
  about() {
    const o = S.set.origin;
    return `<section class="box"><h2>C'est quel set ?</h2>
      <table><tr><td>Nom FR/EU</td><td><b>${esc(S.set.name)}</b><br>${esc(S.set.line)}</td></tr>
      <tr><td>Code cartes</td><td><b>${S.set.codePrefix}</b>-RARETÉ-NNN (+ suffixe L1…L5 imprimé)<br><span class="mu">ex. NRSA01-SSR-019L3</span></td></tr>
      <tr><td>Origine Chine</td><td><b>${esc(o.name)}</b><br>Boîte ${o.box}, cartes ${o.codePrefix}-…<br>${o.pack} · ${o.price}<br><span class="mu">${esc(o.note)}</span></td></tr>
      <tr><td>Contenu</td><td>${S.set.cards.length} cartes, 10 raretés, booster 8 cartes, épisodes 1-19 (arc du Pays des Vagues)</td></tr></table></section>
    <section class="box"><h2>Ne pas confondre</h2>
      <p><b>Tier / Wave</b> (T1…T5, W1…W8, boosters à 1, 2, 5… yuans, ex. « T2W1 ») : gamme chinoise d'origine. Heaven Scroll est la version internationale <b>adaptée de T4W6</b> : même base d'illustrations, mais numérotation, cartes promo et taux différents (5 cartes/booster à 10 ¥ et 18 boosters/boîte en Chine). Une carte T4W6 ≠ une carte NRSA01 : prix et codes différents.</p>
      <p><b>« Heaven & Earth Scroll »</b> (Chine, 2023) : autre produit, liste différente.</p>
      <p><b>Earth Scroll</b> (NRI01 / NREA02 / NREA03) : autres séries Smriti, ère Boruto.</p>
      <p class="note">Pour chercher sur eBay : tape le code complet (ex. « NRSA01-SSR-019 »). Pour la version chinoise : « Kayou Naruto T4W6 » + rareté + perso. Numérotation déduite de l'ordre du site officiel Kayou : à vérifier sur ta carte.</p></section>`;
  }
};

/* ---------- grid ---------- */
function filtered() {
  const f = S.f, q = f.q.toLowerCase();
  let cs = S.set.cards.filter(c => (!f.r || c.rarity === f.r) && (!f.p || c.name.replace(/ \d\/5$/, '') === f.p)
    && (!q || (c.name + ' ' + c.code).toLowerCase().includes(q))
    && (!f.o || (f.o === 'own' ? qty(c) : f.o === 'miss' ? !qty(c) : qty(c) > 1)));
  if (f.s === 'p') cs = cs.slice().sort((a, b) => (price(b) ? price(b).median : -1) - (price(a) ? price(a).median : -1));
  if (f.s === 'r') cs = cs.slice().sort((a, b) => rIdx(a.rarity) - rIdx(b.rarity) || a.n - b.n);
  return cs;
}
const tile = c => `<div class="c ${land(c) ? 'l' : ''} ${qty(c) ? '' : 'no'}" data-k="${c.code}">${img(c)}${qty(c) ? `<span class="q">×${qty(c)}</span>` : ''}<span class="n">${c.rarity} · ${esc(c.name)}</span></div>`;
function drawGrid() {
  const cs = filtered(); $('#grid').innerHTML = cs.map(tile).join('');
  $('#cnt').textContent = `${cs.length} carte${cs.length > 1 ? 's' : ''} · ${cs.filter(qty).length} possédée${cs.filter(qty).length > 1 ? 's' : ''}`;
}
function press(el, onTap, onLong) {
  let t, x, y, fired, moved;
  el.addEventListener('pointerdown', e => {
    const c = e.target.closest('.c'); if (!c) return;
    fired = moved = false; x = e.clientX; y = e.clientY;
    t = setTimeout(() => { fired = true; onLong(c); }, 450);
  });
  el.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x, e.clientY - y) > 10) { moved = true; clearTimeout(t); } });
  ['pointerup', 'pointercancel'].forEach(ev => el.addEventListener(ev, e => {
    clearTimeout(t); const c = e.target.closest('.c');
    if (ev === 'pointerup' && c && !fired && !moved) onTap(c);
  }));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
const byCode = k => S.set.cards.find(c => c.code === k);

/* ---------- wiring ---------- */
const binds = {
  home() {}, menu() {},
  cards() {
    drawGrid();
    $('#q').oninput = e => { S.f.q = e.target.value; drawGrid(); };
    [['fr', 'r'], ['fo', 'o'], ['fp', 'p'], ['fs', 's']].forEach(([id, k]) => $('#' + id).onchange = e => {
      S.f[k] = e.target.value; e.target.classList.toggle('on', !!e.target.value && k !== 's'); drawGrid();
    });
    press($('#grid'), c => location.hash = 'card/' + c.dataset.k, c => {
      const card = byCode(c.dataset.k); add(card); navigator.vibrate && navigator.vibrate(25);
      const n = document.createElement('div'); n.innerHTML = tile(card); const nc = n.firstChild; nc.classList.add('pop'); c.replaceWith(nc);
      toast(`+1 ${card.name} (×${qty(card)})`);
    });
  },
  card(code) {
    const c = byCode(code); if (!c) return;
    const k = key(c), c3 = $('#c3');
    document.querySelectorAll('.qty button').forEach(b => b.onclick = () => {
      add(c, +b.dataset.d); $('#qv').textContent = qty(c); $("#dv").textContent = Math.max(0, qty(c) - 1); $("#qv2").textContent = "×" + qty(c);
      navigator.vibrate && navigator.vibrate(15);
    });
    $('#cond').onchange = e => { (S.col[k] || (S.col[k] = { q: 0 })).cond = e.target.value; saveCol(k); };
    const tilt = (px, py) => { c3.style.setProperty('--mx', px * 100 + '%'); c3.style.setProperty('--my', py * 100 + '%'); c3.style.setProperty('--ry', (px - .5) * 24 + 'deg'); c3.style.setProperty('--rx', (.5 - py) * 24 + 'deg'); };
    if (HIGH.includes(c.rarity)) {
      c3.onpointermove = e => { const r = c3.getBoundingClientRect(); tilt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
      c3.onpointerleave = () => tilt(.5, .5);
      const og = e => { if (e.gamma == null || !document.body.contains(c3)) return; tilt(Math.min(1, Math.max(0, .5 + e.gamma / 60)), Math.min(1, Math.max(0, .5 + (e.beta - 45) / 60))); };
      const on = () => { removeEventListener('deviceorientation', window._og || (() => {})); window._og = og; addEventListener('deviceorientation', og); };
      if ($('#gyro')) $('#gyro').onclick = () => DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') { on(); $('#gyro').remove(); } });
      else on();
    }
    $('#ph').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const b = await shrink(f); await idb('photos', 'readwrite', s => s.put(b, k));
      S.photos[k] = URL.createObjectURL(b); toast('Photo enregistrée'); route();
    };
    if ($('#phx')) $('#phx').onclick = async () => { await idb('photos', 'readwrite', s => s.delete(k)); delete S.photos[k]; route(); };
  },
  booster() {
    const draw = () => {
      $('#pn').textContent = S.pack.length; $('#pv').disabled = !S.pack.length;
      $('#pc').innerHTML = S.pack.map((k, i) => `<button class="chip" data-i="${i}">${k.replace(S.set.codePrefix + '-', '')}</button>`).join('') || '<span class="mu">Tape les cartes tirées ci-dessous.</span>';
    };
    const grid = () => {
      const q = $('#bq').value.toLowerCase();
      $('#bg').innerHTML = S.set.cards.filter(c => !q || (c.name + ' ' + c.code).toLowerCase().includes(q)).map(c => tile(c).replace('class="c ', 'class="c b ').replace(' no"', '"')).join('');
    };
    draw(); grid(); $('#bq').oninput = grid;
    press($('#bg'), c => {
      if (S.pack.length >= 8) return toast('8 cartes max — valide le booster');
      S.pack.push(c.dataset.k); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
      navigator.vibrate && navigator.vibrate(15); draw();
    }, () => {});
    $('#pc').onclick = e => { const b = e.target.closest('.chip'); if (b) { S.pack.splice(+b.dataset.i, 1); draw(); } };
    $('#pv').onclick = () => { S.pack.forEach(k => add(byCode(k))); toast(`+${S.pack.length} cartes ajoutées`); S.pack = []; draw(); };
  },
  more() {
    $('#ex').onclick = exportJSON;
    $('#im').onchange = e => e.target.files[0] && importJSON(e.target.files[0]);
    if ($('#ss')) $('#ss').onchange = e => { localStorage.setItem('set', e.target.value); location.reload(); };
  },
  about() {}
};

async function route() {
  const [v, arg] = (location.hash.slice(1) || 'menu').split('/');
  let name = views[v] ? v : 'menu';
  if (name !== 'menu' && !S.set && !(await loadSet(localStorage.getItem('set')))) name = 'menu';
  document.body.classList.toggle('m', name === 'menu');
  V.innerHTML = views[name](arg); V.style.animation = 'none'; void V.offsetWidth; V.style.animation = '';
  binds[name](arg);
  const r = $('#refresh'); if (r) r.onclick = async () => { await loadPrices(true); route(); };
  const sub = name === 'card' || name === 'about';
  $('#back').hidden = !sub;
  $('#title').innerHTML = name === 'menu' ? 'Kayou <b>Dex</b>' : name === 'card' ? esc(arg) : name === 'about' ? "C'est quel set ?" : 'Kayou <b>Dex</b>';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === name));
  if (!sub) scrollTo(0, 0);
}
$('#back').onclick = () => history.length > 1 ? history.back() : (location.hash = 'cards');
$('#menu').onclick = () => location.hash = 'menu';
document.addEventListener('click', async e => {
  const t = e.target.closest('a[data-set]'); if (t) { e.preventDefault(); await loadSet(t.dataset.set); location.hash = 'home'; return; }
  const a = e.target.closest('a[data-r]'); if (a) { S.f = { q: '', r: a.dataset.r, o: '', p: '', s: 'n' }; } });
addEventListener('hashchange', route);

/* ---------- photos / backup ---------- */
function shrink(f) {
  return new Promise(res => {
    const im = new Image(); im.onload = () => {
      const m = 900 / Math.max(im.width, im.height), s = Math.min(1, m), cv = document.createElement('canvas');
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `kayoudex-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  toast('Backup exporté');
}
async function importJSON(f) {
  try {
    const d = JSON.parse(await f.text()); if (d.app !== 'kayoudex') throw 0;
    if (!confirm('Remplacer la collection actuelle par ce backup ?')) return;
    await idb('col', 'readwrite', s => s.clear()); await idb('photos', 'readwrite', s => s.clear());
    await idb('col', 'readwrite', s => { for (const k in d.col) s.put(d.col[k], k); });
    const blobs = {}; for (const k in d.photos || {}) blobs[k] = await (await fetch(d.photos[k])).blob();
    await idb('photos', 'readwrite', s => { for (const k in blobs) s.put(blobs[k], k); });
    toast('Backup importé'); setTimeout(() => location.reload(), 600);
  } catch { toast('Fichier invalide'); }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
init();
