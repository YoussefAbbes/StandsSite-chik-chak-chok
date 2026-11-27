// The in-site reservation sheet: velvet card, gold arch, party fonts.
// DOM only through createElement/textContent (values typed by students are never parsed as HTML).
import {
  validateReservation, submitReservation, formatDayFr, FIRST_TIME, LAST_TIME, MAX_TICKETS, TICKET_PRICE_DT,
} from './reserve-form.js';
import { playSilhouette } from './intro.js';
import { icon } from './icons.js';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const COPY = {
  ar: 'احجز تذكرتك',
  title: 'Réserve ton ticket',
  badge: `${TICKET_PRICE_DT} dinars par ticket · payé à la remise`,
  intro: 'Un membre de l’équipe t’apporte ton ticket dans ta salle, à l’heure que tu choisis.',
  pay: (n) => `Je paierai ${n > 1 ? `mes ${n} tickets` : 'mon ticket'} en espèces à la remise`,
  total: (n) => `Total : ${n ? `${n * TICKET_PRICE_DT} DT` : '—'}`,
  submit: 'Réserver',
  sending: 'Envoi…',
  done: "C'est noté 💃 !",
  doneLine: ({ salle, day, time, tickets }) => `Un membre de l'équipe passera te voir en salle ${salle} le ${formatDayFr(day)} à ${time}`
    + `${tickets > 1 ? ` avec tes ${tickets} tickets` : ''}. Prépare ${tickets * TICKET_PRICE_DT} DT.`,
  duplicate: "Tu as déjà une réservation avec ce numéro. Contacte l'équipe si tu veux la modifier.",
  network: "Oups, la réservation n'est pas passée. Réessaie, ou appelle l'équipe :",
  invalid: "Ta réservation n'a pas pu être enregistrée. Appelle l'équipe :",
  missing: 'Il manque ou il faut corriger :',
};

/** field → name shown in the "il manque" list, in form order */
const LABELS = {
  name: 'Nom et prénom', phone: 'Téléphone', tickets: 'Nombre de tickets', bloc: 'Bloc', salle: 'Salle', day: 'Jour', time: 'Heure', pay: 'Paiement (case à cocher)',
};

/** Local date as YYYY-MM-DD (not UTC: late-evening students must not get tomorrow's date). */
export function localIsoDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const shouldAutoOpen = (loc) => loc?.hash === '#reserver';

/** "Réserver maintenant" button (hero or compact floating pill). Hidden when not configured. */
export function renderReserveButton(container, reservation, { compact = false, onOpen } = {}) {
  container.replaceChildren();
  container.hidden = !reservation;
  if (!reservation) return;
  const btn = el('button', { type: 'button', class: 'btn btn-reserve' }, [icon('ticket'), el('span', { text: 'Réserver maintenant' })]);
  btn.addEventListener('click', () => onOpen?.());
  container.append(btn);
  if (!compact) container.append(el('p', { class: 'reserve-sub', text: 'Pas de stand dans ton bloc ? On vient à toi 💃' }));
}

function field(name, label, control) {
  return el('div', { class: 'rf-field', 'data-field': name }, [
    el('label', { class: 'rf-label', for: `rf-${name}` }, [el('span', { text: label })]),
    control,
    el('p', { class: 'rf-error', 'data-error-for': name, role: 'alert' }),
  ]);
}

/** A numbered step card: "1 · Toi", "2 · Où", "3 · Quand". */
function step(n, title, children) {
  return el('fieldset', { class: 'rf-step' }, [
    el('legend', { class: 'rf-step-title' }, [el('span', { class: 'rf-step-num', text: String(n) }), el('span', { text: title })]),
    ...children,
  ]);
}

function phoneLinks(phones) {
  return el('div', { class: 'rf-phones' }, phones.map((p) =>
    el('a', { class: 'btn btn-call', href: p.tel }, [icon('phone'), el('span', { class: 'btn-number', text: p.display })])));
}

const shortBloc = (bloc) => bloc.replace(/^Bloc\s+/i, '');

/**
 * Opens the reservation sheet over the page. Returns { close }.
 * `submit(data)` defaults to the real Google script; tests and the dev stub inject their own.
 */
