/* Wheel sounds, synthesised live with the Web Audio API — no audio files, works offline.
 *
 *   tick()        click each time the pointer passes a slice (fast, then slowing down)
 *   spinStart()   darbuka "doum-tek-tek" + a whoosh when the wheel is launched
 *   result(kind)  small → chime · big → arpeggio · jackpot → fanfare
 *                 again → springy "boing" · none → sad "wah-wah"
 *
 * Browsers only allow sound after a click/tap, which is fine: every sound follows the
 * player pressing دور. Volume and on/off come from config.js (`sound`, `volume`) and the
 * staff panel toggle.
 */
(function () {
  'use strict';
  const CFG = window.ROUE_CONFIG || {};
  let ctx = null;
  let master = null;
  let enabled = CFG.sound !== false;
  let lastTick = 0;

  function ac() {
    if (!enabled) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = typeof CFG.volume === 'number' ? CFG.volume : 0.7;
      // gentle compressor so the fanfare never clips on cheap laptop speakers
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---------- building blocks ----------
  function tone(freq, start, dur, { type = 'sine', gain = 0.3, attack = 0.005, slideTo = null, filter = null } = {}) {
    const c = ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node = o.connect(g);
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.freq;
      if (filter.q) f.Q.value = filter.q;
      node = g.connect(f);
      f.connect(master);
    } else {
      g.connect(master);
    }
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  let noiseBuf = null;
  function noise(start, dur, { gain = 0.2, type = 'highpass', freq = 2000, q = 0.7, sweepTo = null } = {}) {
    const c = ctx;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(master);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  // darbuka: "doum" = deep pitched thump, "tek" = sharp rim slap
  const doum = (t, g = 0.55) => { tone(150, t, 0.32, { gain: g, slideTo: 62 }); noise(t, 0.05, { gain: 0.12, type: 'lowpass', freq: 700 }); };
  const tek = (t, g = 0.3) => { noise(t, 0.07, { gain: g, type: 'bandpass', freq: 3200, q: 1.4 }); tone(780, t, 0.05, { type: 'triangle', gain: g * 0.4 }); };

  // bell-like note: fundamental + soft upper partial
  const bell = (f, t, dur = 0.9, g = 0.22) => { tone(f, t, dur, { gain: g }); tone(f * 2.01, t, dur * 0.6, { gain: g * 0.35 }); tone(f * 3.02, t, dur * 0.3, { gain: g * 0.12 }); };

  const N = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };

  // ---------- public sounds ----------
  function tick() {
    const c = ac(); if (!c) return;
    const now = c.currentTime;
    if (now - lastTick < 0.025) return;          // at full speed, don't turn into a buzz
    lastTick = now;
    tone(1900 + Math.random() * 200, now, 0.035, { type: 'square', gain: 0.07, filter: { type: 'bandpass', freq: 2200, q: 2 } });
    noise(now, 0.02, { gain: 0.05, freq: 3500 });
  }

  function synthSpinStart() {
    const c = ac(); if (!c) return;
    const t = c.currentTime + 0.01;
    doum(t); tek(t + 0.18); tek(t + 0.27, 0.22); doum(t + 0.36, 0.45);
    noise(t + 0.05, 0.9, { gain: 0.07, type: 'bandpass', freq: 600, sweepTo: 2400, q: 0.9 });   // whoosh
  }

  function synthResult(kind) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + 0.02;
    if (kind === 'none') {
      // sad trombone: four sliding notes down, the last one wobbling
      const notes = [392, 370, 349, 330];
      notes.forEach((f, i) => tone(f, t + i * 0.38, i === 3 ? 0.9 : 0.36,
        { type: 'sawtooth', gain: 0.14, attack: 0.03, slideTo: f * 0.97, filter: { freq: 1100 } }));
      return;
    }
    if (kind === 'again') {
      tone(260, t, 0.32, { type: 'triangle', gain: 0.25, slideTo: 880 });
      tone(520, t + 0.28, 0.25, { type: 'triangle', gain: 0.18, slideTo: 1320 });
      tek(t + 0.05, 0.2);
      return;
    }
    if (kind === 'small') {
      doum(t, 0.4);
      bell(N.C6, t + 0.05); bell(N.E6, t + 0.18); bell(N.G6, t + 0.31, 1.1);
      return;
    }
    if (kind === 'big') {
      doum(t); tek(t + 0.12); doum(t + 0.24, 0.45);
      [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => bell(f, t + 0.08 + i * 0.09, 0.8, 0.2));
      [N.C6, N.E6, N.G6].forEach((f) => bell(f, t + 0.6, 1.4, 0.14));            // final chord
      return;
    }
    if (kind === 'jackpot') {
      // darbuka roll, rising fanfare, big chord, sparkles
      for (let i = 0; i < 6; i++) (i % 2 ? tek : doum)(t + i * 0.09, 0.4);
      const run = [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, N.C7];
      run.forEach((f, i) => { tone(f, t + 0.5 + i * 0.08, 0.35, { type: 'triangle', gain: 0.16 }); });
      [N.C5, N.E5, N.G5, N.C6].forEach((f) => {
        tone(f, t + 1.1, 1.8, { type: 'sawtooth', gain: 0.07, attack: 0.04, filter: { freq: 2400 } });
        bell(f * 2, t + 1.1, 1.6, 0.1);
      });
      for (let i = 0; i < 10; i++) bell(N.C7 * (1 + (i % 3) * 0.25), t + 1.2 + i * 0.12, 0.4, 0.06);
      return;
    }
  }

  // ---------- song / meme clips (config.js → music) ----------
  // Plain <audio> elements on purpose: when the page is opened from disk (file://), Chrome
  // silences audio routed through Web Audio, but a normal <audio> element plays fine.
  const MUSIC = CFG.music || {};
  const elements = {};                 // one <audio> per file (Rejoue and Pas de chance share one)
  let current = null;                  // { el, endTimer }

  function audioFor(file) {
    if (!elements[file]) {
      const el = new Audio();
      el.preload = 'auto';
      el.dataset.file = file;                // which song this is (handy when debugging)
      el.addEventListener('error', () => { el.broken = true; });
      if (/^https?:$/.test(location.protocol)) {
        // Some simple web servers can't serve "part of a file", and then the browser can't jump
        // to `start` inside the song. Loading the whole file into memory first makes jumping
        // always work. (Opened from disk — file:// — jumping works directly, and fetch is blocked.)
        fetch(file).then((r) => (r.ok ? r.blob() : Promise.reject()))
          .then((b) => { el.src = URL.createObjectURL(b); })
          .catch(() => { el.src = file; });
      } else {
        el.src = file;
      }
      elements[file] = el;
    }
    return elements[file];
  }
  // preload every configured clip at startup so it starts instantly on the right second
  Object.values(MUSIC).forEach((m) => m && m.file && audioFor(m.file));

  function fade(el, to, ms, then) {
    clearInterval(el._fade);
    const from = el.volume;
    const steps = Math.max(1, Math.round(ms / 25));
    let k = 0;
    el._fade = setInterval(() => {
      k++;
      el.volume = Math.min(1, Math.max(0, from + (to - from) * (k / steps)));
      if (k >= steps) { clearInterval(el._fade); if (then) then(); }
    }, 25);
  }

  /** Fade out and stop whatever clip is playing. A playToEnd clip (the be3 wrawah reel) is
   *  left alone unless `force` — a new clip starting always forces, so songs never overlap. */
  function stopClip(ms = 350, force = false) {
    if (!current) return;
    if (current.keep && !force) return;
    const { el, endTimer } = current;
    clearTimeout(endTimer);
    current = null;
    fade(el, 0, ms, () => el.pause());
  }

  /** Play the clip configured for `key`. Returns false when there is no usable clip,
   *  so the caller can use the synthesised sound instead. `fallback` runs if play() fails. */
  function playClip(key, fallback) {
    const m = MUSIC[key];
    if (!m || !m.file) return false;
    const el = audioFor(m.file);
    if (el.broken || !el.src) return false;   // still loading → synth sound this once, clip next time
    stopClip(key === 'spin' ? 150 : 400, true);
    const start = Number(m.start) || 0;
    const target = Math.min(1, (typeof m.volume === 'number' ? m.volume : 1) *
                               (typeof CFG.volume === 'number' ? CFG.volume : 0.7));
    clearInterval(el._fade);
    el.volume = 0;
    try { el.currentTime = start; } catch (e) { /* not loaded yet: set when metadata arrives */ }
    if (el.readyState < 1) el.addEventListener('loadedmetadata', () => { el.currentTime = start; }, { once: true });
    // safety net: if the jump to `start` didn't stick, redo it as soon as playback begins
    el.addEventListener('playing', () => { if (start && el.currentTime < start - 0.5) el.currentTime = start; }, { once: true });
    const entry = { el, endTimer: 0, keep: !!m.playToEnd };
    el.onended = () => { if (current === entry) current = null; };
    current = entry;
    const p = el.play();
    fade(el, target, 120);
    if (m.end != null && m.end > start) {
      entry.endTimer = setTimeout(() => { if (current === entry) stopClip(450); }, (m.end - start) * 1000 - 450);
    }
    if (p && p.catch) p.catch(() => { el.broken = true; if (current === entry) current = null; if (fallback) fallback(); });
    return true;
  }

  // ---------- public ----------
  function spinStart() {
    if (!enabled) return;
    if (!playClip('spin', synthSpinStart)) synthSpinStart();
  }
  /** The wheel stopped: let the spin song fade out (the result sound starts right after). */
  function spinEnd() { if (current && current.el === (MUSIC.spin && elements[MUSIC.spin.file])) stopClip(500); }
  /** Result sound: the prize's own clip (by id, then stockKey), else its type's clip, else synth. */
  function result(kind, prize) {
    if (!enabled) return;
    const keys = prize ? [prize.id, prize.stockKey, kind] : [kind];
    const key = keys.find((k) => k && MUSIC[k] && MUSIC[k].file);
    if (!key || !playClip(key, () => synthResult(kind))) synthResult(kind);
  }

  window.RoueSound = {
    tick, spinStart, spinEnd, result, stopClip,
    get enabled() { return enabled; },
    setEnabled(on) { enabled = !!on; if (!enabled) { stopClip(0, true); if (ctx) ctx.suspend(); } },
  };
})();
