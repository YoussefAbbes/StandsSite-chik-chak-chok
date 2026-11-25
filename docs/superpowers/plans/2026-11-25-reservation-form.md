# Reservation Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students reserve a ticket in a party-themed form inside the site; each reservation is appended to the team's Google Sheet by an Apps Script web app that blocks duplicate student IDs.

**Architecture:** `public/data.json` gains a `reservation` block (endpoint, last day, blocs + rooms). `src/reserve-form.js` holds pure validation + submission; `src/reserve-ui.js` builds the sheet UI; `tools/reservation-apps-script.gs` is the server side the owner pastes into the Sheet. The staged "Tally link" button work is reused: same button, now opening the in-site sheet.

**Tech Stack:** existing Vite + vanilla JS + Vitest/jsdom; Google Apps Script (V8) tested in Node via `vm` with mocked `SpreadsheetApp`/`LockService`/`ContentService`.

**Spec:** `docs/superpowers/specs/2026-11-25-reservation-form-design.md`

## Global Constraints

- Blocs, in order: `Bloc A, Bloc C, Bloc G, Bloc IJK, Bloc M, Bloc E`.
- `data.json` shape: `"reservation": { "endpoint": "<https://script.google.com/macros/s/…/exec or empty>", "lastDay": "2026-12-02", "blocs": [ { "bloc": "Bloc A", "rooms": [] }, … ] }`. No/invalid endpoint → button hidden. Endpoint must be https and host `script.google.com`.
- Room text fallback pattern (case-insensitive, trimmed, stored upper-case): `^[A-Z]{1,3} ?\d{1,2}-\d{1,2}$`.
- Field rules: name 2–60 chars; ID `^[A-Za-z0-9]{3,20}$`; phone = `normalizePhone()` valid (8 Tunisian digits); day ∈ [today, lastDay] (ISO `YYYY-MM-DD`, local date); time `^\d{2}:\d{2}$`; both checkboxes checked; honeypot `website` empty.
- Exact copy (French):
  - Button: `Réserver maintenant`; sub-line: `Pas de stand dans ton bloc ? On vient à toi 💃`
  - Sheet title: `Réserve ton ticket` (Arabic line above: `احجز تذكرتك`)
  - Labels: `Nom et prénom`, `Identifiant ESPRIT`, hint `pas la CIN`, `Téléphone`, `Bloc`, `Salle`, `Jour`, `Heure`
  - Checkbox 1: `Je paierai 20 DT en espèces à la remise du ticket`
  - Checkbox 2: `J'accepte que le comité utilise mes infos uniquement pour me remettre mon ticket (supprimées après la soirée)`
  - Submit: `Réserver` / sending: `Envoi…`
  - Success: `C'est noté 💃 !` + `Un membre de l'équipe passera te voir en salle {salle} le {jour JJ/MM} à {heure}. Prépare 20 DT.`
  - Duplicate: `Tu as déjà une réservation avec cet identifiant. Contacte l'équipe si tu veux la modifier.`
  - Network: `Oups, la réservation n'est pas passée. Réessaie, ou appelle l'équipe :`
- CSP adds only `connect-src 'self' https://script.google.com https://script.googleusercontent.com`; still no `unsafe-inline`/`unsafe-eval`.
- POST body: `JSON.stringify(data)` with `Content-Type: text/plain;charset=utf-8` (no CORS preflight). Response JSON `{ ok: true } | { ok: false, error: "duplicate" | "invalid" }`.
- Sheet columns: `Reçu le, Nom, Identifiant, Téléphone, Bloc, Salle, Jour, Heure, Statut, Livré par, Notes`; new rows `Statut = "À livrer"`.
- Nothing stored in the browser. All text via `textContent`.
- The glass experiment (`src/glass.css`, 3 lines in `src/main.js`) stays local and is never staged.

## Review Focus

1. Two students submit the same ID within the same second → only one row (script lock). *(Task 4 test `duplicate check runs inside the lock`.)*
2. A field starting with `=`, `+`, `-`, `@` (formula injection) → stored as text with a leading `'`. *(Task 4 test `escapes formula-like values`.)*
3. The endpoint answers non-JSON or times out (Google error page, weak campus Wi-Fi) → network message with phones, form keeps the values. *(Task 2 test `non-JSON or timeout → network`.)*
4. Double-tap on Réserver → one request. *(Task 3 test `submit button disabled while sending`.)*
5. Bloc changed after picking a room → room resets, stale room never sent. *(Task 3 test `changing bloc clears the room`.)*

---

### Task 1: Reservation config in data.json

**Files:** Modify `public/data.json`, `tests/fixtures/data.json`, `src/data.js`; remove the staged `reservationUrl` (field + tests in `tests/reserve.test.js` rewritten); Test `tests/reserve-config.test.js`

**Interfaces — Produces:** `normalizeReservation(raw) -> { endpoint: string, lastDay: string, blocs: {bloc: string, rooms: string[]}[] } | null` (null when endpoint missing/invalid or no blocs); `loadData()` result gains `reservation`; `validateData` messages: `"reservation": "endpoint" must be a https://script.google.com link`, `"reservation": "lastDay" must look like 2026-12-02`, `"reservation" bloc #N: "rooms" must be a list [ … ]`.

