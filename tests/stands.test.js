import { describe, it, expect, vi, beforeEach } from 'vitest';
import file from '../public/data.json';
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
  it('renders one card per bloc', () => {
    renderStands(root, stands);
    const cards = root.querySelectorAll('.stand-card');
    expect(cards).toHaveLength(6);
    for (const c of cards) expect(c.textContent).toContain('Tickets');
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

  it('shows the bloc note', () => {
    renderStands(root, stands);
    expect(card(root, 'Bloc A').textContent).toContain('شبّاك التذاكر dans le bureau du comité des étudiants');
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
