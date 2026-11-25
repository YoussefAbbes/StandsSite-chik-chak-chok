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
    if (e.price !== undefined && typeof e.price !== 'string') errors.push('event: "price" must be text, e.g. "Ticket 20 DT"');
  }
  const r = raw.reservation;
  if (r !== undefined) {
    if (!isObj(r)) errors.push('"reservation" must be { … }');
    else {
      if (r.endpoint !== undefined && r.endpoint !== '' && !scriptEndpoint(r.endpoint)) {
        errors.push('"reservation": "endpoint" must be a https://script.google.com link');
      }
      if (r.lastDay !== undefined && !(isText(r.lastDay) && ISO_DAY.test(r.lastDay))) {
        errors.push('"reservation": "lastDay" must look like 2026-12-02');
      }
      if (!Array.isArray(r.blocs)) errors.push(`"reservation": "blocs" ${LIST}`);
      else {
        r.blocs.forEach((b, i) => {
          const at = `"reservation" bloc #${i + 1}`;
          if (!isObj(b) || !isText(b.bloc)) return errors.push(`${at}: "bloc" must be text`);
          if (b.bloc.trim().length > MAX_BLOC) errors.push(`${at}: "bloc" is longer than ${MAX_BLOC} characters`);
          if (b.rooms === undefined) return;
          if (!Array.isArray(b.rooms)) return errors.push(`${at}: "rooms" ${LIST}`);
          for (const room of b.rooms) {
            if (isText(room) && room.trim().length > MAX_ROOM) errors.push(`${at}: room "${room.trim()}" is longer than ${MAX_ROOM} characters`);
          }
        });
      }
    }
  }
  return errors;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
// same limits as the Google script, so a long name fails the data check, not the students
const MAX_BLOC = 20;
const MAX_ROOM = 12;

/** Only a Google Apps Script web-app URL may receive the students' data. */
function scriptEndpoint(value) {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const { hostname, pathname } = new URL(url);
  // the deployed web app (/exec); the editor's /dev link needs the owner's login
  // standard account: /macros/s/<id>/exec · school (Workspace) account: /a/macros/<domain>/s/<id>/exec
  return hostname === 'script.google.com' && /^\/(a\/macros\/[\w.-]+\/|macros\/)s\/[\w-]+\/exec$/.test(pathname) ? url : null;
}

/** The reservation form's settings, or null (button hidden) when not configured. */
export function normalizeReservation(raw) {
  const r = raw?.reservation;
  if (!isObj(r)) return null;
  const endpoint = scriptEndpoint(r.endpoint);
  const blocs = (Array.isArray(r.blocs) ? r.blocs : [])
    .filter((b) => isObj(b) && isText(b.bloc) && b.bloc.trim() && b.bloc.trim().length <= MAX_BLOC)
    .map((b) => ({
      bloc: b.bloc.trim(),
      rooms: (Array.isArray(b.rooms) ? b.rooms : [])
        .filter(isText)
        .map((x) => x.trim())
        .filter((x) => x && x.length <= MAX_ROOM),
    }));
  if (!endpoint || !blocs.length) return null;
  return { endpoint, lastDay: isText(r.lastDay) && ISO_DAY.test(r.lastDay) ? r.lastDay : '2026-12-02', blocs };
}

const objOrNull = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);
const shape = (raw) => ({
  event: objOrNull(raw?.event),
  contact: objOrNull(raw?.contact),
  stands: normalizeStands(raw),
  reservation: normalizeReservation(raw), // in-site form settings; null hides the button
});

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
