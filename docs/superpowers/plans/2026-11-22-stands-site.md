# Shik Shak Shok Stands Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-page, poster-themed, animated site listing each bloc's stand and its reachable responsables, hosted at a fixed GitHub Pages URL that the poster's QR code points to.

**Architecture:** Static Vite site. `public/data.json` holds all editable content and is fetched at runtime; `src/data.js` normalises/filters it; `src/stands.js` renders cards; `src/intro.js` runs the curtain → marquee → silhouette opening; `src/scene3d.js` draws the Three.js background. Media assets are produced once by scripts in `tools/` from the user's videos and poster, and committed as small web files.

**Tech Stack:** Node 22, Vite 6, Three.js r170, GSAP 3, Vitest + jsdom; Python 3.13 with OpenCV, Pillow, numpy, pypdf, reportlab (all installed); `ffmpeg-static` (npm dev dependency) for audio.

**Spec:** `docs/superpowers/specs/2026-11-22-stands-site-design.md`

## Global Constraints

- Public URL: `https://youssefabbes.github.io/StandsSite-chik-chak-chok/` → Vite `base: '/StandsSite-chik-chak-chok/'`.
- A person is shown only if they have **both** a non-empty name and a phone number. Placeholder names (`Responsable`, `Responsable 1`, `Responsable 2`) are never shown.
- Every bloc is shown as a stand with a "Stand + 🎟️ Tickets" badge, contacts or not.
- Phones are Tunisian 8-digit numbers: display `25 615 375`, link `tel:+21625615375`, WhatsApp `https://wa.me/21625615375`.
- Email `Comite.deseleves@Esprit.tn`; Instagram `https://www.instagram.com/comite_des_etudiants_esprit/` and `https://www.instagram.com/shikshakshok_tn/`; info numbers `95 195 235`, `25 546 886`.
- Event line: `2 ديسمبر 2026 · 20h · ESPRIT Bloc E`. Taglines: "Chaque bloc a son stand — les tickets sont là-bas 🎟️" and "Check the blocs, follow the music 🎶".
- Palette from the poster: background `#1a0405`, velvet `#7a0c10`, red glow `#e0261b`, gold `#f2c15b`, gold-light `#ffe3a3`.
- Initial page weight ≤ 3 MB; music file loaded only after the Enter tap.
- `prefers-reduced-motion`: no intro animation, no 3D loop, static gradient background.
- **Deviation from spec (builder call):** silhouette ships as a WebP sprite sheet drawn on a `<canvas>` instead of WebM/HEVC video — HEVC-with-alpha cannot be encoded on Windows, and a sprite works identically on iPhone and Android.
- Raw videos never enter the repo.

## Review Focus

1. `data.json` fails to load (offline/flaky campus network) → page still shows the event info, email and info numbers; stands area shows a retry message, not a blank. *(Task 2 test `renders fallback when stands is null`.)*
2. Phone typed with spaces/dots/`+216` prefix in `data.json` after a later edit → still normalised correctly. *(Task 1 test `normalizes phone formats`.)*
3. A bloc listed twice in `data.json` → merged into one card. *(Task 1 test `merges duplicate blocs`.)*
4. iPhone Safari with sound blocked → Enter still dismisses the intro even if `audio.play()` rejects. *(Task 3 test `enter resolves when play rejects`.)*
5. Low-end phone / WebGL unavailable → 3D layer silently skipped, page fully usable. *(Task 4 test `initScene returns null without WebGL`.)*

---