- [ ] Tests: normalize valid block (6 blocs in order, rooms default `[]`); endpoint `http://…` or other host → null; empty endpoint → null; non-string rooms dropped; validateData messages above; live `public/data.json` still validates.
- [ ] RED → implement → GREEN (`npx vitest run`).
- [ ] `public/data.json`: `reservation` with empty endpoint (button hidden until the owner deploys), `lastDay: "2026-12-02"`, the 6 blocs with `rooms: []`.

### Task 2: Pure form logic

**Files:** Create `src/reserve-form.js`; Test `tests/reserve-form.test.js`

**Interfaces — Produces:** `validateReservation(values, { today: string, lastDay: string, blocs }) -> { ok: boolean, errors: Record<field, string>, data?: {name, studentId, phone, bloc, salle, day, time, website} }` (phone stored as 8 digits); `submitReservation(endpoint, data, { fetchImpl = fetch, timeoutMs = 15000 }) -> Promise<{ ok: true } | { ok: false, error: 'duplicate' | 'invalid' | 'network' }>`; `formatDayFr('2026-11-28') -> '28/11'`.

- [ ] Tests (one per rule): each field rule from Global Constraints with an invalid and a valid value; room must be in the bloc's list when the list is non-empty, else match the fallback pattern; `fetchImpl` called once with POST + text/plain body; `{ok:false,error:'duplicate'}` passed through; **`non-JSON or timeout → network`** (resolve with HTML text; and a never-resolving fetch with `timeoutMs: 20`).
- [ ] RED → implement (AbortController for timeout) → GREEN.

### Task 3: Reservation sheet UI

**Files:** Create `src/reserve-ui.js`; Modify `src/stands.js` (`renderReserve` becomes a `<button>`), `src/styles.css`; Test `tests/reserve-ui.test.js`

**Interfaces — Consumes:** Task 1 `reservation`, Task 2 functions, `playSilhouette(canvas, url, meta)` from `src/intro.js`, `icon()`. **Produces:** `renderReserve(container, reservation, { compact, onOpen })` (hidden when `reservation` is null); `openReserveSheet(reservation, { phones: {display, tel}[], today?: string, submit?: fn, silhouette }) -> { close(): void }` mounting into `document.body`.

- [ ] Tests: all labels/copy exactly as Global Constraints; Bloc options = 6 blocs in order; bloc with rooms → `select[name=salle]` with those options, without → `input[name=salle]` placeholder `ex. C 1-1`; **`changing bloc clears the room`**; invalid submit shows inline errors and does not call `submit`; **`submit button disabled while sending`** (two clicks → one call, label `Envoi…`); success → `C'est noté 💃 !` and the exact sentence with salle/JJ-MM/heure; duplicate → duplicate copy + `tel:` links for phones; network → network copy + phones, values kept; close button + Escape remove the sheet and restore body scroll; `#reserver` hash support exposed as `shouldAutoOpen(location) -> boolean`.
- [ ] RED → implement → GREEN. Styling: full-screen sheet ≤ 720 px wide (centred card above), velvet + gold arch + bulbs + Rakkas; date input `min=today max=lastDay`.

### Task 4: Apps Script (server side) + owner guide

**Files:** Create `tools/reservation-apps-script.gs`, `tools/RESERVATION_SETUP.md`; Test `tests/apps-script.test.js` (loads the `.gs` with `vm`, mocks Google services)

**Interfaces — Produces:** `doPost(e) -> TextOutput(JSON)`; pure helpers `validatePayload(obj) -> string|null`, `escapeCell(v) -> string`, `setup()` (creates header row, Statut dropdown + colours, freezes row 1).

- [ ] Tests: valid payload → one row appended with columns in order and `À livrer`; same ID twice → second returns `duplicate`, no row; **`duplicate check runs inside the lock`** (lock acquired before reading IDs, released after); **`escapes formula-like values`**; honeypot filled → `ok:true` but no row (bots get no signal); invalid JSON/missing field → `invalid`.
- [ ] RED → implement → GREEN.
- [ ] `RESERVATION_SETUP.md`: create Sheet → Extensions → Apps Script → paste → run `setup` once (authorise) → Deploy → New deployment → Web app, *Execute as: Me*, *Who has access: Anyone* → copy the `/exec` link → share Sheet with team as Editors → send link. After the party: delete rows, archive deployment.

### Task 5: Wiring, CSP, verification

**Files:** Modify `src/main.js` (staged part only), `index.html`, `build/security.js`, `tests/security.test.js`, `README.md`

- [ ] Security test: CSP contains `connect-src 'self' https://script.google.com https://script.googleusercontent.com`, still no unsafe-*; RED → update `build/security.js` → GREEN.
- [ ] Wire: hero + floating buttons call `openReserveSheet`; auto-open on `#reserver`.
- [ ] `npm test`, `npm run check-data`, `npm run build` green; local check at 375 px and 320 px with a fake endpoint stub (`?reserveStub=ok|duplicate|network`, dev only, `import.meta.env.DEV`): open, validate, each result screen, no horizontal scroll.
- [ ] README: how to paste room lists and the endpoint into `data.json`.
- [ ] Stage only feature files (never `src/glass.css` or the glass lines); **no commit/push until the owner reviews locally.**
