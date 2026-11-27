// Reservation form logic, kept free of DOM so it can be tested on its own.
// The Google script re-checks everything: these rules are for helpful messages.
import { normalizePhone } from './data.js';

const ROOM = /^[A-Z]{1,3} ?\d{1,2}-\d{1,2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** the team delivers tickets between these hours */
export const FIRST_TIME = '08:00';
export const LAST_TIME = '23:00';

/** cold start + up to 10 s waiting for the script lock can exceed 15 s */
export const DEFAULT_TIMEOUT_MS = 30000;

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** one name part: 2+ letters (any alphabet, Arabic included), inner ' or - allowed: "M'rad", "Ben-Ali" */
const NAME_WORD = /^\p{L}[\p{L}'’-]*\p{L}$/u;
/** "Hh", "Hhh": the same letter repeated is not a name */
const SAME_LETTER = /^(\p{L})\1+$/iu;
/** first name + last name, both real words */
export function isFullName(name) {
  const words = name.split(' ');
  return name.length <= 60 && words.length >= 2 && words.every((w) => NAME_WORD.test(w) && !SAME_LETTER.test(w));
}

/** Tunisian numbers start with 2/4/5/9 (mobile), 3 or 7 (fixed/VoIP); 0, 1, 6, 8 are not personal lines.
 *  "88888888" / "22222222" are someone typing to get past the form. */
export function isRealTunisianNumber(digits) {
  return /^[234579]\d{7}$/.test(digits) && !/^(\d)\1{7}$/.test(digits);
}

/**
 * @returns {{ ok: boolean, errors: Record<string,string>, data?: object }}
 * errors are French messages keyed by field name.
 */
export function validateReservation(values, { today, lastDay, blocs }) {
  const errors = {};
  const name = text(values.name).replace(/\s+/g, ' ');
  const phone = normalizePhone(values.phone);
  const bloc = blocs.find((b) => b.bloc === values.bloc);
  const rawSalle = text(values.salle).toUpperCase().replace(/\s+/g, ' ');
  const day = text(values.day);
  const time = text(values.time);

  if (!isFullName(name)) errors.name = 'Écris ton prénom et ton nom (ex. Amina Sehimi).';
  if (!phone || !isRealTunisianNumber(phone.tel.replace('tel:+216', ''))) errors.phone = 'Numéro tunisien à 8 chiffres, ex. 25 615 375.';
  if (!bloc) {
    errors.bloc = 'Choisis ton bloc.';
    errors.salle = 'Choisis ton bloc, puis l’étage et la salle.';
  } else if (bloc.rooms.length ? !bloc.rooms.includes(text(values.salle)) : !ROOM.test(rawSalle)) {
    errors.salle = bloc.rooms.length || !rawSalle ? 'Choisis l’étage et la salle.' : 'Salle au format C 1-1 (bloc étage-salle).';
  }
  // ISO dates compare correctly as strings
  if (!DAY.test(day) || day < today || day > lastDay) errors.day = 'Choisis un jour entre aujourd’hui et le jour de la soirée.';
  if (!TIME.test(time)) errors.time = 'Choisis une heure.';
  // "HH:MM" strings compare correctly as text
  else if (time < FIRST_TIME || time > LAST_TIME) errors.time = 'Choisis une heure entre 8h00 et 23h00.';
  if (values.pay !== true) errors.pay = 'Coche pour confirmer le paiement à la remise.';

  const ok = Object.keys(errors).length === 0;
  if (!ok) return { ok, errors };
  const salle = bloc.rooms.length ? text(values.salle) : rawSalle;
  const digits = phone.tel.replace('tel:+216', '');
  return {
    ok,
    errors,
    data: { name, phone: digits, bloc: bloc.bloc, salle, day, time, website: text(values.website) },
  };
}

/**
 * Sends one reservation to the Google Apps Script web app.
 * text/plain keeps it a "simple" request (no CORS preflight, which Apps Script can't answer).
 */
export async function submitReservation(endpoint, data, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      signal: controller.signal,
      redirect: 'follow',
    });
    const reply = JSON.parse(await res.text());
    if (reply?.ok === true) return { ok: true };
    if (reply?.error === 'duplicate' || reply?.error === 'invalid') return { ok: false, error: reply.error };
    return { ok: false, error: 'network' };
  } catch {
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** '2026-11-28' → '28/11' */
export function formatDayFr(iso) {
  const [, m, d] = String(iso).split('-');
  return `${d}/${m}`;
}
