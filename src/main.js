// fonts are self-hosted (no request to Google; strict CSP)
import '@fontsource/rakkas/400.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/700.css';
import '@fontsource/aref-ruqaa/700.css';
import './styles.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import bundled from '../public/data.json';
import { loadData, normalizePhone } from './data.js';
import { renderStands, renderContact, renderEvent, renderReserve } from './stands.js';
import { hydrateIcons } from './icons.js';
import { runIntro } from './intro.js';
import { buildAnimatedTitle } from './title.js';
import { openReserveSheet, shouldAutoOpen } from './reserve-ui.js';
import silhouetteMeta from '../public/assets/silhouette.json';

gsap.registerPlugin(ScrollTrigger);
hydrateIcons();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel) => document.querySelector(sel);

$('#hero .title').replaceChildren(
  buildAnimatedTitle(`${import.meta.env.BASE_URL}assets/title.webp`, 'شيك شك شوك في إسبري'),
);

function revealCards() {
  if (reducedMotion) return;
  gsap.utils.toArray('.stand-card').forEach((card) => {
    gsap.from(card, {
      y: 60, opacity: 0, rotateX: -12, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 88%' },
    });
  });
}

const silhouette = { url: `${import.meta.env.BASE_URL}assets/silhouette.webp`, meta: silhouetteMeta };
let openForm = null;

/** Local review only (stripped from the GitHub build): with no script link yet, fake the
 *  Google answer. ?reserveStub=duplicate or ?reserveStub=network shows the other screens. */
function devStub(reservation) {
  if (!import.meta.env.DEV || reservation) return { reservation, submit: undefined };
  const raw = bundled.reservation;
  const mode = new URLSearchParams(location.search).get('reserveStub') || 'ok';
  const reply = mode === 'ok' ? { ok: true } : { ok: false, error: mode };
  return {
    reservation: { endpoint: 'stub', lastDay: raw.lastDay, blocs: raw.blocs.map((b) => ({ bloc: b.bloc, rooms: b.rooms ?? [] })) },
    submit: () => new Promise((r) => setTimeout(() => r(reply), 700)),
  };
}

async function showData() {
  const data = await loadData(undefined, bundled);
  const { event, contact, stands } = data;
  const { reservation, submit } = devStub(data.reservation);
  const phones = (Array.isArray(contact?.phones) ? contact.phones : []).map(normalizePhone).filter(Boolean);
  openForm = reservation ? () => openReserveSheet(reservation, { phones, silhouette, submit }) : null;
  // each section on its own: a bad field in one never blanks the others
  const safely = (fn) => { try { fn(); } catch (err) { console.error(err); } };
  safely(() => renderEvent($('#event-line'), event));
  safely(() => renderReserve($('#reserve'), reservation, { onOpen: openForm }));
  safely(() => renderReserve($('#reserve-float'), reservation, { compact: true, onOpen: openForm }));
  safely(() => renderStands($('#stands'), stands, { onRetry: showData }));
  safely(() => renderContact($('#contact'), contact));
  revealCards();
  ScrollTrigger.refresh();
}

const dataReady = showData();

// floating "Réserver maintenant" pill: only once the hero button has scrolled out of view
const floatPill = $('#reserve-float');
if ('IntersectionObserver' in window && floatPill) {
  new IntersectionObserver(([entry]) => {
    floatPill.classList.toggle('show', !entry.isIntersecting);
  }).observe($('#hero'));
}

runIntro($('#intro'), {
  reducedMotion,
  silhouette,
  titleUrl: `${import.meta.env.BASE_URL}assets/title.webp`,
}).then(async () => {
  ScrollTrigger.refresh();
  // a shared link ending in #reserver opens the form right after the intro
  await dataReady;
  if (openForm && shouldAutoOpen(location)) openForm();
});

// 3D is decoration: load it after the content, and never let it break the page.
import('./scene3d.js')
  .then(({ initScene }) => initScene($('#bg3d'), { reducedMotion }))
  .catch(() => null);