export function openReserveSheet(reservation, { phones = [], today = localIsoDate(), submit, silhouette } = {}) {
  const send = submit ?? ((data) => submitReservation(reservation.endpoint, data));

  // blocs as tappable gold chips (radio buttons): one tap instead of a dropdown on phones
  const chips = el('div', { class: 'rf-chips', role: 'radiogroup', 'aria-label': 'Bloc' },
    reservation.blocs.map((b) => el('label', { class: 'rf-chip' }, [
      el('input', { type: 'radio', name: 'bloc', value: b.bloc }),
      el('span', { text: shortBloc(b.bloc) }),
    ])));
  const salleSlot = el('div', { class: 'rf-salle-slot' });
  const selectedBloc = () => chips.querySelector('input:checked')?.value ?? '';

  const options = (first, values, label) => [
    el('option', { value: '', text: first }),
    ...values.map((v) => el('option', { value: String(v), text: label(v) })),
  ];
  const ETAGES = [0, 1, 2, 3, 4];
  const NUMS = Array.from({ length: 15 }, (_, i) => i + 1);

  function renderSalle() {
    const bloc = reservation.blocs.find((b) => b.bloc === selectedBloc());
    if (bloc?.rooms.length) {
      // data.json lists this bloc's rooms: pick one
      salleSlot.replaceChildren(el('select', { id: 'rf-salle', name: 'salle', required: true }, options('Choisis ta salle', bloc.rooms, (r) => r)));
      return;
    }
    // otherwise: étage 0–4 + salle 1–15, the code (e.g. "E 2-7") is built for the team
    const off = !bloc;
    salleSlot.replaceChildren(el('div', { class: 'rf-room' }, [
      el('select', { id: 'rf-salle', name: 'etage', 'aria-label': 'Étage', disabled: off, required: true },
        options(off ? 'Étage' : 'Étage…', ETAGES, (n) => (n === 0 ? 'RDC (0)' : `Étage ${n}`))),
      el('select', { name: 'salleNum', 'aria-label': 'Numéro de salle', disabled: off, required: true },
        options(off ? 'Salle' : 'Salle…', NUMS, (n) => `Salle ${n}`)),
    ]));
  }
  renderSalle();
  chips.addEventListener('change', renderSalle);

  // ticket count: typed, or − / + (big targets for thumbs); total and payment line follow it
  const ticketsInput = el('input', {
    id: 'rf-tickets', name: 'tickets', type: 'number', inputmode: 'numeric', min: '1', max: String(MAX_TICKETS), step: '1', value: '1', required: true,
  });
  const stepBtn = (text, label, delta) => {
    const b = el('button', { type: 'button', class: 'rf-step-btn', 'aria-label': label, text });
    b.addEventListener('click', () => {
      const n = Number.parseInt(ticketsInput.value, 10) || 0;
      ticketsInput.value = String(Math.min(MAX_TICKETS, Math.max(1, n + delta)));
      updateTotal();
    });
    return b;
  };
  const totalLine = el('p', { class: 'rf-total', 'aria-live': 'polite' });
  const payText = el('span', { class: 'rf-check-text' });
  /** the count when it is a whole number from 1 to MAX_TICKETS, else 0 */
  const ticketCount = () => {
    const v = ticketsInput.value.trim();
    const n = /^\d{1,2}$/.test(v) ? Number(v) : 0;
    return n >= 1 && n <= MAX_TICKETS ? n : 0;
  };
  function updateTotal() {
    const n = ticketCount();
    totalLine.textContent = COPY.total(n);
    payText.textContent = COPY.pay(n || 1);
  }
  ticketsInput.addEventListener('input', updateTotal);
  updateTotal();

  const submitBtn = el('button', { type: 'submit', class: 'btn btn-reserve rf-submit' }, [icon('ticket'), el('span', { text: COPY.submit })]);
  const status = el('div', { class: 'rf-status', role: 'status', 'aria-live': 'polite' });
  // right above the button: on a phone the inline errors are scrolled away, this is what the student sees
  const summary = el('div', { class: 'rf-summary', role: 'alert', hidden: true });
  const form = el('form', { class: 'rf-form', novalidate: true }, [
    step(1, 'Toi', [
      field('name', 'Nom et prénom', el('input', {
        id: 'rf-name', name: 'name', type: 'text', autocomplete: 'name', maxlength: '60', placeholder: 'Youssef Abbes', required: true,
      })),
      field('phone', 'Téléphone', el('div', { class: 'rf-phone' }, [
        el('span', { class: 'rf-prefix', text: '+216' }),
        el('input', {
          id: 'rf-phone', name: 'phone', type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', maxlength: '20', required: true,
        }),
      ])),
      field('tickets', 'Nombre de tickets', el('div', { class: 'rf-tickets' }, [
        el('div', { class: 'rf-stepper' }, [stepBtn('−', 'Un ticket de moins', -1), ticketsInput, stepBtn('+', 'Un ticket de plus', 1)]),
        totalLine,
      ])),
    ]),
    step(2, 'Où', [
      el('div', { class: 'rf-field', 'data-field': 'bloc' }, [
        el('span', { class: 'rf-label' }, [el('span', { text: 'Bloc' })]),
        chips,
        el('p', { class: 'rf-error', 'data-error-for': 'bloc', role: 'alert' }),
      ]),
      field('salle', 'Salle', salleSlot),
    ]),
    step(3, 'Quand', [
      el('div', { class: 'rf-row' }, [
        field('day', 'Jour', el('input', { id: 'rf-day', name: 'day', type: 'date', min: today, max: reservation.lastDay, required: true })),
        field('time', 'Heure (8h–23h)', el('input', { id: 'rf-time', name: 'time', type: 'time', min: FIRST_TIME, max: LAST_TIME, step: '300', required: true })),
      ]),
    ]),
    el('div', { class: 'rf-check', 'data-field': 'pay' }, [
      el('label', {}, [
        el('input', { type: 'checkbox', name: 'pay' }),
        el('span', { class: 'rf-check-box', 'aria-hidden': 'true' }),
        payText,
      ]),
      el('p', { class: 'rf-error', 'data-error-for': 'pay', role: 'alert' }),
    ]),
    // honeypot: invisible to people, bots fill it in
    el('div', { class: 'rf-hp', 'aria-hidden': 'true' }, [el('input', { name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' })]),
    status,
    el('div', { class: 'rf-actions' }, [summary, submitBtn]),
  ]);

  const body = el('div', { class: 'rf-body' }, [el('p', { class: 'rf-intro', text: COPY.intro }), form]);
  const closeBtn = el('button', { type: 'button', class: 'reserve-close', 'aria-label': 'Fermer', text: '×' });
  const card = el('div', { class: 'reserve-card' }, [
    el('div', { class: 'bulbs', 'aria-hidden': 'true' }),
    closeBtn,
    el('p', { class: 'rf-ar', lang: 'ar', dir: 'rtl', text: COPY.ar }),
    el('h2', { class: 'rf-title', id: 'rf-title', text: COPY.title }),
    el('p', { class: 'rf-badge' }, [icon('ticket'), el('span', { text: COPY.badge })]),
    body,
  ]);
  const sheet = el('div', { class: 'reserve-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rf-title' }, [card]);

  let stopDance = () => {};
  let sending = false;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    stopDance();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('reserve-open');
    sheet.remove();
  }
  closeBtn.addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  document.addEventListener('keydown', onKey);

  /** The room as the team reads it: picked from the list, or built as "<bloc> <étage>-<salle>". */
  function roomCode() {
    if (form.elements.salle) return form.elements.salle.value;
    const etage = form.elements.etage?.value ?? '';
    const num = form.elements.salleNum?.value ?? '';
    return etage !== '' && num !== '' ? `${shortBloc(selectedBloc()).toUpperCase()} ${etage}-${num}` : '';
  }

  const values = () => ({
    name: form.elements.name.value,
    phone: form.elements.phone.value,
    bloc: selectedBloc(),
    salle: roomCode(),
    day: form.elements.day.value,
    time: form.elements.time.value,
    pay: form.elements.pay.checked,
    website: form.elements.website.value,
    tickets: ticketsInput.value,
  });

  /** the control to put the cursor in for each field (salle is a list or étage + numéro) */
  const controlFor = (name) => ({
    bloc: () => chips.querySelector('input'),
    salle: () => form.elements.salle ?? form.elements.etage,
  }[name]?.() ?? form.querySelector(`[name="${name}"]`));

  function goTo(name) {
    form.querySelector(`[data-field="${name}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    controlFor(name)?.focus?.({ preventScroll: true });
  }

  function showErrors(errors) {
    for (const p of form.querySelectorAll('[data-error-for]')) p.textContent = errors[p.dataset.errorFor] ?? '';
    for (const f of form.querySelectorAll('[data-field]')) f.classList.toggle('has-error', Boolean(errors[f.dataset.field]));
    const wrong = Object.keys(LABELS).filter((name) => errors[name]);
    summary.hidden = wrong.length === 0;
    if (summary.hidden) return summary.replaceChildren();
    // no automatic jump: on a phone it opens the keyboard or the date wheel and hides this list
    summary.replaceChildren(
      el('p', { class: 'rf-summary-title', text: COPY.missing }),
      el('ul', {}, wrong.map((name) => {
        const btn = el('button', { type: 'button', class: 'rf-summary-item', text: LABELS[name] });
        btn.addEventListener('click', () => goTo(name));
        return el('li', {}, [btn]);
      })),
    );
    summary.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  function setSending(on) {
    sending = on;
    submitBtn.disabled = on;
    submitBtn.lastChild.textContent = on ? COPY.sending : COPY.submit;
  }

  function showSuccess(data) {
    const canvas = el('canvas', { class: 'silhouette rf-dancer', 'aria-hidden': 'true' });
    body.replaceChildren(
      el('div', { class: 'rf-done' }, [
        el('div', { class: 'rf-halo' }, [canvas]),
        el('p', { class: 'rf-done-title', text: COPY.done }),
        el('p', { class: 'rf-done-line', text: COPY.doneLine(data) }),
        el('button', { type: 'button', class: 'btn btn-reserve rf-ok', text: 'Super !' }),
      ]),
    );
    card.querySelector('.rf-badge')?.remove();
    body.querySelector('.rf-ok').addEventListener('click', close);
    if (silhouette) stopDance = playSilhouette(canvas, silhouette.url, silhouette.meta);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    status.replaceChildren();
    const result = validateReservation(values(), { today, lastDay: reservation.lastDay, blocs: reservation.blocs });
    showErrors(result.errors);
    if (!result.ok) return;
    setSending(true);
    const reply = await send(result.data);
    setSending(false);
    if (reply?.ok) return showSuccess(result.data);
    const msg = { duplicate: COPY.duplicate, invalid: COPY.invalid }[reply?.error] ?? COPY.network;
    status.replaceChildren(el('p', { class: 'rf-alert', text: msg }), phoneLinks(phones));
    status.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  });

  document.body.append(sheet);
  document.body.classList.add('reserve-open');
  form.elements.name.focus?.();
  return { close };
}
