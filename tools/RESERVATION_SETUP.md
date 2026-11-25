# Réservations: set up the Google Sheet (≈ 5 minutes, once)

The site's form sends each reservation to a small Google script attached to a Sheet.
You set it up once with the committee's Google account; after that it's automatic.

## 1. Create the Sheet
1. Go to **sheets.google.com** (committee account) → **Blank spreadsheet**.
2. Name it **Réservations Shik Shak Shok**.

## 2. Paste the script
1. In the Sheet: **Extensions → Apps Script**.
2. Delete everything in the editor, paste the whole content of
   `tools/reservation-apps-script.gs`, and click **💾 Save**.

## 3. Run `setup` once
1. At the top of the editor, choose the function **setup** → click **▶ Run**.
2. Google asks for permission: **Review permissions** → choose the committee account →
   *"Google hasn't verified this app"* → **Advanced** → **Go to … (unsafe)** → **Allow**.
   (This warning appears for every personal script. The script only touches this Sheet.)
3. Back in the Sheet, a **Réservations** tab appears with the gold header row.

## 4. Deploy it as a web app
1. In the editor: **Deploy → New deployment** → ⚙ → **Web app**.
2. **Execute as: Me** · **Who has access: Anyone** → **Deploy**.
3. Copy the **Web app URL**. It ends with **/exec**, like
   `https://script.google.com/macros/s/AKfy…/exec`.
4. **Send that link to Youssef.** It goes into `public/data.json` → `reservation.endpoint`.

"Anyone" means anyone can *send* a reservation (that's the form), not *read* the Sheet.
The Sheet stays private.

## 5. Share with the team
**Share** (top right) → add each team member → **Editor**.
Each reservation appears as a new row within seconds:

`Reçu le · Nom · Identifiant · Téléphone · Bloc · Salle · Jour · Heure · Statut · Livré par · Notes`

Team routine: sort by **Jour** then **Heure**, deliver, set **Statut** to **Livré**
(green) and write your name in **Livré par**. **Annulé** turns grey.

## If you change the script later
**Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy.**
The /exec link stays the same.

## After the party (2 Dec)
Delete the rows (phone numbers and IDs shouldn't be kept), then
**Deploy → Manage deployments → Archive** so the link stops accepting reservations.
