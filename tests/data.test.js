import { describe, it, expect } from 'vitest';
import file from '../public/data.json';
import { normalizePhone, normalizeStands } from '../src/data.js';

const names = (stands, bloc) => stands.find((s) => s.bloc === bloc).people.map((p) => p.name);

describe('normalizePhone', () => {
  it('normalizes phone formats', () => {
    const want = { display: '25 615 375', tel: 'tel:+21625615375' };
    for (const raw of ['25615375', '25 615 375', '+216 25.615.375', '0021625615375']) {
      expect(normalizePhone(raw)).toEqual(want);
    }
    for (const raw of ['', '123', undefined]) expect(normalizePhone(raw)).toBeNull();
  });
});

describe('normalizeStands', () => {
  it('filters people without name or phone', () => {
    const s = normalizeStands(file);
    expect(names(s, 'Bloc H')).toEqual(['Hiba Ghrandi']);
    expect(names(s, 'Bloc IJK & M')).toEqual(['Mohamed Nour Amri', 'Heni Troudi']);
    for (const b of ['Bloc G', 'Bloc ESB', 'Bloc M']) expect(names(s, b)).toEqual([]);
  });

  it('drops placeholder names', () => {
    const s = normalizeStands({ stands: [{ bloc: 'Bloc X', people: [
      { name: 'Responsable 1', phone: '22222222' },
      { name: '  ', phone: '22222222' },
    ] }] });
    expect(s[0].people).toEqual([]);
  });

  it('keeps every bloc', () => {
    const s = normalizeStands(file);
    expect(s.map((x) => x.bloc)).toEqual(['Bloc G', 'Bloc ESB', 'Bloc H', 'Bloc IJK & M', 'Bloc M', 'Bloc A']);
    expect(s.find((x) => x.bloc === 'Bloc A').note).toBe('شبّاك التذاكر dans le bureau du comité des étudiants');
  });

  it('merges duplicate blocs', () => {
    const s = normalizeStands({ stands: [
      { bloc: 'Bloc G', people: [{ name: 'A', phone: '22222222' }] },
      { bloc: 'Bloc H', people: [] },
      { bloc: 'bloc g ', people: [{ name: 'B', phone: '33333333' }] },
    ] });
    expect(s.map((x) => x.bloc)).toEqual(['Bloc G', 'Bloc H']);
    expect(names(s, 'Bloc G')).toEqual(['A', 'B']);
  });
});

describe('loadData', () => {
  it('falls back to the bundled copy when the network fails', async () => {
    const { loadData } = await import('../src/data.js');
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    try {
      const data = await loadData('/data.json', file);
      expect(data.contact.email).toBe('Comite.deseleves@Esprit.tn');
      expect(data.stands.map((s) => s.bloc)).toContain('Bloc H');
      const none = await loadData('/data.json');
      expect(none.stands).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});
