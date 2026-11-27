// Runs tools/reservation-apps-script.gs in Node with fake Google services.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const SRC = readFileSync(resolve(process.cwd(), 'tools/reservation-apps-script.gs'), 'utf8');

function makeGoogle(startRows = []) {
  const events = [];
  const rows = startRows.map((r) => [...r]);
  const sheet = {
    appendRow: (r) => { events.push('append'); rows.push(r); },
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(0, ...rows.map((r) => r.length)),
    insertColumnAfter: (col) => { events.push('insertColumn'); rows.forEach((r) => r.splice(col, 0, '')); },
    getRange: (row, col, nRows, nCols) => ({
      getValues: () => {
        if (row === 1 && nCols) { events.push('header'); return [rows[0].slice(col - 1, col - 1 + nCols)]; }
        events.push('read');
        return rows.slice(row - 1, row - 1 + nRows).map((r) => [r[col - 1]]);
      },
      setValue(v) { rows[row - 1][col - 1] = v; return this; },
      setFontWeight() { return this; }, setBackground() { return this; }, setDataValidation() { return this; },
    }),
    setFrozenRows() {}, getMaxRows: () => 1000, setColumnWidth() {}, setConditionalFormatRules() {}, getConditionalFormatRules: () => [],
  };
  const ss = { getSheetByName: () => (rows.length || events.includes('insert') ? sheet : null), insertSheet: () => { events.push('insert'); return sheet; } };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => events.push('flush') },
    LockService: { getScriptLock: () => ({ waitLock: () => events.push('lock'), releaseLock: () => events.push('unlock') }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }),
    },
    Date,
    JSON,
  };
  vm.createContext(context);
  vm.runInContext(SRC, context);
  return { context, rows, events };
}

const good = { name: 'Amira Ben Salah', phone: '25615375', bloc: 'Bloc C', salle: 'C 1-2', day: '2026-11-28', time: '10:30', website: '', tickets: 2 };
const post = (g, body) => JSON.parse(g.context.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text);

let g;
beforeEach(() => { g = makeGoogle(); });

