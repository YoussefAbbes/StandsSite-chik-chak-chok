/* Roue de chance — Shik Shak Shok @ ESPRIT
 *
 * THIS IS THE ONLY FILE TO EDIT for prizes, odds and stock.
 * Values marked PLACEHOLDER are guesses until the committee confirms them.
 *
 * Fields per prize:
 *   id        unique key (never rename once the stand is running: stock is saved by id)
 *   label     short text drawn on the slice (keep it under ~14 chars)
 *   sub       one line shown under the prize on the result screen
 *   weight    relative chance. Weights don't need to add up to 100 — they are
 *             normalised over the prizes still available. All slices are drawn
 *             the SAME size; only the weight decides how often a prize comes up.
 *   kind      "small" | "big" | "jackpot" | "again" | "none"  (colour + celebration;
 *             "none" = the "nothing" slice: no confetti, no prize to hand over)
 *   modes     where the prize exists: "stand" (ticket stands), "soiree" (party night)
 *   dailyCap  max wins per calendar day (null = no limit)
 *   stock     total units available (null = unlimited). Staff panel can adjust it live.
 *   stockKey  optional: slices with the same stockKey share ONE stock counter
 *             (two "Sticker" slices on the wheel, but one pile of stickers)
 *   minMinutesBetween  optional spacing between two wins of this prize (see logic.js)
 *
 * File is a plain script (not JSON) so the page works when opened directly
 * from disk on the stand laptop — browsers block fetch() of local JSON files.
 */
