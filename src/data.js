// Turns the editable public/data.json into what the page renders.
// Rule from the organisers: a person appears only with BOTH a real name and a phone.

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
    wa: `https://wa.me/216${digits}`,
  };
}

const blocKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Keeps every bloc (each one has a stand), merges duplicates, filters people. */
export function normalizeStands(raw) {
  const byKey = new Map();
  for (const entry of raw?.stands ?? []) {
    if (!entry?.bloc?.trim()) continue;
    const key = blocKey(entry.bloc);
    if (!byKey.has(key)) {
      byKey.set(key, { bloc: entry.bloc.trim(), people: [], ...(entry.note ? { note: entry.note } : {}) });
    }
    const stand = byKey.get(key);
    if (entry.note && !stand.note) stand.note = entry.note;
    for (const person of entry.people ?? []) {
      const name = String(person?.name ?? '').trim();
      const phone = normalizePhone(person?.phone);
      if (name && phone && !PLACEHOLDER.test(name)) stand.people.push({ name, phone });
    }
  }
  return [...byKey.values()];
}

const shape = (raw) => ({ event: raw.event, contact: raw.contact, stands: normalizeStands(raw) });

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
