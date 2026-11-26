import { describe, it, expect, vi } from 'vitest';
import { validateReservation, submitReservation, formatDayFr, DEFAULT_TIMEOUT_MS } from '../src/reserve-form.js';

const blocs = [
  { bloc: 'Bloc C', rooms: ['C 1-1', 'C 1-2'] },
  { bloc: 'Bloc E', rooms: [] },
];
const ctx = { today: '2026-11-26', lastDay: '2026-12-02', blocs };
const good = {
  name: 'Amira Ben Salah', phone: '25 615 375', bloc: 'Bloc C', salle: 'C 1-1',
  day: '2026-11-28', time: '10:30', pay: true, website: '',
};
const errs = (over) => validateReservation({ ...good, ...over }, ctx).errors;

describe('validateReservation', () => {
  it('accepts a complete reservation and normalises it', () => {
    const r = validateReservation(good, ctx);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ name: 'Amira Ben Salah', phone: '25615375', bloc: 'Bloc C', salle: 'C 1-1', day: '2026-11-28', time: '10:30', website: '' });
  });
  it('name: 2–60 characters', () => {
    expect(errs({ name: ' A ' }).name).toBeTruthy();
    expect(errs({ name: 'x'.repeat(61) }).name).toBeTruthy();
  });
  it('no student ID: never asked, never sent', () => {
    const r = validateReservation({ ...good, studentId: '211JMT1234' }, ctx);
    expect(r.ok).toBe(true);
    expect(r.errors.studentId).toBeUndefined();
    expect(r.data).not.toHaveProperty('studentId');
  });
  it('phone: 8 Tunisian digits in any spelling', () => {
    expect(errs({ phone: '1234' }).phone).toBeTruthy();
    expect(validateReservation({ ...good, phone: '+216 25.615.375' }, ctx).data.phone).toBe('25615375');
  });
  it('bloc must be one of the list', () => {
    expect(errs({ bloc: 'Bloc Z' }).bloc).toBeTruthy();
  });
  it('salle must be in the bloc list when the bloc has rooms', () => {
    expect(errs({ salle: 'C 9-9' }).salle).toBeTruthy();
    expect(errs({ salle: '' }).salle).toBeTruthy();
  });
  it('salle free text for a bloc without rooms: code like E 0-3, upper-cased', () => {
    expect(validateReservation({ ...good, bloc: 'Bloc E', salle: 'e0-3' }, ctx).data.salle).toBe('E0-3');
    expect(validateReservation({ ...good, bloc: 'Bloc E', salle: ' i 2-10 ' }, ctx).data.salle).toBe('I 2-10');
    for (const bad of ['salle 3', 'E', '3-1', 'EEEE 1-1', 'E 1-123']) expect(errs({ bloc: 'Bloc E', salle: bad }).salle).toBeTruthy();
  });
  it('day between today and lastDay', () => {
    expect(errs({ day: '2026-11-25' }).day).toBeTruthy();
    expect(errs({ day: '2026-12-03' }).day).toBeTruthy();
    expect(errs({ day: 'demain' }).day).toBeTruthy();
    expect(errs({ day: '2026-11-26' }).day).toBeUndefined();
    expect(errs({ day: '2026-12-02' }).day).toBeUndefined();
  });
  it('time HH:MM', () => {
    expect(errs({ time: '' }).time).toBeTruthy();
    expect(errs({ time: '25:00' }).time).toBeTruthy();
  });
  it('time only between 08:00 and 23:00 (inclusive)', () => {
    for (const bad of ['07:59', '00:30', '23:01', '23:30']) expect(errs({ time: bad }).time).toBe('Choisis une heure entre 8h00 et 23h00.');
    for (const ok of ['08:00', '12:45', '23:00']) expect(errs({ time: ok }).time).toBeUndefined();
  });
  it('payment checkbox required; there is no consent checkbox', () => {
    expect(errs({ pay: false }).pay).toBeTruthy();
    expect(validateReservation({ ...good, consent: undefined }, ctx).ok).toBe(true);
  });
});

describe('submitReservation', () => {
  const data = { name: 'A B', phone: '25615375' };
  const res = (body) => Promise.resolve({ ok: true, text: () => Promise.resolve(body) });

  it('POSTs the data once as text/plain JSON', async () => {
    const fetchImpl = vi.fn(() => res('{"ok":true}'));
    await expect(submitReservation('https://script.google.com/x/exec', data, { fetchImpl })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://script.google.com/x/exec');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(init.body)).toEqual(data);
  });
  it('passes duplicate / invalid through', async () => {
    await expect(submitReservation('u', data, { fetchImpl: () => res('{"ok":false,"error":"duplicate"}') })).resolves.toEqual({ ok: false, error: 'duplicate' });
    await expect(submitReservation('u', data, { fetchImpl: () => res('{"ok":false,"error":"invalid"}') })).resolves.toEqual({ ok: false, error: 'invalid' });
  });
  it('non-JSON or timeout → network', async () => {
    await expect(submitReservation('u', data, { fetchImpl: () => res('<html>Google error</html>') })).resolves.toEqual({ ok: false, error: 'network' });
    await expect(submitReservation('u', data, { fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) })).resolves.toEqual({ ok: false, error: 'network' });
    const hang = (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    await expect(submitReservation('u', data, { fetchImpl: hang, timeoutMs: 20 })).resolves.toEqual({ ok: false, error: 'network' });
  });
});

describe('formatDayFr', () => {
  it('28/11', () => expect(formatDayFr('2026-11-28')).toBe('28/11'));
});

describe('timeout', () => {
  it('waits 30 s by default (cold start + lock wait can exceed 15 s)', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30000);
  });
});
