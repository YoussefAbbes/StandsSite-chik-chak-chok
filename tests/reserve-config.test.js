import { describe, it, expect } from 'vitest';
import live from '../public/data.json';
import fixture from './fixtures/data.json';
import { normalizeReservation, validateData, loadData } from '../src/data.js';

const EP = 'https://script.google.com/macros/s/AKfycbxTEST/exec';
const BLOCS = ['Bloc A', 'Bloc C', 'Bloc G', 'Bloc IJK', 'Bloc M', 'Bloc E'];
const block = (over = {}) => ({
  endpoint: EP,
  lastDay: '2026-12-02',
  blocs: BLOCS.map((bloc) => ({ bloc, rooms: [] })),
  ...over,
});

describe('normalizeReservation', () => {
  it('keeps the 6 blocs in order with rooms defaulting to []', () => {
    const r = normalizeReservation({ reservation: { ...block(), blocs: [...block().blocs.slice(0, 5), { bloc: 'Bloc E' }] } });
    expect(r.endpoint).toBe(EP);
    expect(r.lastDay).toBe('2026-12-02');
    expect(r.blocs.map((b) => b.bloc)).toEqual(BLOCS);
    expect(r.blocs[5].rooms).toEqual([]);
  });

  it('drops rooms longer than 12 and blocs longer than 20 characters (the script would refuse them)', () => {
    const r = normalizeReservation({ reservation: block({ blocs: [{ bloc: 'Bloc C', rooms: ['C 1-1', 'Amphi Ibn Khaldoun'] }, { bloc: 'Bloc avec un nom beaucoup trop long', rooms: [] }] }) });
    expect(r.blocs).toEqual([{ bloc: 'Bloc C', rooms: ['C 1-1'] }]);
  });

  it('keeps room codes, drops non-text rooms', () => {
    const r = normalizeReservation({ reservation: block({ blocs: [{ bloc: 'Bloc C', rooms: ['C 1-1', 5, null, ' C 1-2 '] }] }) });
    expect(r.blocs[0].rooms).toEqual(['C 1-1', 'C 1-2']);
  });

  it('is null without a valid Google script endpoint (button hidden)', () => {
    for (const endpoint of ['', undefined, 'http://script.google.com/macros/s/x/exec', 'https://evil.example/exec', 'javascript:alert(1)',
      'https://script.google.com/macros/s/AKfycbxTEST/dev', 'https://script.google.com/home']) {
      expect(normalizeReservation({ reservation: block({ endpoint }) })).toBeNull();
    }
    expect(normalizeReservation({})).toBeNull();
    expect(normalizeReservation({ reservation: block({ blocs: [] }) })).toBeNull();
  });
});

describe('validateData (reservation block)', () => {
  const v = (reservation) => validateData({ ...fixture, reservation });
  it('accepts a good block, an empty endpoint, and no block at all', () => {
    expect(v(block())).toEqual([]);
    expect(v(block({ endpoint: '' }))).toEqual([]);
    expect(validateData(fixture)).toEqual([]);
  });
  it('reports bad fields with readable messages', () => {
    expect(v(block({ endpoint: 'https://evil.example/exec' }))).toContain('"reservation": "endpoint" must be a https://script.google.com link');
    expect(v(block({ lastDay: '2 dec' }))).toContain('"reservation": "lastDay" must look like 2026-12-02');
    expect(v(block({ blocs: [{ bloc: 'Bloc C', rooms: 'C 1-1' }] }))).toContain('"reservation" bloc #1: "rooms" must be a list [ … ]');
    expect(v(block({ blocs: [{ bloc: 'Bloc C', rooms: ['Amphi Ibn Khaldoun'] }] }))).toContain('"reservation" bloc #1: room "Amphi Ibn Khaldoun" is longer than 12 characters');
    expect(v(block({ blocs: [{ bloc: 'Bloc avec un nom beaucoup trop long', rooms: [] }] }))).toContain('"reservation" bloc #1: "bloc" is longer than 20 characters');
    expect(v(block({ endpoint: 'https://script.google.com/macros/s/AKfycbxTEST/dev' }))).toContain('"reservation": "endpoint" must be a https://script.google.com link');
  });
  it('the live data.json validates', () => {
    expect(validateData(live)).toEqual([]);
  });
});

describe('loadData', () => {
  it('exposes reservation (null when not configured)', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    try {
      expect((await loadData('/d.json', { ...fixture, reservation: block() })).reservation.endpoint).toBe(EP);
      expect((await loadData('/d.json', fixture)).reservation).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('Google Workspace (school account) script links', () => {
  it('accepts /a/macros/<domain>/s/<id>/exec, still rejects /dev and other hosts', () => {
    const ws = 'https://script.google.com/a/macros/esprit.tn/s/AKfycbxWORKSPACE_id-1/exec';
    expect(normalizeReservation({ reservation: block({ endpoint: ws }) }).endpoint).toBe(ws);
    expect(validateData({ ...fixture, reservation: block({ endpoint: ws }) })).toEqual([]);
    for (const bad of ['https://script.google.com/a/macros/esprit.tn/s/AKfy/dev', 'https://script.googleusercontent.com/a/macros/esprit.tn/echo?user_content_key=x']) {
      expect(normalizeReservation({ reservation: block({ endpoint: bad }) })).toBeNull();
    }
  });
});
