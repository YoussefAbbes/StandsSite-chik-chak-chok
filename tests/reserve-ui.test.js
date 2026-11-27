import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderReserve } from '../src/stands.js';
import { openReserveSheet, shouldAutoOpen } from '../src/reserve-ui.js';

const reservation = {
  endpoint: 'https://script.google.com/macros/s/X/exec',
  lastDay: '2026-12-02',
  blocs: [
    { bloc: 'Bloc A', rooms: [] }, { bloc: 'Bloc C', rooms: ['C 1-1', 'C 1-2'] }, { bloc: 'Bloc G', rooms: [] },
    { bloc: 'Bloc IJK', rooms: [] }, { bloc: 'Bloc M', rooms: [] }, { bloc: 'Bloc E', rooms: [] },
  ],
};
const phones = [{ display: '95 195 235', tel: 'tel:+21695195235' }];
const flush = () => new Promise((r) => setTimeout(r, 0));
const $ = (sel) => document.querySelector(sel);

function pickBloc(bloc) {
  const radio = $(`.reserve-sheet input[name="bloc"][value="${bloc}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}
function fill({ bloc = 'Bloc C', salle = 'C 1-2', etage, num } = {}) {
  const set = (name, value) => {
    const el = $(`.reserve-sheet [name="${name}"]`);
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  };
  set('name', 'Amira Ben Salah');
  set('phone', '25615375');
  pickBloc(bloc);
  if (etage !== undefined) { set('etage', etage); set('salleNum', num); } else set('salle', salle);
  set('day', '2026-11-28');
  set('time', '10:30');
  $('.reserve-sheet [name="pay"]').checked = true;
}
const submitBtn = () => $('.reserve-sheet button[type="submit"]');

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('renderReserve', () => {
  it('renders a button that opens the form', () => {
    const root = document.createElement('div');
    const onOpen = vi.fn();
    renderReserve(root, reservation, { onOpen });
    const b = root.querySelector('button.btn-reserve');
    expect(b.textContent.trim()).toBe('Réserver maintenant');
    expect(root.querySelector('.reserve-sub').textContent).toBe('Pas de stand dans ton bloc ? On vient à toi 💃');
    b.click();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(root.hidden).toBe(false);
  });
  it('is hidden when reservations are not configured; compact has no sub-line', () => {
    const root = document.createElement('div');
    renderReserve(root, null, { onOpen() {} });
    expect(root.hidden).toBe(true);
    expect(root.querySelector('button')).toBeNull();
    const c = document.createElement('div');
    renderReserve(c, reservation, { compact: true, onOpen() {} });
    expect(c.textContent.trim()).toBe('Réserver maintenant');
  });
});

describe('openReserveSheet', () => {
  const open = (submit = vi.fn(() => Promise.resolve({ ok: true }))) =>
    ({ submit, sheet: openReserveSheet(reservation, { phones, today: '2026-11-26', submit }) });

  it('shows the labels, the three steps, the price badge and the payment checkbox', () => {
    open();
    const t = $('.reserve-sheet').textContent;
    for (const s of ['احجز تذكرتك', 'Réserve ton ticket', '20 dinars par ticket · payé à la remise', 'Toi', 'Où', 'Quand',
      'Nom et prénom', 'Téléphone', 'Bloc', 'Salle', 'Jour', 'Heure',
      'Je paierai mon ticket en espèces à la remise']) {
      expect(t).toContain(s);
    }
    expect(t).not.toContain('Identifiant');
    expect($('.reserve-sheet [name="studentId"]')).toBeNull();
    expect($('.reserve-sheet input[name="day"]').min).toBe('2026-11-26');
    expect($('.reserve-sheet input[name="day"]').max).toBe('2026-12-02');
    expect(document.body.classList.contains('reserve-open')).toBe(true);
  });

  it('no "pas la CIN" hint and no consent checkbox', () => {
    open();
    const t = $('.reserve-sheet').textContent;
    expect(t).not.toContain('pas la CIN');
    expect(t).not.toContain("J'accepte");
    expect($('.reserve-sheet [name="consent"]')).toBeNull();
    expect($('.reserve-sheet').querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  });

  it('blocs are tappable chips (radios) in order', () => {
    open();
    const radios = [...document.querySelectorAll('.reserve-sheet input[type="radio"][name="bloc"]')];
    expect(radios.map((r) => r.value)).toEqual(['Bloc A', 'Bloc C', 'Bloc G', 'Bloc IJK', 'Bloc M', 'Bloc E']);
    expect(radios.every((r) => r.closest('label.rf-chip'))).toBe(true);
  });

  it('room: étage 0–4 and salle 1–15 dropdowns, waiting for a bloc', () => {
    open();
    expect($('.reserve-sheet select[name="etage"]').disabled).toBe(true);
    expect($('.reserve-sheet select[name="salleNum"]').disabled).toBe(true);
    pickBloc('Bloc E');
    const etage = $('.reserve-sheet select[name="etage"]');
    const num = $('.reserve-sheet select[name="salleNum"]');
    expect(etage.disabled).toBe(false);
    expect([...etage.options].map((o) => o.value).filter((v) => v !== '')).toEqual(['0', '1', '2', '3', '4']);
    expect([...num.options].map((o) => o.value).filter((v) => v !== '')).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)));
    expect($('.reserve-sheet input[name="salle"]')).toBeNull(); // nothing to type
  });

  it('a bloc with a room list in data.json still shows that list', () => {
    open();
    pickBloc('Bloc C');
    expect([...$('.reserve-sheet select[name="salle"]').options].map((o) => o.value).filter(Boolean)).toEqual(['C 1-1', 'C 1-2']);
    expect($('.reserve-sheet select[name="etage"]')).toBeNull();
  });

  it('étage + salle build the room code sent to the team', async () => {
    const { submit } = open();
    fill({ bloc: 'Bloc IJK', etage: '2', num: '7' });
    submitBtn().click();
    await flush(); await flush();
    expect(submit.mock.calls[0][0]).toMatchObject({ bloc: 'Bloc IJK', salle: 'IJK 2-7' });
    expect($('.reserve-sheet').textContent).toContain('en salle IJK 2-7 le 28/11 à 10:30');
  });

  it('étage without salle → error, nothing sent', async () => {
    const { submit } = open();
    fill({ bloc: 'Bloc E', etage: '1', num: '' });
    submitBtn().click();
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect($('.reserve-sheet [data-error-for="salle"]').textContent).not.toBe('');
  });

  it('placeholders: "Youssef Abbes" for the name, none for the phone', () => {
    open();
    expect($('.reserve-sheet [name="name"]').placeholder).toBe('Youssef Abbes');
    expect($('.reserve-sheet [name="phone"]').hasAttribute('placeholder')).toBe(false);
  });

  it('time picker limited to 08:00–23:00, said in the label', () => {
    open();
    const t = $('.reserve-sheet input[name="time"]');
    expect(t.min).toBe('08:00');
    expect(t.max).toBe('23:00');
    expect($('.reserve-sheet label[for="rf-time"]').textContent).toBe('Heure (8h–23h)');
  });

  it('the Réserver button carries the ticket icon, not the sparkle', () => {
    open();
    expect(submitBtn().querySelector('svg[data-icon="ticket"]')).not.toBeNull();
    expect(submitBtn().querySelector('svg[data-icon="sparkle"]')).toBeNull();
  });

  it('changing bloc clears the room', () => {
    open();
    fill({ bloc: 'Bloc E', etage: '3', num: '9' });
    pickBloc('Bloc G');
    expect($('.reserve-sheet [name="etage"]').value).toBe('');
    expect($('.reserve-sheet [name="salleNum"]').value).toBe('');
  });

  it('invalid submit shows inline errors and sends nothing', async () => {
    const { submit } = open();
    submitBtn().click();
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect($('.reserve-sheet [data-error-for="name"]').textContent).not.toBe('');
    expect($('.reserve-sheet [data-error-for="bloc"]').textContent).not.toBe('');
    expect($('.reserve-sheet [data-error-for="pay"]').textContent).not.toBe('');
  });

  it('submit button disabled while sending (double tap → one request)', async () => {
    let release;
    const submit = vi.fn(() => new Promise((r) => { release = r; }));
    open(submit);
    fill();
    submitBtn().click();
    submitBtn().click();
    await flush();
    expect(submit).toHaveBeenCalledOnce();
    expect(submitBtn().disabled).toBe(true);
    expect(submitBtn().textContent).toContain('Envoi…');
    release({ ok: true });
    await flush();
  });

  it('success screen repeats the room, day and time', async () => {
    const { submit } = open();
    fill();
    submitBtn().click();
    await flush(); await flush();
    expect(submit.mock.calls[0][0]).not.toHaveProperty('studentId');
    expect(submit.mock.calls[0][0]).toMatchObject({ name: 'Amira Ben Salah', bloc: 'Bloc C', salle: 'C 1-2', day: '2026-11-28', time: '10:30', phone: '25615375', website: '' });
    const t = $('.reserve-sheet').textContent;
    expect(t).toContain("C'est noté 💃 !");
    expect(t).toContain("Un membre de l'équipe passera te voir en salle C 1-2 le 28/11 à 10:30. Prépare 20 DT.");
  });

  it('duplicate → message + team phone links', async () => {
    open(vi.fn(() => Promise.resolve({ ok: false, error: 'duplicate' })));
    fill();
    submitBtn().click();
    await flush(); await flush();
    expect($('.reserve-sheet').textContent).toContain("Tu as déjà une réservation avec ce numéro. Contacte l'équipe si tu veux la modifier.");
    expect($('.reserve-sheet a[href="tel:+21695195235"]')).not.toBeNull();
  });

  it('network → message + phones, and the typed values are kept', async () => {
    open(vi.fn(() => Promise.resolve({ ok: false, error: 'network' })));
    fill();
    submitBtn().click();
    await flush(); await flush();
    expect($('.reserve-sheet').textContent).toContain("Oups, la réservation n'est pas passée. Réessaie, ou appelle l'équipe :");
    expect($('.reserve-sheet a[href="tel:+21695195235"]')).not.toBeNull();
    expect($('.reserve-sheet [name="phone"]').value).toBe('25615375');
    expect(submitBtn().disabled).toBe(false);
  });

  it("invalid (refused by the script) → call the team, not retry", async () => {
    open(vi.fn(() => Promise.resolve({ ok: false, error: 'invalid' })));
    fill();
    submitBtn().click();
    await flush(); await flush();
    const t = $('.reserve-sheet').textContent;
    expect(t).toContain("Ta réservation n'a pas pu être enregistrée. Appelle l'équipe :");
    expect(t).not.toContain('Réessaie');
  });

  it('phone field accepts a pasted +216 25 615 375', () => {
    open();
    expect(Number($('.reserve-sheet [name="phone"]').getAttribute('maxlength'))).toBeGreaterThanOrEqual(20);
  });

  it('close button and Escape remove the sheet and restore scrolling', () => {
    open();
    $('.reserve-sheet .reserve-close').click();
    expect($('.reserve-sheet')).toBeNull();
    expect(document.body.classList.contains('reserve-open')).toBe(false);
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('.reserve-sheet')).toBeNull();
  });

  it('has a hidden honeypot field', () => {
    open();
    const hp = $('.reserve-sheet [name="website"]');
    expect(hp).not.toBeNull();
    expect(hp.getAttribute('tabindex')).toBe('-1');
  });
});

describe('shouldAutoOpen', () => {
  it('#reserver opens the form', () => {
    expect(shouldAutoOpen({ hash: '#reserver' })).toBe(true);
    expect(shouldAutoOpen({ hash: '' })).toBe(false);
  });
});

describe('on-screen summary of what is missing (phones: inline errors are off-screen)', () => {
  const open = (submit = vi.fn(() => Promise.resolve({ ok: true }))) =>
    ({ submit, sheet: openReserveSheet(reservation, { phones, today: '2026-11-26', submit }) });
  const summary = () => $('.reserve-sheet .rf-summary');

  it('empty form → summary next to the button lists every missing field, nothing sent', async () => {
    const { submit } = open();
    submitBtn().click();
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect(summary().hidden).toBe(false);
    expect(summary().getAttribute('role')).toBe('alert');
    expect(summary().textContent).toContain('Il manque ou il faut corriger');
    for (const label of ['Nom et prénom', 'Téléphone', 'Bloc', 'Salle', 'Jour', 'Heure', 'Paiement']) {
      expect(summary().textContent).toContain(label);
    }
    // inside the bar pinned to the bottom, right above the button, where the thumb is
    expect(summary().parentElement).toBe($('.reserve-sheet .rf-actions'));
    expect(summary().nextElementSibling).toBe(submitBtn());
  });

  it('only the wrong fields are listed', async () => {
    const { submit } = open();
    fill();
    const name = $('.reserve-sheet [name="name"]');
    name.value = 'Hh';
    submitBtn().click();
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect(summary().textContent).toContain('Nom et prénom');
    expect(summary().textContent).not.toContain('Téléphone');
  });

  it('a tap on a listed field jumps to it', async () => {
    open();
    submitBtn().click();
    await flush();
    const link = [...summary().querySelectorAll('button')].find((b) => b.textContent.includes('Téléphone'));
    link.click();
    expect(document.activeElement).toBe($('.reserve-sheet [name="phone"]'));
  });

  it('summary disappears once the form is valid and sent', async () => {
    const { submit } = open();
    submitBtn().click();
    await flush();
    fill();
    submitBtn().click();
    await flush();
    expect(submit).toHaveBeenCalledOnce();
    expect(summary()?.hidden ?? true).toBe(true);
  });
});

describe('iPhone: a wrong field never grabs the cursor on submit', () => {
  it('short phone → no focus on the phone input (iOS would open keyboard + AutoFill and hide the message)', async () => {
    const submit = vi.fn(() => Promise.resolve({ ok: true }));
    openReserveSheet(reservation, { phones, today: '2026-11-26', submit });
    fill();
    const phone = $('.reserve-sheet [name="phone"]');
    phone.value = '2564';
    phone.blur();
    submitBtn().click();
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(phone);
    expect($('.reserve-sheet .rf-summary').textContent).toContain('Téléphone');
  });
});

describe('number of tickets', () => {
  const open = (submit = vi.fn(() => Promise.resolve({ ok: true }))) =>
    ({ submit, sheet: openReserveSheet(reservation, { phones, today: '2026-11-26', submit }) });
  const tickets = () => $('.reserve-sheet [name="tickets"]');
  const plus = () => $('.reserve-sheet [aria-label="Un ticket de plus"]');
  const minus = () => $('.reserve-sheet [aria-label="Un ticket de moins"]');
  const total = () => $('.reserve-sheet .rf-total').textContent;
  const payText = () => $('.reserve-sheet .rf-check-text').textContent;
  const type = (value) => { tickets().value = value; tickets().dispatchEvent(new Event('input', { bubbles: true })); };

  it('starts at 1 ticket, 20 DT, and the student can type the number', () => {
    open();
    expect($('.reserve-sheet').textContent).toContain('Nombre de tickets');
    expect(tickets().value).toBe('1');
    expect(tickets().getAttribute('inputmode')).toBe('numeric');
    expect(total()).toBe('Total : 20 DT');
    expect(payText()).toBe('Je paierai mon ticket en espèces à la remise');
  });

  it('+ and − change the count between 1 and 10, never submit the form', async () => {
    const { submit } = open();
    plus().click(); plus().click(); plus().click();
    expect(tickets().value).toBe('4');
    expect(total()).toBe('Total : 80 DT');
    expect(payText()).toBe('Je paierai mes 4 tickets en espèces à la remise');
    for (let i = 0; i < 12; i++) plus().click();
    expect(tickets().value).toBe('10');
    for (let i = 0; i < 12; i++) minus().click();
    expect(tickets().value).toBe('1');
    await flush();
    expect(submit).not.toHaveBeenCalled();
  });

  it('a typed count is sent as a number and shown on the thank-you screen', async () => {
    const { submit } = open();
    fill();
    type('3');
    expect(total()).toBe('Total : 60 DT');
    submitBtn().click();
    await flush(); await flush();
    expect(submit.mock.calls[0][0]).toMatchObject({ tickets: 3 });
    const t = $('.reserve-sheet').textContent;
    expect(t).toContain('avec tes 3 tickets');
    expect(t).toContain('Prépare 60 DT');
  });

  it('15 or an empty box → listed as wrong, nothing sent', async () => {
    const { submit } = open();
    fill();
    type('15');
    submitBtn().click();
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect($('.reserve-sheet [data-error-for="tickets"]').textContent).toBe('Entre 1 et 10 tickets.');
    expect($('.reserve-sheet .rf-summary').textContent).toContain('Nombre de tickets');
    type('');
    expect(total()).toBe('Total : —');
  });
});
