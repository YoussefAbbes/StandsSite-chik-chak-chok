# Réservation des tickets: in-site form → Google Sheet (design)

Date: 2026-11-25 · Status: approved (blocs A, C, G, IJK, M, E)

## Intent
Stands exist only in Bloc A, G and ESB. Students elsewhere can reserve a ticket **from the
site itself**: they enter where they'll be (bloc + room) and when, and a team member brings
the ticket there. They pay **20 DT cash on delivery**. Every reservation lands automatically
in a **Google Sheet shared with the whole team**, so no one has to copy anything.

## Decided with the owner
- The form lives **inside the site**, in the party design (not Tally, not a Google Form).
- Fields: name, **ESPRIT student ID (not the CIN)**, phone, **bloc → room dropdowns** (rooms
  follow the bloc), **free date + time** (no slots).
- **One reservation per student ID.**
- Payment: 20 DT cash when the team meets the student. **No confirmation code.**
- Destination: a Google Sheet every team member can open.

## Approaches considered
1. **Own form + Google Apps Script web app → Sheet (chosen).** Full party design, dependent
   dropdowns, server-side duplicate check. Owner deploys the script once (5 min).
2. Tally embedded in the site: fast, but looks like Tally on the free plan and the owner
   still builds every question in Tally. Rejected: doesn't match the design.
3. Tally/Google Form linked out: rejected, the owner wants the form inside the site.

## Design (builder's calls marked *)
### Site
- The **"Réserver maintenant"** button (hero + floating pill, already built) opens a
  full-screen **reservation sheet** on phones (centred card on desktop): velvet card, gold
  arch + bulbs, Rakkas titles. `#reserver` in the URL opens it directly (shareable)*.
- Fields, in order, all required:
  1. Nom et prénom (2–60 chars)
  2. Identifiant ESPRIT (3–20 letters/digits); no "pas la CIN" hint (owner)
  3. Téléphone: 8 digits, shown with a fixed "+216" prefix
  4. Bloc: tappable gold chips (owner asked for a nicer form) → 5. Salle (dropdown of that bloc's room codes, or a text box)
  6. Jour: date picker limited to **today → 2 Dec 2026***
  7. Heure: free time picker
  8. ☐ "Je paierai 20 DT en espèces à la remise du ticket"
- Layout: three numbered step cards (1 · Toi, 2 · Où, 3 · Quand), a "20 DT · payé à la remise"
  badge under the title, and the Réserver button pinned to the bottom of the screen on phones.
- **No consent checkbox** (owner removed it). Data deletion after the party stays in the setup guide.
- Errors are shown inline in French. The submit button shows "Envoi…" while sending.
- **Success screen:** dancing silhouette + sparkles + "C'est noté 💃 ! Un membre de l'équipe
  passera te voir en salle {salle} le {jour} à {heure}. Prépare 20 DT."
- **Duplicate ID:** "Tu as déjà une réservation avec cet identifiant. Contacte l'équipe
  si tu veux la modifier" + the info phone numbers.
- **Network failure:** "Oups, réessaie" + the info phone numbers as a fallback.
- Editable from github.com in `public/data.json` (no code):
  `"reservation": { "endpoint": "https://script.google.com/macros/s/…/exec",
  "lastDay": "2026-12-02", "rooms": { "Bloc C": ["C 0-1", "C 1-1", …], … } }`.
  No endpoint → the button is hidden. The structure check validates this block.
- Security: the CSP gains only `connect-src https://script.google.com
  https://script.googleusercontent.com`. All text is inserted via textContent, as now.
  Nothing is stored in the browser.

### Google Apps Script (owner pastes it into the Sheet and deploys it)
- `doPost`: parse JSON → validate types/lengths again → **honeypot** field must be empty →
  **LockService** lock → if the student ID already exists in the Sheet, reply
  `{ok:false, error:"duplicate"}` → else append a row and reply `{ok:true}`.
- Every cell value starting with `= + - @` is prefixed with `'` (blocks **formula
  injection** into the team's Sheet).
- Columns: `Reçu le · Nom · Identifiant · Téléphone · Bloc · Salle · Jour · Heure ·
  Statut (default "À livrer") · Livré par · Notes`. Statut gets a dropdown + colours
  (the script sets this up on first run)*.
- Deployed as a web app: *Execute as: me · Who has access: Anyone*. The Sheet itself
  stays private, shared only with the team.

## Non-goals
Time slots, confirmation codes, online payment, editing or cancelling from the site,
email/SMS notifications.

## Blocs and rooms (owner)
Blocs offered: **Bloc A, Bloc C, Bloc G, Bloc IJK, Bloc M, Bloc E** (in that order).
Room codes not provided yet, so each bloc's `rooms` list may be empty:
- non-empty list → Salle is a dropdown of those codes;
- empty list → Salle is a text box, placeholder "ex. C 1-1", accepted pattern
  letter(s) + optional space + floor-room (`C 1-1`, `I 2-10`, `E0-3`), stored as typed (trimmed, upper-cased)*.
Room lists can be added later in data.json without code.

## Needed from the owner after the build
Create the Sheet, paste the script, deploy, send the web-app link.
