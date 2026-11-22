// Turns the editable public/data.json into what the page renders.
// Rule from the organisers: a person appears only with BOTH a real name and a phone.
import { safeHttpsUrl, safeMailto } from './safety.js';

const PLACEHOLDER = /^responsable\s*\d*$/i;

/** Tunisian 8-digit number in any common spelling -> display + links, or null. */
export function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('00216')) digits = digits.slice(5);
  else if (digits.length === 11 && digits.startsWith('216')) digits = digits.slice(3);
  if (digits.length !== 8) return null;
  return {
    display: `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`,
    tel: `tel:+216${digits}`,
  };
}

const blocKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Keeps every bloc (each one has a stand), merges duplicates, filters people.
 *  Entries of the wrong type are skipped, never thrown on (data.json is hand-edited). */
export function normalizeStands(raw) {
  const byKey = new Map();
  const entries = Array.isArray(raw?.stands) ? raw.stands : [];
  for (const entry of entries) {
    if (typeof entry?.bloc !== 'string' || !entry.bloc.trim()) continue;
    const key = blocKey(entry.bloc);
    const note = typeof entry.note === 'string' && entry.note.trim() ? entry.note : undefined;
    if (!byKey.has(key)) byKey.set(key, { bloc: entry.bloc.trim(), stand: false, people: [], ...(note ? { note } : {}) });
    const stand = byKey.get(key);
    if (entry.stand === true) stand.stand = true; // "stand": true = there is a physical stand (tickets) in this bloc
    if (note && !stand.note) stand.note = note;
    for (const person of Array.isArray(entry.people) ? entry.people : []) {
      const name = typeof person?.name === 'string' ? person.name.trim() : '';
      const phone = normalizePhone(person?.phone);
      if (name && phone && !PLACEHOLDER.test(name)) stand.people.push({ name, phone });
    }
  }
  return [...byKey.values()];
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string';
const LIST = 'must be a list [ … ]';

/**
 * Structural check of data.json, run by the deploy before publishing. Content
 * (names, numbers, blocs) is free to change; only shapes that would break the
 * page are reported, as messages an editor can act on. [] = all good.
 */
export function validateData(raw) {
  if (!isObj(raw)) return ['the file must contain { … }'];
  const errors = [];
  if (!Array.isArray(raw.stands)) errors.push(`"stands" ${LIST}`);
  else {
    raw.stands.forEach((stand, i) => {
      const at = `stand #${i + 1}`;
      if (!isObj(stand)) return errors.push(`${at} must be { … }`);
      if (!isText(stand.bloc) || !stand.bloc.trim()) return errors.push(`${at}: "bloc" must be text`);
      const where = `${at} (${stand.bloc.trim()})`;
      if (stand.note !== undefined && !isText(stand.note)) errors.push(`${where}: "note" must be text`);
      if (stand.stand !== undefined && typeof stand.stand !== 'boolean') errors.push(`${where}: "stand" must be true or false`);
      if (stand.people === undefined) return;
      if (!Array.isArray(stand.people)) return errors.push(`${where}: "people" ${LIST}`);
      stand.people.forEach((p, j) => {
        const who = `${where}, person #${j + 1}`;
        if (!isObj(p)) return errors.push(`${who} must be { … }`);
        if (!isText(p.name)) errors.push(`${who}: "name" must be text`);
        if (p.phone !== undefined && !isText(p.phone) && typeof p.phone !== 'number') errors.push(`${who}: "phone" must be text`);
      });
    });
  }
  const c = raw.contact;
  if (!isObj(c)) errors.push('"contact" must be { … }');
  else {
    if (!safeMailto(c.email)) errors.push('contact: "email" is not a valid address');
    if (!Array.isArray(c.phones)) errors.push(`contact: "phones" ${LIST}`);
    for (const key of ['instagramCommittee', 'instagramEvent']) {
      if (c[key] !== undefined && !safeHttpsUrl(c[key])) errors.push(`contact: "${key}" must start with https://`);
    }
  }
  const e = raw.event;
  if (!isObj(e)) errors.push('"event" must be { … }');
  else {
    for (const key of ['date', 'time', 'place']) if (!isText(e[key])) errors.push(`event: "${key}" must be text`);
    if (e.mapUrl !== undefined && !safeHttpsUrl(e.mapUrl)) errors.push('event: "mapUrl" must start with https://');
  }
  return errors;
}

const objOrNull = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);
const shape = (raw) => ({ event: objOrNull(raw?.event), contact: objOrNull(raw?.contact), stands: normalizeStands(raw) });

/**
 * Fetches data.json fresh (no stale cache after an edit). On a bad network it
 * falls back to the copy bundled at build time (identical at deploy time);
 * with no fallback, everything is null and the page shows a retry.
 */
export async function loadData(url = `${import.meta.env.BASE_URL}data.json`, fallback = null) {
  try {
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return shape(await res.json());
  } catch {
    return fallback ? shape(fallback) : { event: null, contact: null, stands: null };
  }
}
