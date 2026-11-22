import { describe, it, expect, vi, beforeEach } from 'vitest';
import file from '../public/data.json';
import { normalizeStands } from '../src/data.js';
import { renderStands, renderContact } from '../src/stands.js';

const stands = normalizeStands(file);
const card = (root, bloc) =>
  [...root.querySelectorAll('.stand-card')].find((c) => c.querySelector('.stand-name').textContent === bloc);

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

  it('renders call and whatsapp links', () => {
    renderStands(root, stands);
    const h = card(root, 'Bloc H');
    const call = h.querySelector('a[href="tel:+21625615375"]');
    expect(call).not.toBeNull();
    expect(call.textContent).toContain('25 615 375');
    expect(h.querySelector('a[href="https://wa.me/21625615375"]')).not.toBeNull();
    expect(h.textContent).toContain('Hiba Ghrandi');
  });

  it('shows stand hint when no people', () => {
    renderStands(root, stands);
    expect(card(root, 'Bloc G').textContent).toContain('Passe au stand');
    expect(card(root, 'Bloc G').querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('shows the bloc note', () => {
    renderStands(root, stands);
    expect(card(root, 'Bloc A').textContent).toContain('شبّاك التذاكر');
  });

  it('does not interpret names as HTML', () => {
    renderStands(root, [{ bloc: 'Bloc X', people: [{ name: '<img src=x onerror=alert(1)>', phone: { display: '1', tel: 'tel:+1', wa: 'x' } }] }]);
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
});

describe('renderEvent', () => {
  it('isolates each part so Arabic and Latin text keep their order', async () => {
    const { renderEvent } = await import('../src/stands.js');
    renderEvent(root, file.event);
    const parts = [...root.querySelectorAll('li bdi')].map((b) => b.textContent);
    expect(parts).toEqual(['2 ديسمبر 2026', '20h', 'ESPRIT Bloc E']);
  });
});
