// Builds the stand cards, event chips and contact block with DOM APIs only —
// data.json is edited by hand on GitHub, so nothing from it is parsed as HTML
// and links taken from it must be https (or mailto with a plain address).
import { normalizePhone } from './data.js';
import { safeHttpsUrl, safeMailto } from './safety.js';

export { safeHttpsUrl, safeMailto };
import { icon } from './icons.js';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') for (const [prop, v] of Object.entries(value)) node.style.setProperty(prop, v);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const external = { target: '_blank', rel: 'noopener noreferrer' };

function callButton(phone, label) {
  return el('a', { class: 'btn btn-call', href: phone.tel, 'aria-label': label }, [
    icon('phone'),
    el('span', { class: 'btn-number', text: phone.display }),
  ]);
}

function personRow({ name, phone }) {
  return el('li', { class: 'person' }, [
    el('span', { class: 'person-name', text: name }),
    callButton(phone, `Appeler ${name} au ${phone.display}`),
  ]);
}

function standCard(stand, index) {
  // a bloc with a physical stand (tickets) vs a bloc that only has people to call
  const badge = stand.stand
    ? el('span', { class: 'stand-badge' }, [icon('ticket'), el('span', { text: 'Stand + Tickets' })])
    : el('span', { class: 'stand-badge badge-contact' }, [icon('phone'), el('span', { text: 'Contact' })]);
  return el('article', { class: `stand-card ${stand.stand ? 'is-stand' : 'is-contact'}`, style: { '--i': String(index) } }, [
    el('div', { class: 'bulbs', 'aria-hidden': 'true' }),
    badge,
    el('h3', { class: 'stand-name', text: stand.bloc }),
    stand.note ? el('p', { class: 'stand-note', text: stand.note }) : null,
    stand.stand ? el('p', { class: 'stand-hint', text: 'Passe au stand — l’équipe est là 💃' }) : null,
    stand.people.length ? el('ul', { class: 'people' }, stand.people.map(personRow)) : null,
  ]);
}

export function renderStands(container, stands, { onRetry } = {}) {
  container.replaceChildren();
  if (!stands) {
    const retry = el('button', { class: 'btn btn-retry', type: 'button' }, [icon('sparkle'), el('span', { text: 'Réessayer' })]);
    retry.addEventListener('click', () => onRetry?.());
    container.append(
      el('div', { class: 'stands-error', role: 'alert' }, [
        el('p', { text: 'Connexion faible… les stands n’ont pas chargé.' }),
        retry,
      ]),
    );
    return;
  }
  // a bloc without a stand and without anyone to call has nothing to show
  container.append(...stands.filter((s) => s.stand || s.people.length).map(standCard));
}

/** Date / time / place as separate <bdi> chips: mixing Arabic and Latin in one
 *  line lets the bidi algorithm reorder the pieces ("2 20 · 2026 ديسمبر h"). */
export function renderEvent(container, event) {
  if (!event) return;
  const chip = (name, text) => el('li', {}, [icon(name), el('bdi', { text: String(text ?? '') })]);
  const map = safeHttpsUrl(event.mapUrl);
  const place = map
    ? el('li', {}, [
        el('a', { class: 'event-map', href: map, ...external, 'aria-label': `${event.place} — ouvrir dans Maps` }, [
          icon('pin'),
          el('bdi', { text: String(event.place ?? '') }),
        ]),
      ])
    : chip('pin', event.place);
  container.replaceChildren(chip('calendar', event.date), chip('clock', event.time), place);
}

export function renderContact(container, contact) {
  container.replaceChildren();
  if (!contact) return;
  const phones = (Array.isArray(contact.phones) ? contact.phones : []).map(normalizePhone).filter(Boolean);
  const mailto = safeMailto(contact.email);
  const socials = [
    [contact.instagramCommittee, '@comite_des_etudiants_esprit'],
    [contact.instagramEvent, '@shikshakshok_tn'],
  ]
    .map(([url, label]) => [safeHttpsUrl(url), label])
    .filter(([url]) => url);

  container.append(
    el('h2', { class: 'section-title' }, [
      el('span', { class: 'ar', lang: 'ar', text: 'للاستفسار' }),
      el('span', { class: 'fr', text: 'Une question ?' }),
    ]),
    el('div', { class: 'contact-actions' }, [
      mailto
        ? el('a', { class: 'btn btn-mail', href: mailto }, [
            icon('mail'),
            el('span', { class: 'mail-text' }, [
              el('span', { class: 'mail-label', text: 'Envoyer un mail' }),
              el('span', { class: 'mail-address', text: String(contact.email).trim() }),
            ]),
          ])
        : null,
      ...phones.map((p) => callButton(p, `Appeler le ${p.display}`)),
    ]),
    el(
      'div',
      { class: 'socials' },
      socials.map(([url, label]) => el('a', { class: 'social', href: url, ...external }, [icon('instagram'), el('span', { text: label })])),
    ),
  );
}
