// Runs tools/reservation-apps-script.gs in Node with fake Google services.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const SRC = readFileSync(resolve(process.cwd(), 'tools/reservation-apps-script.gs'), 'utf8');

function makeGoogle() {
  const events = [];
  const rows = [];
  const sheet = {
    appendRow: (r) => { events.push('append'); rows.push(r); },
    getLastRow: () => rows.length,
    getRange: (row, col, nRows) => ({
      getValues: () => { events.push('read'); return rows.slice(row - 1, row - 1 + nRows).map((r) => [r[col - 1]]); },
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

const good = { name: 'Amira Ben Salah', studentId: '211JMT1234', phone: '25615375', bloc: 'Bloc C', salle: 'C 1-2', day: '2026-11-28', time: '10:30', website: '' };
const post = (g, body) => JSON.parse(g.context.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text);

let g;
beforeEach(() => { g = makeGoogle(); });

describe('reservation Apps Script', () => {
  it('appends one row with the columns in order and Statut "À livrer"', () => {
    expect(post(g, good)).toEqual({ ok: true });
    const dataRows = g.rows.slice(1);
    expect(g.rows[0]).toEqual(['Reçu le', 'Nom', 'Identifiant', 'Téléphone', 'Bloc', 'Salle', 'Jour', 'Heure', 'Statut', 'Livré par', 'Notes']);
    expect(dataRows).toHaveLength(1);
    const r = dataRows[0];
    expect(r[0]).toBeInstanceOf(Date);
    expect(r.slice(1)).toEqual(["'Amira Ben Salah", "'211JMT1234", "'25615375", "'Bloc C", "'C 1-2", "'2026-11-28", "'10:30", 'À livrer', '', '']);
  });

  it('same student ID twice → duplicate, no second row (case-insensitive)', () => {
    post(g, good);
    expect(post(g, { ...good, studentId: '211jmt1234', name: 'Autre' })).toEqual({ ok: false, error: 'duplicate' });
    expect(g.rows.slice(1)).toHaveLength(1);
  });

  it('duplicate check runs inside the lock', () => {
    post(g, good); // first row (sheet created, nothing to read yet)
    g.events.length = 0;
    post(g, { ...good, studentId: 'OTHER123' });
    const seq = g.events.filter((e) => ['lock', 'read', 'append', 'flush', 'unlock'].includes(e));
    expect(seq).toEqual(['lock', 'read', 'append', 'flush', 'unlock']); // written for real before the next one reads
  });

  it('escapes formula-like values', () => {
    post(g, { ...good, name: '=IMPORTXML("http://x","//a")' });
    expect(g.rows[1][1]).toBe('\'=IMPORTXML("http://x","//a")');
    for (const v of ['+33', '-1', '@me', 'Amira', 'TRUE', '12/12', '09876543']) expect(g.context.escapeCell(v)).toBe("'" + v);
  });

  it('a number-looking ID stays text, so its duplicate is still caught', () => {
    post(g, { ...good, studentId: '09876543' });
    expect(g.rows[1][2]).toBe("'09876543");
    expect(post(g, { ...good, studentId: '09876543' })).toEqual({ ok: false, error: 'duplicate' });
  });

  it('honeypot filled → ok but nothing written', () => {
    expect(post(g, { ...good, website: 'spam.example' })).toEqual({ ok: true });
    expect(g.rows.filter((r) => r[2] === '211JMT1234')).toHaveLength(0);
  });

  it('invalid JSON, missing or malformed fields → invalid, nothing written', () => {
    expect(post(g, 'not json')).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, { ...good, phone: '123' })).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, { ...good, studentId: '' })).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, { ...good, day: 'demain' })).toEqual({ ok: false, error: 'invalid' });
    expect(post(g, 'x'.repeat(6000))).toEqual({ ok: false, error: 'invalid' });
    expect(g.rows.slice(1)).toHaveLength(0);
  });
});
