// Opening scene, straight from the poster and the LED screen at the party:
// velvet curtains part, spotlights sweep, the marquee bulbs light one by one
// around the dancing silhouette, the gold title glows, then "Entrer". No sound.
import { gsap } from 'gsap';
import { icon } from './icons.js';
import { buildAnimatedTitle } from './title.js';

const BULBS_PER_SIDE = { x: 8, y: 11 };

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

/** Bulbs placed clockwise around the frame, as % positions. */
function bulbPositions() {
  const pts = [];
  const { x: nx, y: ny } = BULBS_PER_SIDE;
  for (let i = 0; i < nx; i++) pts.push([(i / nx) * 100, 0]);
  for (let i = 0; i < ny; i++) pts.push([100, (i / ny) * 100]);
  for (let i = 0; i < nx; i++) pts.push([100 - (i / nx) * 100, 100]);
  for (let i = 0; i < ny; i++) pts.push([0, 100 - (i / ny) * 100]);
  return pts;
}

/**
 * Plays the sprite-sheet silhouette on a canvas. Returns a stop function.
 * Works as a no-op where canvas 2D is unavailable.
 */
export function playSilhouette(canvas, sheetUrl, meta) {
  let ctx = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return () => {};
  canvas.width = meta.w;
  canvas.height = meta.h;
  const img = new Image();
  img.decoding = 'async';
  img.src = sheetUrl;
  let raf = 0;
  let start = 0;
  const frameMs = 1000 / meta.fps;
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    if (!img.complete || !img.naturalWidth || document.hidden) return;
    start ||= now;
    const k = Math.floor((now - start) / frameMs) % meta.frames;
    const sx = (k % meta.cols) * meta.w;
    const sy = Math.floor(k / meta.cols) * meta.h;
    ctx.clearRect(0, 0, meta.w, meta.h);
    ctx.drawImage(img, sx, sy, meta.w, meta.h, 0, 0, meta.w, meta.h);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

function buildScene(root, titleUrl) {
  const marquee = el('div', { class: 'marquee' }, [
    el('div', { class: 'halo' }),
    el('canvas', { class: 'silhouette', 'aria-hidden': 'true' }),
    ...bulbPositions().map(([x, y]) => el('span', { class: 'bulb', style: { left: `${x}%`, top: `${y}%` } })),
  ]);
  const enter = el('button', { id: 'enter', class: 'btn enter-btn', type: 'button', hidden: '' }, [
    icon('fan'),
    el('span', { text: 'Entrer' }),
    el('span', { class: 'enter-ar', lang: 'ar', text: 'يلّا' }),
  ]);
  root.replaceChildren(
    el('div', { class: 'spot spot-left', 'aria-hidden': 'true' }),
    el('div', { class: 'spot spot-right', 'aria-hidden': 'true' }),
    el('div', { class: 'intro-stage' }, [
      marquee,
      buildAnimatedTitle(titleUrl, 'شيك شك شوك في إسبري', 'intro-title'),
      el('p', { class: 'intro-hint', text: 'Check the blocs, follow the music' }),
      enter,
    ]),
    el('div', { class: 'curtain curtain-l', 'aria-hidden': 'true' }),
    el('div', { class: 'curtain curtain-r', 'aria-hidden': 'true' }),
  );
  return { marquee, enter };
}

function playIn(root, { marquee, enter }) {
  const bulbs = marquee.querySelectorAll('.bulb');
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  tl.to(root.querySelector('.curtain-l'), { xPercent: -100, duration: 1.4, ease: 'power3.inOut' }, 0.2)
    .to(root.querySelector('.curtain-r'), { xPercent: 100, duration: 1.4, ease: 'power3.inOut' }, 0.2)
    .from(root.querySelectorAll('.spot'), { opacity: 0, duration: 0.8 }, 0.8)
    .from(marquee, { scale: 0.85, opacity: 0, duration: 0.9 }, 0.9)
    .to(bulbs, { className: 'bulb on', duration: 0.01, stagger: 0.035 }, 1.1)
    .from(root.querySelector('.intro-title'), { y: 24, opacity: 0, duration: 1 }, 2.2)
    .from(root.querySelector('.intro-hint'), { opacity: 0, duration: 0.6 }, 2.8)
    .add(() => { enter.hidden = false; }, 3.0)
    .from(enter, { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, 3.0)
    .add(() => marquee.classList.add('chase'), 3.2);
  return tl;
}

/** Runs the intro inside `root`; resolves once the visitor taps Entrer. */
export function runIntro(root, { reducedMotion, silhouette, titleUrl = './assets/title.webp' }) {
  document.body.classList.add('intro-open');
  const parts = buildScene(root, titleUrl);
  const stopDance = playSilhouette(root.querySelector('canvas.silhouette'), silhouette.url, silhouette.meta);
  let tl = null;

  if (reducedMotion) {
    root.classList.add('static');
    parts.marquee.querySelectorAll('.bulb').forEach((b) => b.classList.add('on'));
    parts.enter.hidden = false;
  } else {
    tl = playIn(root, parts);
  }

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      tl?.kill();
      root.classList.add('done');
      document.body.classList.remove('intro-open');
      resolve();
      const remove = () => { stopDance(); root.remove(); };
      if (reducedMotion) remove();
      else gsap.to(root, { opacity: 0, scale: 1.08, duration: 0.7, ease: 'power2.in', onComplete: remove });
    };
    parts.enter.addEventListener('click', finish);
  });
}