window.ROUE_CONFIG = {
  event: {
    instagram: '@shikshakshok_tn',
    instagramCommittee: '@comite_des_etudiants_esprit',
    ticketPrice: 20, // DT — only used for the cost estimate in the staff panel
  },

  // Name of THIS laptop/stand, written in every line of the spin journal so the files
  // from several stands can be merged. Change it on each laptop (e.g. 'Bloc A', 'Bloc G').
  deviceName: 'Stand 1', // PLACEHOLDER

  staffPin: '2026', // PLACEHOLDER — long-press the logo 2 s to open the staff panel

  // 'full' = every animation. 'lite' = for a weak laptop that stutters: removes spotlights,
  // blurred smoke, sparks and the 2 back dancers (wheel, title, logos, front dancers stay).
  // You can also add ?lite to the address bar to try it without editing this file.
  effects: 'full',

  // TEST MODE — for trying every prize: all slices get the SAME chance, daily caps and stock
  // are ignored, and NOTHING is saved (no counters, no stock used, no journal lines).
  // A red "MODE TEST" banner shows while it's on. Set back to false before the stand opens.
  // You can also add ?test to the address bar instead of editing this line.
  testMode: false,

  // Sounds (spin clicks, darbuka, win chimes, fanfare). Also switchable in the staff panel.
  sound: true,
  volume: 0.7, // 0 … 1

  // Song / meme clip for each moment. `start` and `end` are in SECONDS inside the file
  // (1:05 = 65). The clip fades out at `end` (end: null = to the end of the file).
  // playToEnd: true = "Suivant" doesn't cut it; only the next spin does. If a file is missing or can't play, the wheel
  // falls back to the built-in synthesised sound, so nothing breaks.
  // A clip can be set for one PRIZE (by its id, e.g. bonbon, sticker, reduc40) or for a whole
  // TYPE of prize (small, big, jackpot, again, none). The prize's own clip wins; otherwise the
  // clip of its type plays. Both Sticker slices share 'sticker' (their stockKey).
  //   spin    → while the wheel turns (fades out when it stops)
  music: {
    // per prize
    bonbon:  { file: 'assets/sounds/mazajiyi.mp3',       start: 16, end: 40 }, // Ragheb Alama — Mazajiyi, 0:16 → 0:40
    sticker: { file: 'assets/sounds/seta-el-sobah.mp3',  start: 10, end: 32 }, // Hussain Al Jassmi — Seta El Sobah, 0:10 → 0:32
    reduc40: { file: 'assets/sounds/el-leila.mp3',       start: 45, end: 63 }, // Amr Diab — El Leila, 0:45 → 1:03
    // per type
    spin:    { file: 'assets/sounds/shik-shak-shok.mp3', start: 0, end: 8 },   // PLACEHOLDER times
    small:   { file: 'assets/sounds/garee2a-awy.mp3',    start: 45, end: 62 }, // 0:45 → 1:02 (any small prize without its own song)
    big:     { file: 'assets/sounds/nour-el-ain.mp3',    start: 12, end: 40 }, // 0:12 → 0:40 — plays for 25 % réduction
    jackpot: { file: 'assets/sounds/boshret-kheir.mp3',  start: 0, end: 37 },  // 0:00 → 0:37
    again:   { file: 'assets/sounds/be3-wrawah.mp3',     start: 0, end: null, playToEnd: true }, // whole reel
    none:    { file: 'assets/sounds/be3-wrawah.mp3',     start: 0, end: null, playToEnd: true }, // whole reel
  },

  // How a person earns a spin, shown on screen.
  // A rule can be plain text, or { text, instagram, url, qr } to show the Instagram icon + handle,
  // clickable when `url` is set (opens the page in a new tab), with a small QR image when `qr` is set.
  rules: {
    // Tunisian Arabic, short. Arabic lines are shown right-to-left automatically.
    stand: [{ text: 'اعمل فولو للصفحة', instagram: '@comite_des_etudiants_esprit',
              url: 'https://www.instagram.com/comite_des_etudiants_esprit/',
              qr: 'assets/qr-instagram.svg' },   // made by tools/make_instagram_qr.py (checked to scan)
            'تاغي 3 صحابك في كومنتار تحت بوست الأفيش',
            'ورّي للستاف و دور — دورة وحدة لكل واحد'],
    soiree: ['1 tour par ticket', 'Montre ton ticket au staff'],
  },

  // Display order = order of slices around the wheel (clockwise from the top).
  // The two Sticker and the two Rejoue slices are spread apart so the wheel looks varied.
  //
  // Odds (weights add up to 100, so each weight = % chance):
  //   cheap wins   Bonbon 28 + Sticker 13 + Sticker 13       = 54 %
  //   re-spin      Rejoue 7 + Rejoue 7                       = 14 %
  //   nothing      Pas de chance                             = 18 %
  //   money        25 % réduc 10 + 40 % réduc 3 + Ticket 1    = 14 %  (each with a daily cap)
  // Discounts only count if the ticket is bought on the spot, so each one is still a sale.
  // On a 20 DT ticket: 25 % = 5 DT, 40 % = 8 DT. Worst case per laptop per day if every
  // discount is used: 25 × 5 + 8 × 8 + 2 × 20 = 229 DT.
  prizes: [
    { id: 'bonbon',   label: 'Bonbon',        sub: 'حلوة ليك — sers-toi !',            weight: 28, kind: 'small',   modes: ['stand', 'soiree'], dailyCap: null, stock: null },
    { id: 'reduc25',  label: '25 % réduction', sub: 'sur ton ticket, acheté maintenant', weight: 10, kind: 'big',    modes: ['stand'],           dailyCap: 25,   stock: null, discountPct: 25 }, // PLACEHOLDER cap
    { id: 'sticker',  label: 'Sticker',       sub: 'un sticker Shik Shak Shok',         weight: 13, kind: 'small',   modes: ['stand', 'soiree'], dailyCap: null, stock: 150, stockKey: 'sticker' }, // PLACEHOLDER stock
    { id: 'rejoue',   label: 'Rejoue !',      sub: '',                                  weight: 7,  kind: 'again',   modes: ['stand', 'soiree'], dailyCap: null, stock: null },
    { id: 'ticket',   label: 'Ticket offert', sub: 'JACKPOT — ta soirée est offerte !', weight: 1,  kind: 'jackpot', modes: ['stand'],           dailyCap: 2,    stock: 6, minMinutesBetween: 45 }, // PLACEHOLDER cap/stock
    { id: 'rien',     label: 'Pas de chance', sub: '',                                  weight: 18, kind: 'none',    modes: ['stand', 'soiree'], dailyCap: null, stock: null },
    { id: 'sticker2', label: 'Sticker',       sub: 'un sticker Shik Shak Shok',         weight: 13, kind: 'small',   modes: ['stand', 'soiree'], dailyCap: null, stock: 150, stockKey: 'sticker' },
    { id: 'reduc40',  label: '40 % réduction', sub: 'sur ton ticket, acheté maintenant', weight: 3,  kind: 'big',    modes: ['stand'],           dailyCap: 8,    stock: null, discountPct: 40 }, // PLACEHOLDER cap
    { id: 'rejoue2',  label: 'Rejoue !',      sub: '',                                  weight: 7,  kind: 'again',   modes: ['stand', 'soiree'], dailyCap: null, stock: null },
  ],
};
