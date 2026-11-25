# Shik Shak Shok — Stands

The page behind the QR code on the **شيك شك شوك في إسبري** poster:
every bloc has a stand, tickets are sold there, and each stand's
responsable can be called in one tap.

Live: https://youssefabbes.github.io/students_committee_chikchakchok/

## Changing a name or a phone number (no code needed)

1. On GitHub, open **`public/data.json`** and click the ✏️ pencil.
2. Edit the text between the quotes, for example:
   ```json
   { "name": "Isra Radaoui", "phone": "22 123 456" }
   ```
   - A person appears **only if they have both a name and an 8-digit phone number**.
   - Leave `"phone": ""` empty to hide someone.
   - Spaces, dots or `+216` in the number are fine.
3. Click **Commit changes**. The site updates by itself in about 1–2 minutes.
   The QR code never changes.

- `"stand": true` = this bloc has a stand (tickets): the card shows **Stand + Tickets** and
  "Passe au stand — l'équipe est là 💃". `"stand": false` = no stand: the card only shows the people to call
  (and is hidden if nobody has a number).
- `"note": "…"` on a stand replaces the "Passe au stand…" line with your own text (like Bloc A's ticket window).

To add a bloc, copy one `{ "bloc": …, "stand": …, "people": [ … ] }` block and keep the commas between blocks.
If the update fails, the **Actions** tab shows a red ✗: open it and look at the
**Check data.json** step. It says exactly what to fix, for example
`stand #3 (Bloc H), person #1: "name" must be text` or the line of a missing comma.
Until it's fixed, the site keeps showing the previous version (nothing breaks).

## Reservations (in-site form → Google Sheet)

Students reserve from the **Réserver maintenant** button; each reservation becomes a row in
the team's Google Sheet. One-time setup: `tools/RESERVATION_SETUP.md`.

In `public/data.json`, the `reservation` block:
```json
"reservation": {
  "endpoint": "https://script.google.com/macros/s/…/exec",
  "lastDay": "2026-12-02",
  "blocs": [ { "bloc": "Bloc C", "rooms": ["C 0-1", "C 1-1", "C 1-2"] }, … ]
}
```
- `endpoint` empty → the button is hidden (use this to close reservations).
- `rooms` empty → students pick étage 0–4 and salle 1–15 (sent to the Sheet as `C 2-7`); filled → they pick from that list.
- `lastDay` = the last day students can choose.
- Local test without the real script: `npm run dev`; the form fakes Google's answer
  (`?reserveStub=duplicate` or `?reserveStub=network` to see the other screens).

## Developing

```bash
npm install
npm run dev      # http://localhost:5173/students_committee_chikchakchok/
npm test
npm run build
```

- `src/data.js` reads and filters `data.json`; `src/stands.js` renders the cards
- `src/intro.js` is the curtain/marquee/silhouette opening, `src/scene3d.js` the 3D background
- `tools/` contains the one-off scripts that produced the images in `public/assets/`
  (silhouette from the party video, title cut from the poster, light logo, QR + poster)

Made by Youssef Abbes for the ESPRIT Student Committee.
