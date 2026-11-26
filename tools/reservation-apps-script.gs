/**
 * Shik Shak Shok — ticket reservations → this Google Sheet.
 *
 * Paste this whole file in the Sheet: Extensions → Apps Script.
 * Run `setup` once (authorise), then Deploy → New deployment → Web app,
 * "Execute as: Me", "Who has access: Anyone". Send the /exec link to Youssef.
 * Full guide: tools/RESERVATION_SETUP.md
 *
 * Security: the link is public, so every request is treated as untrusted:
 * size limit, field checks, bot trap, one reservation per phone number (under a lock),
 * and no cell can start like a formula.
 */

/** shown by the /exec link in a browser, so anyone can see which code is live */
var VERSION = 'sans-identifiant';
var SHEET_NAME = 'Réservations';
var HEADERS = ['Reçu le', 'Nom', 'Téléphone', 'Bloc', 'Salle', 'Jour', 'Heure', 'Statut', 'Livré par', 'Notes'];
var STATUSES = ['À livrer', 'Livré', 'Annulé'];
var MAX_BODY = 5000;
var PHONE_COL = 3; // column C

/**
 * Every typed value is stored as plain text: a leading ' stops formulas (= + - @)
 * and stops Sheets from turning "09876543" into 9876543 or "TRUE" into a checkbox value.
 */
function escapeCell(value) {
  return "'" + String(value == null ? '' : value).slice(0, 100);
}

/** Same rules as the site form. Returns null when the payload is acceptable. */
function validatePayload(p) {
  if (!p || typeof p !== 'object') return 'invalid';
  var str = function (v) { return typeof v === 'string' ? v.trim() : ''; };
  var name = str(p.name);
  if (name.length < 2 || name.length > 60) return 'name';
  if (!/^\d{8}$/.test(str(p.phone))) return 'phone';
  if (!str(p.bloc) || str(p.bloc).length > 20) return 'bloc';
  if (!str(p.salle) || str(p.salle).length > 12) return 'salle';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(p.day))) return 'day';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(str(p.time))) return 'time';
  return null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function doPost(e) {
  var body = e && e.postData && e.postData.contents;
  if (!body || body.length > MAX_BODY) return json_({ ok: false, error: 'invalid' });
  var p;
  try {
    p = JSON.parse(body);
  } catch (err) {
    return json_({ ok: false, error: 'invalid' });
  }
  if (p && p.website) return json_({ ok: true }); // bot trap: pretend it worked, write nothing
  if (validatePayload(p)) return json_({ ok: false, error: 'invalid' });

  var phone = p.phone.trim();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // two submissions at the same second are checked one after the other
  try {
    var sheet = getSheet_();
    var last = sheet.getLastRow();
    var phones = last > 1 ? sheet.getRange(2, PHONE_COL, last - 1, 1).getValues() : [];
    for (var i = 0; i < phones.length; i++) {
      if (String(phones[i][0]).replace(/^'/, '').trim() === phone) {
        return json_({ ok: false, error: 'duplicate' });
      }
    }
    sheet.appendRow([
      new Date(),
      escapeCell(p.name.trim()),
      escapeCell(phone),
      escapeCell(p.bloc.trim()),
      escapeCell(p.salle.trim()),
      escapeCell(p.day.trim()), // ISO text sorts correctly
      escapeCell(p.time.trim()),
      STATUSES[0],
      '',
      '',
    ]);
    SpreadsheetApp.flush(); // commit the row before the lock is released, so the next check sees it
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/** Opening the /exec link in a browser just says the service is up. */
function doGet() {
  return json_({ ok: true, service: 'shik-shak-shok-reservations', version: VERSION });
}

/** Run once from the editor: header style, frozen row, Statut dropdown + colours. */
function setup() {
  var sheet = getSheet_();
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f2c15b');
  sheet.setFrozenRows(1);
  var statusRange = sheet.getRange(2, HEADERS.indexOf('Statut') + 1, sheet.getMaxRows() - 1, 1);
  statusRange.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build()
  );
  var colour = function (text, bg) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setBackground(bg).setRanges([statusRange]).build();
  };
  sheet.setConditionalFormatRules([colour('À livrer', '#ffd8a8'), colour('Livré', '#b7e4c7'), colour('Annulé', '#d9d9d9')]);
  [150, 170, 110, 80, 80, 100, 70, 100, 120, 200].forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
}
