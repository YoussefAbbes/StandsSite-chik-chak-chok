// Builds the stand cards and the contact block with DOM APIs only —
// data.json is edited by hand on GitHub, so nothing from it is parsed as HTML.
import { normalizePhone } from './data.js';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const external = { target: '_blank', rel: 'noopener' };

function personRow({ name, phone }) {
  return el('li', { class: 'person' }, [
    el('span', { class: 'person-name', text: name }),
    el('div', { class: 'person-actions' }, [
      el('a', { class: 'btn btn-call', href: phone.tel, 'aria-label': `Appeler ${name}` }, [
        el('span', { class: 'btn-icon', 'aria-hidden': 'true', text: '📞' }),
        el('span', { class: 'btn-number', text: phone.display }),
      ]),
      el('a', { class: 'btn btn-wa', href: phone.wa, ...external, 'aria-label': `WhatsApp ${name}` }, [
        el('span', { class: 'btn-icon', 'aria-hidden': 'true', text: '💬' }),
        el('span', { text: 'WhatsApp' }),
      ]),
    ]),
  ]);
}

function standCard(stand, index) {
  const body = stand.people.length
    ? el('ul', { class: 'people' }, stand.people.map(personRow))
    : el('p', { class: 'stand-hint', text: 'Passe au stand — la team est là 💃' });
  return el('article', { class: 'stand-card', style: `--i:${index}` }, [
    el('div', { class: 'bulbs', 'aria-hidden': 'true' }),
    el('span', { class: 'stand-badge', text: 'Stand + 🎟️ Tickets' }),
    el('h3', { class: 'stand-name', text: stand.bloc }),
    stand.note ? el('p', { class: 'stand-note', text: stand.note }) : null,
    body,
  ]);
}

export function renderStands(container, stands, { onRetry } = {}) {
  container.replaceChildren();
  if (!stands) {
    const retry = el('button', { class: 'btn btn-retry', type: 'button', text: 'Réessayer' });
    retry.addEventListener('click', () => onRetry?.());
    container.append(
      el('div', { class: 'stands-error', role: 'alert' }, [
        el('p', { text: 'Connexion faible… les stands n’ont pas chargé 📶' }),
        retry,
      ]),
    );
    return;
  }
  container.append(...stands.map(standCard));
}

/** Date / time / place as separate <bdi> chips: mixing Arabic and Latin in one
 *  line lets the bidi algorithm reorder the pieces ("2 20 · 2026 ديسمبر h"). */
export function renderEvent(container, event) {
  if (!event) return;
  const chip = (icon, text) =>
    el('li', {}, [el('span', { 'aria-hidden': 'true', text: icon }), el('bdi', { text })]);
  container.replaceChildren(
    chip('📅', event.date),
    chip('🕗', event.time),
    chip('📍', event.place),
  );
}

export function renderContact(container, contact) {
  container.replaceChildren();
  if (!contact) return;
  const phones = (contact.phones ?? []).map(normalizePhone).filter(Boolean);
  container.append(
    el('h2', { class: 'section-title' }, [
      el('span', { class: 'ar', lang: 'ar', text: 'للاستفسار' }),
      el('span', { class: 'fr', text: 'Une question ?' }),
    ]),
    el('div', { class: 'contact-actions' }, [
      el('a', { class: 'btn btn-mail', href: `mailto:${contact.email}` }, [
        el('span', { class: 'btn-icon', 'aria-hidden': 'true', text: '✉️' }),
        el('span', { class: 'mail-text' }, [
          el('span', { class: 'mail-label', text: 'Envoyer un mail' }),
          el('span', { class: 'mail-address', text: contact.email }),
        ]),
      ]),
      ...phones.map((p) =>
        el('a', { class: 'btn btn-call', href: p.tel }, [
          el('span', { class: 'btn-icon', 'aria-hidden': 'true', text: '📞' }),
          el('span', { class: 'btn-number', text: p.display }),
        ]),
      ),
    ]),
    el('div', { class: 'socials' }, [
      el('a', { class: 'social', href: contact.instagramCommittee, ...external, text: '@comite_des_etudiants_esprit' }),
      el('a', { class: 'social', href: contact.instagramEvent, ...external, text: '@shikshakshok_tn' }),
    ]),
  );
}
