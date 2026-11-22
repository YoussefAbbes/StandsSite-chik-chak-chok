# Shik Shak Shok — Stands Site (design)

Date: 2026-11-22 · Status: approved (with contact email + committee Instagram added)

## Intent
The A2 poster for **شيك شك شوك في إسبري** (ESPRIT, Bloc E, 2 Dec 2026, 20h) has an empty
QR box labelled "لمعرفة نقاط البيع" (where to find the points of sale). Scanning it opens a
fun, alive, but clearly structured page: every bloc has a stand, tickets are sold there,
and students can call the stand's responsable. Tagline: *check the blocs, follow the music*.
The QR code points at a fixed URL; content is edited later without touching the QR code.

## Goals
- Looks like the poster: red velvet curtains, gold Moorish arch, spotlights, red smoke,
  gold calligraphy, marquee-bulb frame.
- Opening scene: the dancing silhouette inside the lit marquee frame (as on the LED screen
  in the "سنتين Shik Shak Shok" video).
- 3D party objects floating in the background.
- Stand list readable in seconds, with tap-to-call / WhatsApp.
- Contacts editable from GitHub in the browser; the QR code never changes.

## Non-goals / anti-goals
- No schedule grid (days/shifts) — only Bloc + Responsable + phone.
- No people without both a name and a phone number. No placeholder names ("Responsable 1").
- Fails if: it's slow or janky on a mid-range Android on campus data, the phone numbers are
  hard to find under the effects, or iPhone shows a black box instead of the silhouette.

## Content (from the planning PDF, filtered)
| Bloc | Shown contacts |
|---|---|
| Bloc G | — (stand + tickets, "passe au stand") |
| Bloc ESB | — |
| Bloc H | Hiba Ghrandi · 25 615 375 |
| Bloc IJK & M | Mohamed Nour Amri · 58 431 239 — Heni Troudi · 22 628 105 |
| Bloc M | — |
| Bloc A | note: tickets at the office window ("Ay wehed f bureau — شبّاك التذاكر") |

The two "Bloc G" rows are merged. General info numbers from the poster (95 195 235,
25 546 886) shown as "للاستفسار".

## Approaches considered
1. **Vite + Three.js + GSAP static site on GitHub Pages, data in `data.json`** — chosen.
   Full control of 3D and animation, free and stable hosting, edits via GitHub web editor
   redeploy in ~1–2 min.
2. Same site reading a published Google Sheet live — instant edits, but adds a dependency on
   sheet structure and no sheet was shared. Can be swapped in later.
3. Website builder (Canva/Carrd) — fast, but cannot do the 3D or silhouette intro.

## Build (decided)
- **Stack:** Vite + vanilla JS + Three.js + GSAP; deployed by a GitHub Actions workflow to
  `https://youssefabbes.github.io/StandsSite-chik-chak-chok/`.
- **Intro (≈4 s, skippable):** curtains part → spotlights sweep → marquee bulbs light in
  sequence → silhouette dances inside → gold title fades in. A "Enter" tap starts the
  music (browsers block autoplay with sound).
- **Silhouette:** extracted from the LED-screen shots of the new video (black figure on red
  = clean to separate), smoothed, exported as transparent WebM (Chrome/Android) + HEVC
  (Safari/iPhone), with a PNG-sequence fallback. Plan B if the source is too low-res: a
  vector silhouette animated to match the same moves.
- **Title:** the gold calligraphy cut out of the poster artwork, with a moving light sheen.
- **3D:** procedurally built gold lanterns (fanous), coins, hand fans, darbuka, stars; gold
  material + bloom; drift on scroll / device tilt. Capped pixel ratio, paused when the tab
  is hidden, static fallback for `prefers-reduced-motion`.
- **Stands section:** one card per bloc, badge "Stand + 🎟️ Tickets", contact rows with
  Call (`tel:+216…`) and WhatsApp (`wa.me/216…`).
- **Copy:** Arabic display headings (like the poster) + short French body text, a little
  Tunisian darija for fun.
- **Questions section:** "Une question ?" with a mail button (`mailto:Comite.deseleves@Esprit.tn`)
  next to the poster's info numbers.
- **Footer:** ESPRIT Student Committee logo (recoloured for dark background), Instagram links:
  committee `https://www.instagram.com/comite_des_etudiants_esprit/` and event
  `https://www.instagram.com/shikshakshok_tn/`.
- **QR deliverables:** QR as SVG + PNG, and the A2 PDF re-exported with the QR in the
  poster's empty frame.

## Left to the builder
Exact timings, object counts, font pairing, and which music segment loops.