### Task 1: Project scaffold + data model

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html` (bare shell), `.gitignore` (`node_modules`, `dist`), `public/data.json`, `src/data.js`
- Test: `tests/data.test.js`

**Interfaces:**
- Produces: `normalizePhone(raw: string) -> {display: string, tel: string, wa: string} | null`; `normalizeStands(raw: {stands: RawStand[]}) -> Stand[]` where `Stand = {bloc: string, note?: string, people: {name: string, phone: {display, tel, wa}}[]}`; `loadData(url?: string) -> Promise<{event, contact, stands: Stand[] | null}>` (stands `null` on fetch failure).

- [ ] **Step 1:** `npm init`, add deps `three gsap`, dev deps `vite vitest jsdom ffmpeg-static`; scripts `dev`, `build`, `test` (`vitest run`). `vite.config.js` sets `base` per Global Constraints and `test.environment: 'jsdom'`.
- [ ] **Step 2: Write `public/data.json`** with `event` (date line, place), `contact` (email, info numbers, both Instagram URLs), and `stands` in this order: Bloc G (people: Hamma, Ahmed Akacha, no phones), Bloc ESB (Youusef Abbes, no phone), Bloc H (Hiba Ghrandi `25615375`, Isra Radaoui no phone), Bloc IJK & M (Mohamed Nour Amri `58431239`, Heni Troudi `22628105`), Bloc M (Responsable 1, Responsable 2), Bloc A (`note`: "Ay wehed f bureau — شبّاك التذاكر", no people). Keeping phone-less people in the file lets an editor just add a number later.
- [ ] **Step 3: Write failing tests** in `tests/data.test.js`:
  - `normalizes phone formats`: `'25615375'`, `'25 615 375'`, `'+216 25.615.375'`, `'0021625615375'` all → `{display:'25 615 375', tel:'tel:+21625615375', wa:'https://wa.me/21625615375'}`; `''`, `'123'`, `undefined` → `null`.
  - `filters people without name or phone`: from the Step 2 file, Bloc H has exactly `['Hiba Ghrandi']`, Bloc IJK & M has `['Mohamed Nour Amri','Heni Troudi']`, Bloc G/ESB/M have `[]`.
  - `drops placeholder names`: `{name:'Responsable 1', phone:'22222222'}` is removed.
  - `keeps every bloc`: result has 6 blocs in file order; Bloc A keeps its `note`.
  - `merges duplicate blocs`: two `Bloc G` entries → one, people concatenated.
- [ ] **Step 4:** Run `npm test` → FAIL (module missing).
- [ ] **Step 5:** Implement `src/data.js` (strip non-digits, drop leading `216`/`00216`, require exactly 8 digits; placeholder match `/^responsable\s*\d*$/i`). `loadData` fetches `${import.meta.env.BASE_URL}data.json?v=${Date.now()}` and catches errors → `stands: null`.
- [ ] **Step 6:** `npm test` → PASS.
- [ ] **Step 7:** Commit `feat: scaffold vite site and stand data model`.

### Task 2: Page layout + stand cards

**Files:**
- Create: `src/stands.js`, `src/main.js`, `src/styles.css`, `public/fonts/` (none — Google Fonts link: `Aref Ruqaa` for Arabic display, `Cairo` for Arabic body, `Poppins` for Latin)
- Modify: `index.html`
- Test: `tests/stands.test.js`

**Interfaces:**
- Consumes: `loadData`, `Stand` (Task 1).
- Produces: `renderStands(container: HTMLElement, stands: Stand[] | null) -> void`; `renderContact(container: HTMLElement, contact) -> void`. `index.html` exposes `#intro`, `#bg3d` (canvas), `#hero`, `#stands`, `#contact`, `footer`.

