/* Wheel UI: drawing, spin animation, result screen, staff panel, persistence. */
(function () {
  'use strict';
  const CFG = window.ROUE_CONFIG;
  const L = window.RoueLogic;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'roue-shikshakshok-v1';
  const R_SLICE = 220;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  // ---------- persistence (survives a page refresh / laptop sleep) ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        // New prizes added to config after the first run get their stock seeded.
        for (const p of CFG.prizes) if (p.stock != null && s.stock[L.stockKey(p)] == null) s.stock[L.stockKey(p)] = p.stock;
        return s;
      }
    } catch (e) { /* private mode / blocked storage: run in memory */ }
    return L.emptyState(CFG.prizes);
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* in-memory only */ }
  }

  let state = loadState();
  // Test mode (config.js testMode or ?test in the URL): equal chances, caps/stock ignored, nothing saved.
  const TEST = CFG.testMode === true || /[?&]test/.test(location.search);

  /** Prizes on the wheel right now. In test mode: every prize of this mode, all with weight 1. */
  function currentPrizes(now) {
    if (TEST) return CFG.prizes.filter((p) => p.modes.includes(state.mode)).map((p) => ({ ...p, weight: 1 }));
    return L.availablePrizes(CFG.prizes, state, state.mode, now);
  }
  let rotation = 0;          // current wheel rotation, degrees clockwise
  let currentSlices = [];
  let spinning = false;
  let idleRaf = 0;

  const svgEl = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };
  const polar = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  };

  // ---------- drawing ----------
  function sliceFill(prize, i) {
    if (prize.kind === 'jackpot') return 'url(#g-jackpot)';
    if (prize.kind === 'big') return 'url(#g-gold)';
    if (prize.kind === 'again') return '#fff6e6';
    if (prize.kind === 'none') return '#1a0405';      // the "nothing" slice: near-black
    return i % 2 ? '#3d0507' : '#7a0c10';
  }
  function labelColor(prize) {
    if (prize.kind === 'none') return '#d9b98f';
    return prize.kind === 'small' ? '#ffe3a3' : '#3d0507';
  }

  function drawWheel() {
    const available = currentPrizes(Date.now());
    currentSlices = L.slices(available);
    const rotor = $('rotor');
    rotor.textContent = '';

    currentSlices.forEach((s, i) => {
      const { prize, start, end } = s;
      const sweep = end - start;
      const g = svgEl('g', { 'data-id': prize.id });
      if (prize.kind === 'jackpot') g.setAttribute('class', 'jackpot-slice');

      let shape;
      if (currentSlices.length === 1) {
        shape = svgEl('circle', { r: R_SLICE });
      } else {
        const [x1, y1] = polar(R_SLICE, start);
        const [x2, y2] = polar(R_SLICE, end);
        shape = svgEl('path', {
          d: `M0 0 L${x1.toFixed(3)} ${y1.toFixed(3)} A${R_SLICE} ${R_SLICE} 0 ${sweep > 180 ? 1 : 0} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`,
        });
      }
      shape.setAttribute('fill', sliceFill(prize, i));
      shape.setAttribute('stroke', '#a8742a');
      shape.setAttribute('stroke-width', '1.5');
      g.appendChild(shape);

      // Label along the radius. Font size follows the slice width so thin slices stay legible-ish.
      const mid = start + sweep / 2;
      const rText = 148; // centred between the badge (r≈74) and the rim (r=220)
      const arc = (2 * Math.PI * rText * sweep) / 360;
      const size = Math.min(30, arc * 0.62);
      const [tx, ty] = polar(rText, mid);
      if (size >= 11) {
        const t = svgEl('text', {
          class: 'slice-label', x: tx.toFixed(2), y: ty.toFixed(2),
          fill: labelColor(prize), 'font-size': size.toFixed(1),
          transform: `rotate(${(mid - 90).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})`,
        });
        t.textContent = prize.label;
        g.appendChild(t);
        // Shrink if the word is longer than the radius allows.
        requestAnimationFrame(() => {
          const max = 132;
          const len = t.getComputedTextLength ? t.getComputedTextLength() : 0;
          if (len > max) t.setAttribute('font-size', (size * max / len).toFixed(1));
        });
      }
      rotor.appendChild(g);
    });
    applyRotation();
  }

  function drawBulbs() {
    const g = $('bulbs');
    const n = 28;
    for (let i = 0; i < n; i++) {
      const [x, y] = polar(228, (360 / n) * i + 360 / n / 2);
      g.appendChild(svgEl('circle', { class: 'bulb', cx: x.toFixed(2), cy: y.toFixed(2), r: 5.2 }));
    }
  }
  let bulbTimer = 0;
  function chaseBulbs(ms) {
    clearInterval(bulbTimer);
    const bulbs = document.querySelectorAll('.bulb');
    let phase = 0;
    bulbTimer = setInterval(() => {
      phase = (phase + 1) % 3;
      bulbs.forEach((b, i) => b.classList.toggle('off', i % 3 !== phase));
    }, ms);
  }

  function applyRotation() {
    $('rotor').setAttribute('transform', `rotate(${rotation.toFixed(3)})`);
  }

  // Slow drift while nobody is playing — a still wheel doesn't catch the eye in a corridor.
  function idle() {
    cancelAnimationFrame(idleRaf);
    if (reduceMotion) return;
    let last = performance.now();
    const step = (t) => {
      rotation += (t - last) * 0.006;
      last = t;
      applyRotation();
      idleRaf = requestAnimationFrame(step);
    };
    idleRaf = requestAnimationFrame(step);
  }

  // ---------- spin ----------
  function sliceIndexAtPointer(rot) {
    const a = (((-rot) % 360) + 360) % 360;
    return currentSlices.findIndex((s) => a >= s.start && a < s.end);
  }

  function tickPointer() {
    const p = $('pointer');
    p.classList.remove('tick');
    void p.getBBox(); // restart the CSS animation
    p.classList.add('tick');
    if (window.RoueSound) window.RoueSound.tick();
  }

  function spin() {
    if (spinning || !$('result').hidden || !$('staff').hidden || !$('pin').hidden) return;
    if (!currentSlices.length) return;
    spinning = true;
    cancelAnimationFrame(idleRaf);
    $('spin').disabled = true;
    document.body.classList.add('spinning');
    if (window.RoueSound) window.RoueSound.spinStart();

    const now = Date.now();
    const prizes = currentSlices.map((s) => s.prize);
    const idx = L.pickIndex(prizes, L.secureRandom);      // the WEIGHTS decide; slices are only drawing
    const slice = currentSlices[idx];
    const chance = L.effectiveOdds(prizes)[idx].p;
    const target = L.rotationFor(rotation, L.landingAngle(slice, L.secureRandom), reduceMotion ? 2 : 7);
    if (!TEST) {                             // test spins are never recorded
      L.recordSpin(state, slice.prize, now); // record before the animation: a refresh mid-spin can't replay a jackpot
      const entry = L.logEntry(state, slice.prize, chance, now, CFG.deviceName);
      state.last = { id: slice.prize.id, at: now, day: L.todayKey(now), n: entry.n };
      saveState();
      writeLiveLog();
    }

    const from = rotation;
    const duration = reduceMotion ? 1800 : 6200 + L.secureRandom() * 900;
    const t0 = performance.now();
    let lastIdx = sliceIndexAtPointer(from);
    chaseBulbs(70);

    const frame = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 4); // fast start, long suspenseful slow-down
      rotation = from + (target - from) * eased;
      applyRotation();
      const i = sliceIndexAtPointer(rotation);
      if (i !== lastIdx) { lastIdx = i; tickPointer(); }
      if (k < 1) requestAnimationFrame(frame);
      else finish(slice.prize);
    };
    requestAnimationFrame(frame);
  }

  function finish(prize) {
    chaseBulbs(500);
    document.body.classList.remove('spinning');
    // Flash the winning slice under the pointer, then reveal the result.
    const g = document.querySelector(`#rotor g[data-id="${prize.id}"]`);
    if (g) g.classList.add('winner');
    if (window.RoueSound) { window.RoueSound.spinEnd(); window.RoueSound.result(prize.kind, prize); }
    setTimeout(() => {
      if (g) g.classList.remove('winner');
      spinning = false;
      showResult(prize);
    }, reduceMotion ? 0 : 1250);
  }

  // ---------- result ----------
  function showResult(prize) {
    const card = document.querySelector('.result-card');
    card.classList.toggle('jackpot', prize.kind === 'jackpot');
    card.classList.toggle('none', prize.kind === 'none');
    const again = prize.kind === 'again';
    const none = prize.kind === 'none';
    $('result-kicker').textContent = none ? 'يا خسارة…' : again ? 'يا خسارة… لا !' : prize.kind === 'jackpot' ? 'JACKPOT !!! مبروك' : 'مبروك !';
    animateLabel($('result-prize'), prize.label);
    $('result-sub').textContent = prize.sub || '';
    $('result-sub').hidden = !prize.sub;
    ['small', 'big', 'jackpot', 'again', 'none'].forEach((k) => card.classList.toggle('kind-' + k, prize.kind === k));
    // restart the entrance animations every time the card opens
    card.classList.remove('play'); void card.offsetWidth; card.classList.add('play');
    // wins show no extra line (the staff sees the screen anyway); only Rejoue / Pas de chance get one
    const hint = '';                                            // no extra line on any result
    $('result-hint').textContent = hint;
    $('result-hint').hidden = !hint;
    $('result-btn').textContent = again ? 'Tourne encore !' : 'Suivant';
    $('result-btn').dataset.again = again ? '1' : '';
    $('result').hidden = false;
    $('result-btn').focus();
    if (window.RoueDancers) window.RoueDancers.celebrate(prize.kind);
    document.body.classList.add('result-open');            // pauses the hidden background animations
    if (prize.kind === 'jackpot') confetti(200);           // rains until "Suivant"
    else if (prize.kind === 'big') confetti(120);
    else if (prize.kind === 'small') confetti(60);
  }

  /** Prize name, one <span> per letter so each letter can drop in and keep dancing.
   *  Arabic is never split (it would break the joined letters) and animates as one word. */
  function animateLabel(el, text) {
    el.textContent = '';
    el.setAttribute('aria-label', text);
    const whole = reduceMotion || /[؀-ۿ]/.test(text);
    el.classList.toggle('lettered', !whole);
    el.classList.toggle('long', text.length > 9);     // "Ticket offert", "Pas de chance": a bit smaller
    if (whole) { el.textContent = text; return; }
    // letters are grouped per word so a line can only break BETWEEN words, never inside one
    let i = 0;
    text.split(' ').forEach((word, w) => {
      if (w) el.appendChild(document.createTextNode(' '));
      const box = document.createElement('span');
      box.className = 'word';
      box.setAttribute('aria-hidden', 'true');
      for (const ch of Array.from(word)) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', i++);
        s.textContent = ch;
        box.appendChild(s);
      }
      el.appendChild(box);
      i++;                                          // small pause between words in the cascade
    });
  }

  function closeResult() {
    const again = $('result-btn').dataset.again === '1';
    $('result').hidden = true;
    document.body.classList.remove('result-open');
    stopConfetti();                                          // pieces fall away instead of vanishing
    if (window.RoueSound) window.RoueSound.stopClip(300);   // "Suivant" ends the result song
    drawWheel();               // availability may have changed (cap hit, stock used)
    $('spin').disabled = false;
    if (again) setTimeout(spin, 250);
    else idle();
  }

  // ---------- confetti ----------
  // Keeps raining as long as the win screen is open; on "Suivant" the pieces simply fall away.
  // Light on purpose: one canvas, no save/restore per piece, at most 1.5× pixel density.
  const CONF_COLORS = ['#f2c15b', '#ffe3a3', '#e0261b', '#fff6e6', '#a8742a'];
  const conf = { raf: 0, parts: [], active: false, ctx: null, w: 0, h: 0, dpr: 1 };

  function confPiece(scatter) {
    return {
      x: Math.random() * conf.w,
      y: scatter ? -20 - Math.random() * conf.h : -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 2.4, vy: 1.6 + Math.random() * 2.4,
      w: 6 + Math.random() * 8, h: 4 + Math.random() * 6,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25,
      color: CONF_COLORS[(Math.random() * CONF_COLORS.length) | 0],
    };
  }

  function confetti(count) {
    if (reduceMotion) return;
    const c = $('confetti');
    conf.dpr = Math.min(1.5, window.devicePixelRatio || 1);
    conf.w = innerWidth; conf.h = innerHeight;
    c.width = Math.round(conf.w * conf.dpr); c.height = Math.round(conf.h * conf.dpr);
    conf.ctx = c.getContext('2d');
    conf.parts = Array.from({ length: count }, () => confPiece(true));
    conf.active = true;
    if (!conf.raf) conf.raf = requestAnimationFrame(confFrame);
  }

  function confFrame() {
    const { ctx, dpr } = conf;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    let alive = 0;
    for (const p of conf.parts) {
      if (p.dead) continue;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (p.vy < 4.2) p.vy += 0.03;                       // gentle steady rain, not a fall
      if (p.y > conf.h + 20) {
        if (conf.active) Object.assign(p, confPiece(false)); // recycle at the top while the screen is open
        else { p.dead = true; continue; }
      }
      alive++;
      const cos = Math.cos(p.r) * dpr, sin = Math.sin(p.r) * dpr;
      ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    if (alive || conf.active) conf.raf = requestAnimationFrame(confFrame);
    else { conf.raf = 0; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
  }

  function stopConfetti() { conf.active = false; }

  // ---------- rules ----------
  // Drawn Instagram glyph (rounded square + lens + dot), gold to match the theme.
  function instagramIcon() {
    const s = svgEl('svg', { class: 'ig', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    s.appendChild(svgEl('rect', { x: 2.5, y: 2.5, width: 19, height: 19, rx: 5.5, fill: 'none', stroke: '#f2c15b', 'stroke-width': 2 }));
    s.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 4.4, fill: 'none', stroke: '#f2c15b', 'stroke-width': 2 }));
    s.appendChild(svgEl('circle', { cx: 17.4, cy: 6.6, r: 1.3, fill: '#f2c15b' }));
    return s;
  }

  function drawRules() {
    const ol = $('rules');
    ol.textContent = '';
    for (const r of CFG.rules[state.mode] || []) {
      const li = document.createElement('li');
      li.dir = 'auto';                       // Arabic rules flow right-to-left (number badge on the right)
      const text = typeof r === 'string' ? r : r.text;
      if (/[؀-ۿ]/.test(text)) li.classList.add('ar');   // Arabic → readable Cairo font
      if (typeof r === 'string') {
        li.textContent = r;
      } else {
        // { text, instagram }: "Follow le Comité des étudiants" + icon + @handle
        const box = document.createElement('span');
        box.className = 'rule-ig';
        const t = document.createElement('span');
        t.textContent = r.text;
        let line;
        if (r.url && /^https:\/\//.test(r.url)) {
          line = document.createElement('a');
          line.href = r.url;
          line.target = '_blank';            // new tab: the wheel stays open behind it
          line.rel = 'noopener noreferrer';
          line.setAttribute('aria-label', `${r.instagram} sur Instagram`);
        } else {
          line = document.createElement('span');
        }
        line.className = 'ig-line';
        const h = document.createElement('span');
        h.className = 'handle';
        h.dir = 'ltr';                       // keep "@handle" readable inside an Arabic line
        h.textContent = r.instagram;
        line.append(instagramIcon(), h);
        box.append(t, line);
        li.appendChild(box);
        if (r.qr && line.href) {
          // small QR code to the same page, for people who prefer scanning with their phone
          const qa = document.createElement('a');
          qa.className = 'rule-qr';
          qa.href = line.href;
          qa.target = '_blank';
          qa.rel = 'noopener noreferrer';
          qa.setAttribute('aria-label', `QR code — ${r.instagram} sur Instagram`);
          const img = document.createElement('img');
          img.src = r.qr;
          img.alt = '';
          img.draggable = false;
          qa.appendChild(img);
          li.appendChild(qa);
        }
      }
      ol.appendChild(li);
    }
  }

  // ---------- staff panel ----------
  function openPin() {
    if (spinning) return;
    $('pin').hidden = false;
    $('pin-input').value = '';
    $('pin-input').classList.remove('bad');
    setTimeout(() => $('pin-input').focus(), 30);
  }

  function renderStaff() {
    const now = Date.now();
    const usage = L.dayUsage(state, now);
    const available = currentPrizes(now);
    const odds = new Map(L.effectiveOdds(available).map((o) => [o.prize.id, o.p]));
    document.querySelectorAll('.seg').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));

    const price = CFG.event.ticketPrice || 0;
    const won = (id) => usage.won[id] || 0;
    // discounts are a % of the ticket price (discountPct in config.js), the jackpot is a whole ticket
    const discountCost = Math.round(CFG.prizes.reduce((t, p) =>
      t + won(p.id) * (p.discountPct ? price * p.discountPct / 100 : p.kind === 'jackpot' ? price : 0), 0));
    $('staff-stats').textContent =
      `Aujourd'hui (${L.todayKey(now)}) : ${usage.spins} tours · réductions + tickets offerts = ${discountCost} DT max (si tous achètent).`;

    const tbody = $('staff-rows');
    tbody.textContent = '';
    for (const p of CFG.prizes) {
      const tr = document.createElement('tr');
      let why = '';
      if (!p.modes.includes(state.mode)) why = 'pas dans ce mode';
      else if (p.stock != null && (state.stock[L.stockKey(p)] ?? p.stock) <= 0) why = 'stock vide';
      else if (p.dailyCap != null && won(p.id) >= p.dailyCap) why = 'limite du jour atteinte';
      else if (!odds.has(p.id)) why = 'en pause';
      if (why) tr.className = 'out';

      const cells = [
        p.label,
        odds.has(p.id) ? (odds.get(p.id) * 100).toFixed(1) + ' %' : '—',
        String(won(p.id)),
        p.dailyCap == null ? '∞' : String(p.dailyCap),
      ];
      for (const text of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      }
      if (why) {
        const s = document.createElement('div');
        s.className = 'why'; s.textContent = why;
        tr.firstChild.appendChild(s);
      }
      const tdStock = document.createElement('td');
      if (p.stock == null) tdStock.textContent = '∞';
      else {
        const minus = Object.assign(document.createElement('button'), { className: 'qty', type: 'button', textContent: '−' });
        const plus = Object.assign(document.createElement('button'), { className: 'qty', type: 'button', textContent: '+' });
        const val = document.createElement('span');
        const k = L.stockKey(p);           // duplicate slices (2 × Sticker) share one counter
        val.textContent = ` ${state.stock[k] ?? p.stock} `;
        minus.onclick = () => { state.stock[k] = Math.max(0, (state.stock[k] ?? p.stock) - 1); saveState(); renderStaff(); };
        plus.onclick = () => { state.stock[k] = (state.stock[k] ?? p.stock) + 1; saveState(); renderStaff(); };
        tdStock.append(minus, val, plus);
      }
      tr.appendChild(tdStock);
      tbody.appendChild(tr);
    }
    $('undo').disabled = !state.last;
    renderLogStatus();
  }

  function undoLast() {
    const last = state.last;
    if (!last) return;
    const day = state.days[last.day];
    const prize = CFG.prizes.find((p) => p.id === last.id);
    if (day && day.won[last.id]) {
      day.won[last.id] -= 1;
      day.spins = Math.max(0, day.spins - 1);
      delete day.lastWinAt[last.id];
    }
    if (prize && prize.stock != null) { const k = L.stockKey(prize); state.stock[k] = (state.stock[k] ?? prize.stock) + 1; }
    // keep the line in the journal, marked as cancelled — nothing is silently erased
    const entry = (state.log || []).find((e) => e.n === last.n);
    if (entry) entry.cancelled = true;
    state.last = null;
    saveState(); renderStaff(); writeLiveLog();
  }

  // ---------- spin journal (file) ----------
  // Every spin is stored in the browser (survives refresh). Staff can download it as CSV at any
  // time, or — in Chrome / Edge — pick a file once and it is rewritten after every spin.
  let liveHandle = null;
  let liveWriting = Promise.resolve();
  const canLive = typeof window.showSaveFilePicker === 'function';

  function csvBlob() {
    // BOM so Excel reads accents/Arabic as UTF-8
    return new Blob(['﻿' + L.logToCSV(state.log)], { type: 'text/csv;charset=utf-8' });
  }
  function logFileName() {
    const dev = String(CFG.deviceName || 'roue').replace(/[^\w-]+/g, '-');
    return `journal-roue-${dev}-${L.todayKey(Date.now())}.csv`;
  }
  function downloadLog() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(csvBlob());
    a.download = logFileName();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function chooseLiveFile() {
    try {
      liveHandle = await window.showSaveFilePicker({
        suggestedName: logFileName(),
        types: [{ description: 'Journal CSV', accept: { 'text/csv': ['.csv'] } }],
      });
      await writeLiveLog();
      idbSet('logHandle', liveHandle);        // remembered: next time the page opens it reconnects
    } catch (e) { /* cancelled by staff */ }
    renderLogStatus();
  }

  // ---- remember the chosen file between sessions (IndexedDB can store file handles) ----
  let pendingHandle = null;                   // remembered file waiting for permission
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('roue-journal', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbSet(k, v) {
    try { const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { /* storage blocked */ }
  }
  async function idbGet(k) {
    try {
      const db = await idb();
      return await new Promise((res) => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result); q.onerror = () => res(undefined);
      });
    } catch (e) { return undefined; }
  }
  /** Reconnect to the remembered journal file. Without `ask`, only if Chrome still allows it
   *  silently; with `ask` (a staff tap), Chrome may show a one-line "allow editing?" prompt. */
  async function resumeLog(ask) {
    if (!canLive || liveHandle) return;
    const h = pendingHandle || await idbGet('logHandle');
    if (!h || !h.queryPermission) return;
    let perm = await h.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && ask) {
      try { perm = await h.requestPermission({ mode: 'readwrite' }); } catch (e) { /* no gesture */ }
    }
    if (perm === 'granted') { liveHandle = h; pendingHandle = null; await writeLiveLog(); }
    else pendingHandle = h;
    renderLogStatus();
  }
  function writeLiveLog() {
    if (!liveHandle) return Promise.resolve();
    // one write at a time, in order
    liveWriting = liveWriting.then(async () => {
      try {
        const w = await liveHandle.createWritable();
        await w.write(csvBlob());
        await w.close();
      } catch (e) {
        liveHandle = null;                 // permission lost / file moved: fall back to download
        renderLogStatus();
      }
    });
    return liveWriting;
  }
  function renderLogStatus() {
    const log = state.log || [];
    const done = log.filter((e) => !e.cancelled).length;
    const live = liveHandle ? ` · Enregistrement en direct dans « ${liveHandle.name} »` : '';
    $('log-status').textContent = `${done} tours enregistrés (${log.length - done} annulés) sur « ${CFG.deviceName || 'cet appareil'} »${live}.`;
    $('log-live').hidden = !canLive;
    $('log-live').textContent = liveHandle ? 'Changer de fichier…' : 'Enregistrer en direct dans un fichier…';
    // small corner chip so staff always know whether spins also go to the file
    const chip = $('log-chip');
    chip.hidden = !canLive;
    chip.className = 'log-chip ' + (liveHandle ? 'ok' : 'warn');
    chip.textContent = liveHandle ? `● Journal : ${liveHandle.name}`
      : pendingHandle ? '● Journal : touchez pour reconnecter'
      : '● Journal : touchez pour choisir le fichier';
  }

  function closeStaff() {
    $('staff').hidden = true;
    drawRules(); drawWheel(); idle();
  }

  // ---------- events ----------
  $('spin').addEventListener('click', spin);
  $('hub').addEventListener('click', spin);
  $('result-btn').addEventListener('click', closeResult);
  document.addEventListener('keydown', (e) => {
    if (!$('pin').hidden || !$('staff').hidden) {
      if (e.key === 'Escape') { $('pin').hidden = true; if (!$('staff').hidden) closeStaff(); }
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!$('result').hidden) closeResult(); else spin();
    }
    if (e.key.toLowerCase() === 's' && e.ctrlKey && e.shiftKey) openPin();
  });

  // Long-press the logo (2 s) to open the staff PIN — invisible to players, works on touch screens.
  let pressTimer = 0;
  const logo = $('logo');
  logo.addEventListener('pointerdown', () => { pressTimer = setTimeout(openPin, 2000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => logo.addEventListener(ev, () => clearTimeout(pressTimer)));
  logo.addEventListener('contextmenu', (e) => e.preventDefault());

  $('pin-cancel').addEventListener('click', () => { $('pin').hidden = true; });
  $('pin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('pin-input').value === String(CFG.staffPin)) {
      $('pin').hidden = true;
      cancelAnimationFrame(idleRaf);
      resumeLog(true);                         // staff tap: good moment to re-allow the journal file
      renderStaff();
      $('staff').hidden = false;
    } else {
      const input = $('pin-input');
      input.classList.remove('bad'); void input.offsetWidth; input.classList.add('bad');
      input.value = '';
    }
  });
  $('staff-close').addEventListener('click', closeStaff);
  document.querySelectorAll('.seg').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode; saveState(); renderStaff();
  }));
  $('undo').addEventListener('click', undoLast);
  $('log-download').addEventListener('click', downloadLog);
  $('log-live').addEventListener('click', chooseLiveFile);
  $('log-chip').addEventListener('click', () => {
    if (liveHandle) return;
    if (pendingHandle) resumeLog(true); else chooseLiveFile();
  });
  $('reset-day').addEventListener('click', () => {
    if (!confirm("Remettre les compteurs d'aujourd'hui à zéro ? (le stock et le journal ne changent pas)")) return;
    delete state.days[L.todayKey(Date.now())];
    state.last = null;
    saveState(); renderStaff();
  });
  function renderSoundToggle() {
    const on = window.RoueSound ? window.RoueSound.enabled : false;
    $('sound-toggle').textContent = on ? 'Son : activé' : 'Son : coupé';
    $('sound-toggle').classList.toggle('solid', on);
  }
  $('sound-toggle').addEventListener('click', () => {
    if (!window.RoueSound) return;
    window.RoueSound.setEnabled(!window.RoueSound.enabled);
    state.sound = window.RoueSound.enabled;
    saveState(); renderSoundToggle();
    if (state.sound) window.RoueSound.result('small');     // quick preview so staff hears the volume
  });
  $('fullscreen').addEventListener('click', () => {
    const d = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
  });

  // Re-check caps at midnight / after the laptop wakes up.
  setInterval(() => { if (!spinning && $('result').hidden) drawWheel(); }, 60000);

  // ---------- ambient animation ----------
  function makeSparks(n) {
    if (reduceMotion) return;
    const box = $('sparks');
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      const size = 3 + Math.random() * 6;
      s.style.left = `${Math.random() * 100}%`;
      s.style.width = s.style.height = `${size.toFixed(1)}px`;
      s.style.animationDuration = `${(7 + Math.random() * 8).toFixed(1)}s`;
      s.style.animationDelay = `${(-Math.random() * 15).toFixed(1)}s`;
      s.style.setProperty('--dx', `${((Math.random() - 0.5) * 160).toFixed(0)}px`);
      box.appendChild(s);
    }
  }

  // Walk the highlight through the rules: 1 → 2 → 3 → 1…
  let ruleStep = 0;
  setInterval(() => {
    const items = document.querySelectorAll('#rules li');
    if (!items.length) return;
    ruleStep = (ruleStep + 1) % items.length;
    items.forEach((li, i) => li.classList.toggle('lit', i === ruleStep));
  }, 1600);

  // ---------- boot ----------
  if (TEST) {
    const b = document.createElement('div');
    b.className = 'test-banner';
    b.textContent = 'MODE TEST — chances égales · rien n’est enregistré';
    document.body.appendChild(b);
  }
  if (window.RoueSound && typeof state.sound === 'boolean') window.RoueSound.setEnabled(state.sound);
  renderSoundToggle();
  renderLogStatus();
  resumeLog(false);                            // silently reconnect the journal file if allowed
  drawBulbs();
  drawRules();
  drawWheel();
  makeSparks(26);
  chaseBulbs(500);
  idle();
  // Open the curtains once the logo is ready (or after 1.5 s, whichever is first).
  const open = () => document.body.classList.remove('opening');
  const firstWord = document.querySelector('.title-anim .word');
  if (firstWord.complete) setTimeout(open, 150);
  else { firstWord.addEventListener('load', () => setTimeout(open, 150), { once: true }); setTimeout(open, 1500); }
})();