describe('reservation Apps Script', () => {
  it('appends one row with the columns in order and Statut "À livrer"', () => {
    expect(post(g, good)).toEqual({ ok: true });
    const dataRows = g.rows.slice(1);
    expect(g.rows[0]).toEqual(['Reçu le', 'Nom', 'Téléphone', 'Bloc', 'Salle', 'Jour', 'Heure', 'Tickets', 'Statut', 'Livré par', 'Notes']);
    expect(dataRows).toHaveLength(1);
    const r = dataRows[0];
    expect(r[0]).toBeInstanceOf(Date);
    expect(r.slice(1)).toEqual(["'Amira Ben Salah", "'25615375", "'Bloc C", "'C 1-2", "'2026-11-28", "'10:30", 2, 'À livrer', '', '']);
  });

  it('same phone twice → duplicate, no second row', () => {
    post(g, good);
    expect(post(g, { ...good, name: 'Autre Nom', salle: 'C 2-3' })).toEqual({ ok: false, error: 'duplicate' });
    expect(g.rows.slice(1)).toHaveLength(1);
  });

  it('duplicate check runs inside the lock', () => {
    post(g, good); // first row (sheet created, nothing to read yet)
    g.events.length = 0;
    post(g, { ...good, phone: '98123456' });
    const seq = g.events.filter((e) => ['lock', 'read', 'append', 'flush', 'unlock'].includes(e));
    expect(seq).toEqual(['lock', 'read', 'append', 'flush', 'unlock']); // written for real before the next one reads
  });

  it('escapes formula-like values', () => {
    post(g, { ...good, name: '=IMPORTXML("http://x", "//a")' });
    expect(g.rows[1][1]).toBe('\'=IMPORTXML("http://x", "//a")');
    for (const v of ['+33', '-1', '@me', 'Amira', 'TRUE', '12/12', '09876543']) expect(g.context.escapeCell(v)).toBe("'" + v);
  });

  it('the phone stays text, so its duplicate is still caught', () => {
    post(g, good);
    expect(g.rows[1][2]).toBe("'25615375");
    expect(post(g, good)).toEqual({ ok: false, error: 'duplicate' });
  });

  it('an old page still sending a student ID is accepted, and the ID is not stored', () => {
    expect(post(g, { ...good, studentId: '211JMT1234' })).toEqual({ ok: true });
    expect(g.rows[1]).toHaveLength(11);
    expect(g.rows[1]).not.toContain("'211JMT1234");
  });

  it('opening the link shows which version is live', () => {
    expect(JSON.parse(g.context.doGet().text)).toEqual({ ok: true, service: 'shik-shak-shok-reservations', version: 'tickets' });
  });

  it('honeypot filled → ok but nothing written', () => {
    expect(post(g, { ...good, website: 'spam.example' })).toEqual({ ok: true });
    expect(g.rows.slice(1)).toHaveLength(0);
  });

  it('invalid JSON, missing or malformed fields → invalid, nothing written', () => {
    expect(post(g, 'not json')).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, { ...good, phone: '123' })).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, { ...good, name: '' })).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, { ...good, day: 'demain' })).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, 'x'.repeat(6000))).toEqual({ ok: false, error: 'invalid' });
    expect(g.rows.slice(1)).toHaveLength(0);
  });

  it('ticket count: 1–10 whole number stored as a number; anything else refused', () => {
    expect(post(g, { ...good, tickets: 10 })).toEqual({ ok: true });
    expect(g.rows[1][7]).toBe(10);
    for (const tickets of [0, 11, 2.5, '2', -1, null]) {
      expect(post(g, { ...good, phone: '98123456', tickets }), String(tickets)).toEqual({ ok: false, error: 'invalid' });
    }
    expect(g.rows.slice(1)).toHaveLength(1);
  });

  it('an old cached page sending no ticket count still books 1 ticket', () => {
    const { tickets, ...oldPage } = good;
    expect(post(g, oldPage)).toEqual({ ok: true });
    expect(g.rows[1][7]).toBe(1);
  });

  it('same name and phone rules as the site: "Hh", one word, 88888888 refused', () => {
    for (const bad of [{ name: 'Mohamed' }, { name: 'Hh Hh' }, { name: 'Amina 123' }, { phone: '88888888' }, { phone: '12345678' }]) {
      expect(post(g, { ...good, ...bad }), JSON.stringify(bad)).toEqual({ ok: false, error: 'invalid' });
    }
    expect(post(g, { ...good, name: 'محمد علي' })).toEqual({ ok: true });
  });
});

describe('a Sheet made before the ticket count', () => {
  const OLD_HEADERS = ['Reçu le', 'Nom', 'Téléphone', 'Bloc', 'Salle', 'Jour', 'Heure', 'Statut', 'Livré par', 'Notes'];
  const OLD_ROW = ['d', "'Amina Sehimi", "'52563987", "'Bloc E", "'E 1-1", "'2026-11-28", "'10:00", 'Livré', 'Sami', ''];

  it('gets a "Tickets" column after "Heure" on the first new reservation; old rows keep their Statut', () => {
    const old = makeGoogle([OLD_HEADERS, OLD_ROW]);
    expect(post(old, good)).toEqual({ ok: true });
    expect(old.rows[0]).toEqual(['Reçu le', 'Nom', 'Téléphone', 'Bloc', 'Salle', 'Jour', 'Heure', 'Tickets', 'Statut', 'Livré par', 'Notes']);
    expect(old.rows[1].slice(6, 9)).toEqual(["'10:00", '', 'Livré']);
    expect(old.rows[2].slice(6, 9)).toEqual(["'10:30", 2, 'À livrer']);
  });

  it('the column is added only once', () => {
    const old = makeGoogle([OLD_HEADERS, OLD_ROW]);
    post(old, good);
    post(old, { ...good, phone: '98123456' });
    expect(old.events.filter((e) => e === 'insertColumn')).toHaveLength(1);
    expect(old.rows[0]).toHaveLength(11);
  });

  it('an old row with the same phone is still caught as a duplicate', () => {
    const old = makeGoogle([OLD_HEADERS, OLD_ROW]);
    expect(post(old, { ...good, phone: '52563987' })).toEqual({ ok: false, error: 'duplicate' });
  });
});
