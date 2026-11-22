import { describe, it, expect, vi, beforeEach } from 'vitest';
import file from './fixtures/data.json';
import { normalizeStands } from '../src/data.js';
import { renderStands, renderContact, renderEvent } from '../src/stands.js';

const stands = normalizeStands(file);
const card = (root, bloc) =>
  [...root.querySelectorAll('.stand-card')].find((c) => c.querySelector('.stand-name').textContent === bloc);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

let root;
beforeEach(() => {
  root = document.createElement('div');
});

describe('renderStands', () => {
  it('renders one card per bloc, stands first', () => {
    renderStands(root, stands);
    const names = [...root.querySelectorAll('.stand-name')].map((n) => n.textContent);
    expect(names).toEqual(['Bloc A', 'Bloc G', 'Bloc ESB', 'Bloc H', 'Bloc IJK & M', 'Bloc M']);
  });

  it('only stand blocs get the stand badge and the stand hint', () => {
    renderStands(root, stands);
    for (const b of ['Bloc A', 'Bloc G', 'Bloc ESB']) {
      const c = card(root, b);
      expect(c.querySelector('.stand-badge').textContent).toBe('Stand + Tickets');
      expect(c.querySelector('.stand-hint').textContent).toBe('Passe au stand — l’équipe est là 💃');
      expect(c.classList.contains('is-stand')).toBe(true);
    }
    for (const b of ['Bloc H', 'Bloc IJK & M', 'Bloc M']) {
      const c = card(root, b);
      expect(c.querySelector('.stand-badge').textContent).toBe('Contact');
      expect(c.querySelector('.stand-hint')).toBeNull();
      expect(c.textContent).not.toContain('Tickets');
    }
  });

  it('Bloc M lists its two responsables with call buttons', () => {
    renderStands(root, stands);
    const m = card(root, 'Bloc M');
    expect([...m.querySelectorAll('.person-name')].map((n) => n.textContent)).toEqual(['Mohamed Nour Amri', 'Heni Troudi']);
    expect(m.querySelector('a[href="tel:+21658431239"]')).not.toBeNull();
    expect(m.querySelector('a[href="tel:+21622628105"]')).not.toBeNull();
  });

  it('hides a bloc with no stand and no reachable person', () => {
    renderStands(root, [{ bloc: 'Bloc Z', stand: false, people: [] }, { bloc: 'Bloc A', stand: true, people: [] }]);
    expect([...root.querySelectorAll('.stand-name')].map((n) => n.textContent)).toEqual(['Bloc A']);
  });

  it('renders a call button per person and no whatsapp', () => {
    renderStands(root, stands);
    const h = card(root, 'Bloc H');
    const call = h.querySelector('a[href="tel:+21625615375"]');
    expect(call).not.toBeNull();
    expect(call.textContent.trim()).toBe('25 615 375');
    expect(call.querySelector('svg')).not.toBeNull();
    expect(root.querySelector('a[href*="wa.me"]')).toBeNull();
    expect(h.textContent).toContain('Hiba Ghrandi');
  });

  it('uses drawn icons, not emoji, in buttons and badges', () => {
    renderStands(root, stands);
    for (const node of root.querySelectorAll('.btn, .stand-badge')) {
      expect(node.textContent).not.toMatch(EMOJI);
      expect(node.querySelector('svg')).not.toBeNull();
    }
  });

  it('shows stand hint when no people', () => {
    renderStands(root, stands);
    expect(card(root, 'Bloc G').textContent).toContain('Passe au stand — l’équipe est là 💃');
    expect(card(root, 'Bloc G').querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('stand cards show only the stand hint text (no note)', () => {
    renderStands(root, stands);
    expect(card(root, 'Bloc A').querySelector('.stand-note')).toBeNull();
  });

  it('still shows a note when data.json has one', () => {
    renderStands(root, [{ bloc: 'Bloc X', stand: true, note: 'Info', people: [] }]);
    expect(root.querySelector('.stand-note').textContent).toBe('Info');
  });

  it('does not interpret names as HTML', () => {
    renderStands(root, [{ bloc: 'Bloc X', people: [{ name: '<img src=x onerror=alert(1)>', phone: { display: '1', tel: 'tel:+1' } }] }]);
    expect(root.querySelector('img')).toBeNull();
  });

  it('renders fallback when stands is null', () => {
    const retry = vi.fn();
    renderStands(root, null, { onRetry: retry });
    const err = root.querySelector('.stands-error');
    expect(err).not.toBeNull();
    err.querySelector('button').click();
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('renderContact', () => {
  it('renders mail, info numbers and instagram links', () => {
    renderContact(root, file.contact);
    expect(root.querySelector('a[href="mailto:Comite.deseleves@Esprit.tn"]')).not.toBeNull();
    expect(root.querySelector('a[href="tel:+21695195235"]')).not.toBeNull();
    expect(root.querySelector('a[href="tel:+21625546886"]')).not.toBeNull();
    expect(root.querySelector('a[href="https://www.instagram.com/comite_des_etudiants_esprit/"]')).not.toBeNull();
    expect(root.querySelector('a[href="https://www.instagram.com/shikshakshok_tn/"]')).not.toBeNull();
  });

  it('uses drawn icons, not emoji', () => {
    renderContact(root, file.contact);
    for (const node of root.querySelectorAll('.btn, .social')) {
      expect(node.textContent).not.toMatch(EMOJI);
      expect(node.querySelector('svg')).not.toBeNull();
    }
  });
});

describe('renderEvent', () => {
  it('isolates each part so Arabic and Latin text keep their order', () => {
    renderEvent(root, file.event);
    const parts = [...root.querySelectorAll('li bdi')].map((b) => b.textContent);
    expect(parts).toEqual(['2 ديسمبر 2026', '20h', 'ESPRIT Bloc E']);
    expect(root.querySelectorAll('li svg')).toHaveLength(3);
    expect(root.textContent).not.toMatch(EMOJI);
  });
});

describe('event map link', () => {
  it('opens the place chip in maps', () => {
    renderEvent(root, file.event);
    const link = root.querySelector('a.event-map');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=ESPRIT/);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('ESPRIT Bloc E');
  });

  it('ignores a non-https map url', () => {
    renderEvent(root, { ...file.event, mapUrl: 'javascript:alert(1)' });
    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toContain('ESPRIT Bloc E');
  });
});

describe('link safety', () => {
  it('safeMailto accepts a plain address only', async () => {
    const { safeMailto } = await import('../src/stands.js');
    expect(safeMailto('Comite.deseleves@Esprit.tn')).toBe('mailto:Comite.deseleves@Esprit.tn');
    expect(safeMailto('a@b.tn?cc=spy@x.com')).toBeNull();
    expect(safeMailto('a@b.tn?subject=x.com')).toBeNull();
    expect(safeMailto('javascript:alert(1)//@x.tn')).toBeNull();
    expect(safeMailto('')).toBeNull();
  });

  it('safeHttpsUrl blocks non-https schemes', async () => {
    const { safeHttpsUrl } = await import('../src/stands.js');
    expect(safeHttpsUrl('https://www.instagram.com/shikshakshok_tn/')).toBe('https://www.instagram.com/shikshakshok_tn/');
    for (const bad of ['javascript:alert(1)', 'http://example.com', 'data:text/html,hi', ' ', undefined]) {
      expect(safeHttpsUrl(bad)).toBeNull();
    }
  });

});

describe('render functions tolerate malformed data', () => {
  it('renderContact with wrong types still renders what is valid', () => {
    expect(() => renderContact(root, { email: 42, phones: '95195235', instagramEvent: 7 })).not.toThrow();
    expect(root.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(root.querySelector('.section-title')).not.toBeNull();
  });

  it('renderEvent with missing fields does not throw', () => {
    expect(() => renderEvent(root, { date: 5 })).not.toThrow();
  });
});
