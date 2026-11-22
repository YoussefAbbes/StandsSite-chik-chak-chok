# Shik Shak Shok — Stands

The page behind the QR code on the **شيك شك شوك في إسبري** poster:
every bloc has a stand, tickets are sold there, and each stand's
responsable can be called in one tap.

Live: https://youssefabbes.github.io/StandsSite-chik-chak-chok/

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

To add a bloc, copy one `{ "bloc": …, "people": [ … ] }` block and keep the commas between blocks.
If the update fails, the **Actions** tab shows a red ✗: open it and look at the
**Check data.json** step. It says exactly what to fix, for example
`stand #3 (Bloc H), person #1: "name" must be text` or the line of a missing comma.
Until it's fixed, the site keeps showing the previous version (nothing breaks).

## Developing

```bash
npm install
npm run dev      # http://localhost:5173/StandsSite-chik-chak-chok/
npm test
npm run build
```

- `src/data.js` reads and filters `data.json`; `src/stands.js` renders the cards
- `src/intro.js` is the curtain/marquee/silhouette opening, `src/scene3d.js` the 3D background
- `tools/` contains the one-off scripts that produced the images in `public/assets/`
  (silhouette from the party video, title cut from the poster, light logo, QR + poster)

Made by Youssef Abbes for the ESPRIT Student Committee.