- [ ] **Step 1: Write failing tests:**
  - `renders one card per bloc`: 6 `.stand-card`, each containing text `Tickets`.
  - `renders call and whatsapp links`: Bloc H card has `a[href="tel:+21625615375"]` and `a[href="https://wa.me/21625615375"]`, link text shows `25 615 375`.
  - `shows stand hint when no people`: Bloc G card contains `Passe au stand`.
  - `renders fallback when stands is null`: container shows a `.stands-error` with a `button` that re-calls the loader.
  - `renderContact` outputs `a[href="mailto:Comite.deseleves@Esprit.tn"]`, `tel:+21695195235`, `tel:+21625546886`, and both Instagram hrefs.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement with DOM APIs (`textContent`, no `innerHTML` with data). Sections top to bottom: hero (gold title image `assets/title.webp`, "في إسبري", date line, the two taglines), `#stands` grid (1 column mobile, 2 at ≥720 px), `#contact` ("Une question ?" + mail button + info numbers), footer (ESPRIT logo, two Instagram links). Cards: dark velvet panel, gold 1 px border, Moorish arch top (CSS `border-radius: 50% 50% 12px 12px / 30% 30% 12px 12px`), bulb dots on the border that blink in sequence via CSS animation. Cards reveal on scroll with GSAP ScrollTrigger.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `npm run dev`, open at 375×812 in the browser pane: all numbers readable, tap targets ≥ 44 px, no horizontal scroll.
- [ ] **Step 6:** Commit `feat: stand cards, contact and page layout`.

### Task 3: Media assets + intro scene

**Files:**
- Create: `tools/extract_silhouette.py`, `tools/cut_title.py`, `tools/logo_light.py`, `tools/extract_audio.mjs`, `public/assets/silhouette.webp` + `silhouette.json`, `public/assets/title.webp`, `public/assets/esprit-light.png`, `public/assets/music.mp3`, `src/intro.js`
- Test: `tests/intro.test.js`

**Interfaces:**
- Consumes: DOM `#intro` (Task 2).
- Produces: `playSilhouette(canvas: HTMLCanvasElement, sheetUrl: string, meta: {frames, cols, w, h, fps}) -> () => void` (returns stop fn); `runIntro(root: HTMLElement, {audio: HTMLAudioElement, reducedMotion: boolean}) -> Promise<void>` (resolves after Enter tap or skip).

- [ ] **Step 1: Silhouette.** `tools/extract_silhouette.py <video> <out_dir>`: scan the "سنتين Shik Shak Shok" video, find shots where the LED screen is frontal (largest bright-red quad); per frame, crop + perspective-warp the screen, threshold the dark figure against red (HSV value < ~60 inside the red area), keep the largest contour, smooth (morph close + Gaussian blur + re-threshold), centre on a fixed 256×512 canvas, pick a ~2–3 s loop of the cleanest consecutive frames (≤ 48 frames, 12 fps), pack into a WebP sprite sheet (alpha) + `silhouette.json`. Print frame count and file size; must be ≤ 600 KB. Inspect a contact sheet of the frames visually; if the figure is broken/too blurry, fall back to drawing the same poses as smoothed vector contours traced from the cleanest frames.
- [ ] **Step 2: Title.** `tools/cut_title.py`: from the 7016×4961 poster artwork extracted from `Shik_Shak_Shok_A2_Print.pdf`, crop the "شيك شك شوك" + "في إسبري" block, key out the dark background by luminance into alpha, export `title.webp` at 1200 px wide (≤ 250 KB).
- [ ] **Step 3: Logo.** `tools/logo_light.py`: from the removebg ESPRIT logo, recolour black pixels to `#f5efe6`, keep red, trim transparent margins → `esprit-light.png`.
- [ ] **Step 4: Music.** `tools/extract_audio.mjs` uses `ffmpeg-static` to cut a 30 s loop from the silhouette video's audio → `music.mp3` 128 kbps.
- [ ] **Step 5: Write failing tests** (`tests/intro.test.js`, jsdom, GSAP timelines mocked to complete immediately):
  - `enter resolves when play rejects`: `audio.play` returns a rejected promise → `runIntro` still resolves after clicking `#enter`, and `#intro` gets class `done`.
  - `reduced motion skips animation`: with `reducedMotion: true`, `#enter` is visible immediately and no GSAP timeline is created.
  - `skip button resolves`: clicking `#skip` resolves without audio.
