import './styles.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import bundled from '../public/data.json';
import { loadData } from './data.js';
import { renderStands, renderContact, renderEvent } from './stands.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel) => document.querySelector(sel);

function revealCards() {
  if (reducedMotion) return;
  gsap.utils.toArray('.stand-card').forEach((card) => {
    gsap.from(card, {
      y: 60, opacity: 0, rotateX: -12, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 88%' },
    });
  });
}

async function showData() {
  const { event, contact, stands } = await loadData(undefined, bundled);
  renderEvent($('#event-line'), event);
  renderStands($('#stands'), stands, { onRetry: showData });
  renderContact($('#contact'), contact);
  revealCards();
  ScrollTrigger.refresh();
}

showData();

// 3D is decoration: load it after the content, and never let it break the page.
import('./scene3d.js')
  .then(({ initScene }) => initScene($('#bg3d'), { reducedMotion }))
  .catch(() => null);
