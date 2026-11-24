/* Pure odds + geometry logic for the wheel. No DOM here, so it is testable
 * in Node (tests/logic.test.js) and loaded as a plain <script> in the page. */
(function (root) {
  'use strict';

  /** Local calendar day, e.g. "2026-11-24" — daily caps reset at local midnight. */
  function todayKey(now) {
    const d = new Date(now);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Which stock counter a prize uses: two slices with the same `stockKey` (e.g. two
   *  "Sticker" slices) share ONE counter, so the real number of stickers stays right. */
  const stockKey = (p) => p.stockKey || p.id;

  /** Fresh persisted state. `stock` holds live counts; `days` holds per-day usage. */
  function emptyState(prizes) {
    const stock = {};
    for (const p of prizes) if (p.stock != null && stock[stockKey(p)] == null) stock[stockKey(p)] = p.stock;
    return { version: 1, mode: 'stand', stock, days: {}, log: [] };
  }

  function dayUsage(state, now) {
    const key = todayKey(now);
    if (!state.days[key]) state.days[key] = { spins: 0, won: {}, lastWinAt: {} };
    return state.days[key];
  }

  /**
   * Should this prize be allowed to win again yet, given when it last won today?
   *
   * Without it, a capped jackpot (dailyCap: 2) can be used up in the first ten
   * minutes of lunch, leaving nothing for later. Prizes with
   * `minMinutesBetween` in config.js are meant to be spaced out.
   *
   * @param {object} prize    config entry (may have prize.minMinutesBetween)
   * @param {object} usage    today's usage: usage.lastWinAt[prize.id] = ms timestamp or undefined
   * @param {number} now      current time in ms
   * @returns {boolean}       true = prize stays on the wheel for this spin
   */
  function spacingAllows(prize, usage, now) {
    // TODO(you): decide the spacing policy. Currently every prize is always
    // allowed, so minMinutesBetween in config.js has no effect yet.
    return true;
  }

  /** Prizes that can be won right now: right mode, stock left, daily cap not hit, spacing ok. */
  function availablePrizes(prizes, state, mode, now) {
    const usage = dayUsage(state, now);
    return prizes.filter((p) => {
      if (!p.modes.includes(mode)) return false;
      if (p.stock != null && (state.stock[stockKey(p)] ?? p.stock) <= 0) return false;
      if (p.dailyCap != null && (usage.won[p.id] || 0) >= p.dailyCap) return false;
      return spacingAllows(p, usage, now);
    });
  }

  /** Real probability of each available prize (weights normalised). */
  function effectiveOdds(available) {
    const total = available.reduce((s, p) => s + p.weight, 0);
    return available.map((p) => ({ prize: p, p: total ? p.weight / total : 0 }));
  }

  /**
   * Slice angles in degrees, clockwise from the top. Every slice is the SAME size on screen;
   * the real chances are not shown by the drawing — pickIndex() still uses the weights,
   * then the wheel lands somewhere inside the picked slice.
   */
  function slices(available) {
    const w = available.length ? 360 / available.length : 0;
    return available.map((prize, i) => ({ prize, start: i * w, end: (i + 1) * w }));
  }

  /** Weighted pick. `rng` returns a float in [0, 1). Returns an index into `available`. */
  function pickIndex(available, rng) {
    const total = available.reduce((s, p) => s + p.weight, 0);
    let r = rng() * total;
    for (let i = 0; i < available.length; i++) {
      r -= available[i].weight;
      if (r < 0) return i;
    }
    return available.length - 1; // float rounding guard
  }

  /** Random landing point inside the slice, kept away from the edges so it never looks borderline. */
  function landingAngle(slice, rng, edge = 0.18) {
    const w = slice.end - slice.start;
    return slice.start + w * (edge + rng() * (1 - 2 * edge));
  }

  /**
   * Total clockwise wheel rotation (deg) so that `angle` (measured on the wheel,
   * clockwise from its top) ends up under the fixed pointer at the top.
   * Always moves forward by at least `turns` full spins.
   */
  function rotationFor(current, angle, turns) {
    const target = (((-angle) % 360) + 360) % 360;      // rotation mod 360 that aligns angle with pointer
    const now = ((current % 360) + 360) % 360;
    let delta = target - now;
    if (delta < 0) delta += 360;
    return current + turns * 360 + delta;
  }

  /** Record one spin result into state (mutates). */
  function recordSpin(state, prize, now) {
    const usage = dayUsage(state, now);
    usage.spins += 1;
    usage.won[prize.id] = (usage.won[prize.id] || 0) + 1;
    usage.lastWinAt[prize.id] = now;
    if (prize.stock != null) {
      const k = stockKey(prize);
      state.stock[k] = Math.max(0, (state.stock[k] ?? prize.stock) - 1);
    }
    return state;
  }

  /**
   * One line of the spin journal. `chance` = real probability of that prize at the moment
   * of the spin (it changes when a prize runs out). Call AFTER recordSpin so stockLeft is current.
   */
  function logEntry(state, prize, chance, now, device) {
    const d = new Date(now);
    const pad = (n) => String(n).padStart(2, '0');
    state.log = state.log || [];
    const entry = {
      n: state.log.length + 1,
      at: now,
      date: todayKey(now),
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      device: device || '',
      mode: state.mode,
      id: prize.id,
      label: prize.label,
      kind: prize.kind,
      chance: Math.round(chance * 10000) / 100,        // percent, 2 decimals
      stockLeft: prize.stock == null ? '' : state.stock[stockKey(prize)],
      cancelled: false,
    };
    state.log.push(entry);
    return entry;
  }

  const CSV_COLUMNS = [
    ['n', 'N°'], ['date', 'Date'], ['time', 'Heure'], ['device', 'Appareil'], ['mode', 'Mode'],
    ['label', 'Lot'], ['id', 'Code lot'], ['kind', 'Type'], ['chance', 'Chance (%)'],
    ['stockLeft', 'Stock restant'], ['cancelled', 'Annulé'],
  ];

  /** The journal as CSV for Excel: ';' separator (French Excel default), every cell quoted. */
  function logToCSV(log) {
    const cell = (v) => {
      if (v === true) v = 'oui';
      if (v === false) v = '';
      if (typeof v === 'number') v = String(v).replace('.', ',');   // 1,5 not 1.5 for French Excel
      return '"' + String(v ?? '').replace(/"/g, '""') + '"';
    };
    const lines = [CSV_COLUMNS.map(([, h]) => cell(h)).join(';')];
    for (const e of log || []) lines.push(CSV_COLUMNS.map(([k]) => cell(e[k])).join(';'));
    return lines.join('\r\n') + '\r\n';
  }

  /** Unbiased [0,1) float from the platform CSPRNG (Math.random fallback for very old browsers). */
  function secureRandom() {
    const c = root.crypto;
    if (c && c.getRandomValues) {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  const api = {
    todayKey, stockKey, emptyState, dayUsage, spacingAllows, availablePrizes,
    effectiveOdds, slices, pickIndex, landingAngle, rotationFor, recordSpin, secureRandom,
    logEntry, logToCSV,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RoueLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
