/* Background dancers: REAL filmed silhouettes of the dancer on the LED screen in the
 * Shik Shak Shok video, played on canvases.
 *
 * Four moves, each its own sprite sheet in assets/dancers/:
 *   circle   — hands joined above the head, hip sway (the clip the QR / stands site uses)
 *   open-o   — arms raised in a wide open "O"
 *   arms-out — arms stretched out to the sides
 *   hips     — hands near the hips, elbows out, swaying
 * The new ones were cut by tools/extract_dancers.py. Every clip is already a
 * back-and-forth loop, so it can repeat without a visible jump.
 *
 * Each dancer has her own order of moves, her own speed and direction (mirrored or not),
 * and changes move every few seconds with a short crossfade between two stacked canvases.
 */
(function () {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TILE = { w: 240, h: 300, cols: 8, fps: 12 };
  const MOVES = {
    circle:     { url: 'assets/dancers/circle.webp',   frames: 34, first: 1 }, // frame 0 has a faint double image
    'open-o':   { url: 'assets/dancers/open-o.webp',   frames: 12, first: 0 },
    'arms-out': { url: 'assets/dancers/arms-out.webp', frames: 23, first: 0 },
    hips:       { url: 'assets/dancers/hips.webp',     frames: 20, first: 0 },
  };
  const HOLD_SECONDS = [6, 9];     // how long a dancer keeps one move (random in this range)
  const FADE_MS = 700;             // crossfade between two moves
  const SPIN_SPEEDUP = 1.6;        // faster while the wheel spins
  const CHEER_SPEEDUP = 1.9;       // ...and when someone wins

  const host = document.getElementById('dancers');
  if (!host) return;

  // Lite mode (config.js `effects: 'lite'` or ?lite in the URL) — set here because this script runs first.
  const lite = (window.ROUE_CONFIG && window.ROUE_CONFIG.effects === 'lite') || /[?&]lite\b/.test(location.search);
  if (lite) document.body.classList.add('lite');

  const ready = (m) => m.img && m.img.complete && m.img.naturalWidth > 0;

  // Every dancer uses the original QR-site silhouette ('circle'). The other clips stay in
  // assets/dancers/ — to bring them back, add their names to a dancer's `moves` list,
  // e.g. ['circle', 'arms-out', 'hips', 'open-o'].
  const LINEUP = [
    { cls: 'd-front d-left',  mirror: false, speed: 1.0,  moves: ['circle'] },
    { cls: 'd-front d-right', mirror: true,  speed: 0.93, moves: ['circle'] },
    { cls: 'd-back d-left2',  mirror: true,  speed: 1.1,  moves: ['circle'] },
    { cls: 'd-back d-right2', mirror: false, speed: 0.87, moves: ['circle'] },
  ];
  const lineup = lite ? LINEUP.slice(0, 2) : LINEUP;

  // Load each sheet a dancer actually uses, once; dancers share them.
  for (const name of new Set(lineup.flatMap((d) => d.moves))) {
    const m = MOVES[name];
    m.img = new Image();
    m.img.decoding = 'async';
    m.img.src = m.url;
  }

  function makeCanvas(mirror) {
    const c = document.createElement('canvas');
    c.className = 'dancer-canvas' + (mirror ? ' mirror' : '');
    c.width = TILE.w;
    c.height = TILE.h;
    return c;
  }

  const holdFor = () => (HOLD_SECONDS[0] + Math.random() * (HOLD_SECONDS[1] - HOLD_SECONDS[0])) * 1000;

  const dancers = lineup.map((d, i) => {
    const el = document.createElement('div');
    el.className = `dancer ${d.cls}`;
    const halo = document.createElement('div');
    halo.className = 'dancer-halo';
    const a = makeCanvas(d.mirror);
    const b = makeCanvas(d.mirror);
    b.style.opacity = '0';
    el.append(halo, a, b);
    host.appendChild(el);
    return {
      ...d, el,
      layers: [{ canvas: a, ctx: a.getContext('2d'), move: d.moves[0], pos: i * 7, last: -1 },
               { canvas: b, ctx: b.getContext('2d'), move: null, pos: 0, last: -1 }],
      front: 0,
      step: 0,
      nextSwitch: performance.now() + holdFor() + i * 1500,   // stagger so they don't all switch together
    };
  });

  function drawLayer(L) {
    const m = MOVES[L.move];
    if (!m || !ready(m) || !L.ctx) return;
    const usable = m.frames - m.first;
    const k = m.first + (Math.floor(L.pos) % usable);
    if (k === L.last) return;                      // redraw only when the frame changes
    L.last = k;
    const sx = (k % TILE.cols) * TILE.w;
    const sy = Math.floor(k / TILE.cols) * TILE.h;
    L.ctx.clearRect(0, 0, TILE.w, TILE.h);
    L.ctx.drawImage(m.img, sx, sy, TILE.w, TILE.h, 0, 0, TILE.w, TILE.h);
  }

  function switchMove(d, now) {
    d.step = (d.step + 1) % d.moves.length;
    const incoming = d.layers[1 - d.front];
    const outgoing = d.layers[d.front];
    incoming.move = d.moves[d.step];
    incoming.pos = 0;
    incoming.last = -1;
    drawLayer(incoming);
    incoming.canvas.style.transition = outgoing.canvas.style.transition = `opacity ${FADE_MS}ms ease`;
    incoming.canvas.style.opacity = '1';
    outgoing.canvas.style.opacity = '0';
    d.front = 1 - d.front;
    d.nextSwitch = now + holdFor();
  }

  let cheerUntil = 0;
  let last = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    if (document.hidden) { last = now; return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    let boost = document.body.classList.contains('spinning') ? SPIN_SPEEDUP : 1;
    if (now < cheerUntil) boost = CHEER_SPEEDUP;
    for (const d of dancers) {
      if (d.moves.length > 1 && now >= d.nextSwitch) switchMove(d, now);   // one move = never switch
      for (const L of d.layers) {                   // both layers advance so the fade has motion on both sides
        if (!L.move) continue;
        L.pos += dt * TILE.fps * d.speed * boost;
        drawLayer(L);
      }
    }
  }

  if (reduceMotion) {
    const still = () => dancers.forEach((d) => drawLayer(d.layers[0]));
    Object.values(MOVES).forEach((m) => m.img && m.img.addEventListener('load', still, { once: true }));
    still();
  } else {
    requestAnimationFrame(tick);
  }

  // Called by wheel.js when someone wins: dancers speed up and jump for a moment.
  window.RoueDancers = {
    moves: Object.keys(MOVES),
    celebrate(kind) {
      if (reduceMotion || kind === 'none') return;   // nothing won: no party
      const ms = kind === 'jackpot' ? 5000 : 2600;
      cheerUntil = performance.now() + ms;
      host.classList.remove('cheer');
      void host.offsetWidth;                        // restart the CSS animation
      host.classList.add('cheer');
      clearTimeout(this._t);
      this._t = setTimeout(() => host.classList.remove('cheer'), ms);
    },
  };
})();