- [ ] **Step 6:** `npm test` → FAIL.
- [ ] **Step 7:** Implement intro: full-screen layer; two CSS velvet curtain panels (layered gradients) slide apart; two conic-gradient spotlights sweep; a marquee rectangle whose ~40 bulbs (`span` dots) light in sequence; silhouette canvas inside with red radial backlight; title fades in with a moving gold sheen (masked gradient); then `Enter 🎶` button. Enter → `audio.play().catch(()=>{})`, curtains/fade out, resolve. A small floating 🔊/🔇 toggle stays afterwards.
- [ ] **Step 8:** `npm test` → PASS; check the intro in the browser pane at mobile size.
- [ ] **Step 9:** Commit `feat: poster-themed intro with dancing silhouette` (assets included; raw videos not).

### Task 4: Three.js background

**Files:**
- Create: `src/scene3d.js`, `src/objects/lantern.js`, `src/objects/coin.js`, `src/objects/fan.js`, `src/objects/darbuka.js`
- Test: `tests/scene3d.test.js`

**Interfaces:**
- Consumes: `#bg3d` canvas (Task 2).
- Produces: `initScene(canvas: HTMLCanvasElement, {reducedMotion: boolean}) -> {dispose(): void} | null`; each object module exports `create<Name>(): THREE.Object3D`.

- [ ] **Step 1: Write failing tests:** `initScene returns null without WebGL` (jsdom has no WebGL context); `initScene returns null when reducedMotion`; each `create*()` returns an `Object3D` with ≥ 1 mesh child (geometry only, no renderer needed).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement: lantern = lathe-geometry body + cut-out cylinder cage with point light inside; coin = thin cylinder with bevel; fan = half-disc of thin box ribs; darbuka = lathe goblet profile. Shared gold `MeshStandardMaterial` (metalness 1, roughness 0.3) with a red/amber environment from `RoomEnvironment`; `UnrealBloomPass` (strength ~0.8). ~14 objects drifting and slowly rotating; camera follows scroll position and `deviceorientation` (if granted) slightly. `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`; pause on `visibilitychange`; resize handler.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** In the browser pane at mobile size: steady animation, cards stay readable above the 3D (cards have opaque-ish backgrounds).
- [ ] **Step 6:** Commit `feat: 3D floating party objects background`.

### Task 5: Deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md` (how to edit `public/data.json` on github.com)

**Interfaces:**
- Consumes: `npm run build` → `dist/`.

- [ ] **Step 1:** Workflow on push to `main`: checkout → setup-node 22 → `npm ci` → `npm test` → `npm run build` → `actions/upload-pages-artifact` (`dist`) → `actions/deploy-pages`.
- [ ] **Step 2:** `npm run build && npx vite preview` → page loads under `/StandsSite-chik-chak-chok/` with all assets.
- [ ] **Step 3:** Commit, then (with the user's go-ahead) push to `origin main`; the user enables Settings → Pages → Source: GitHub Actions if not already set.
- [ ] **Step 4:** Open the public URL in the browser pane; data, intro, 3D all load.

### Task 6: QR code + poster

**Files:**
- Create: `tools/make_qr_poster.py`, outputs in the project folder (outside the repo): `qr/qr.svg`, `qr/qr.png` (2000 px), `Shik_Shak_Shok_A2_Print_QR.pdf`

**Interfaces:**
- Consumes: the public URL (Global Constraints).

- [ ] **Step 1:** Locate the empty QR frame in the poster artwork (bottom-right box under "لمعرفة نقاط البيع"), convert its pixel box (7016×4961 image on a 420×594 mm page) to PDF points.
- [ ] **Step 2:** Build the QR with `reportlab.graphics.barcode.qr.QrCodeWidget` (error level `M`), dark `#1a0405` modules on a cream `#fff6e6` rounded square with quiet zone, sized to fill the frame's inside (≈ 8–10 cm); merge it as a vector overlay onto the original page with pypdf; export SVG via `renderSVG` and PNG via Pillow from the same matrix.
- [ ] **Step 3:** Render the output PDF region to an image and visually check placement; decode the PNG with `cv2.QRCodeDetector` → must equal the public URL exactly.
- [ ] **Step 4:** Commit the script only.
