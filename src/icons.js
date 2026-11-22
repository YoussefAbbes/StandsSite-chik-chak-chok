// Hand-drawn line icons (gold, round strokes) used instead of emoji.
// One source for both rendered cards and static markup (<i data-icon="…">).

const SVG_NS = 'http://www.w3.org/2000/svg';

// Each icon: list of [tag, attributes]. 24×24 grid, stroke = currentColor.
const ICONS = {
  phone: [['path', { d: 'M6.6 3.5h2.6l1.5 4-2 1.3a12 12 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z' }]],
  mail: [
    ['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2.2 }],
    ['path', { d: 'M3.6 7.2 12 13l8.4-5.8' }],
  ],
  calendar: [
    ['rect', { x: 3.5, y: 5, width: 17, height: 15, rx: 2.2 }],
    ['path', { d: 'M3.5 10h17M8 3v4M16 3v4' }],
    ['path', { d: 'm12 12.6.7 1.6 1.7.2-1.3 1.1.4 1.7-1.5-.9-1.5.9.4-1.7-1.3-1.1 1.7-.2z', class: 'fill' }],
  ],
  clock: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M12 7.5V12l3 2' }],
  ],
  pin: [
    ['path', { d: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z' }],
    ['circle', { cx: 12, cy: 10, r: 2.3 }],
  ],
  ticket: [
    ['path', { d: 'M3.5 7.5h17v3a1.8 1.8 0 0 0 0 3.6v3h-17v-3a1.8 1.8 0 0 0 0-3.6z' }],
    ['path', { d: 'M14.5 8.3v8', 'stroke-dasharray': '1.6 2' }],
    ['path', { d: 'm9 10.6.6 1.3 1.4.2-1 1 .2 1.4L9 13.8l-1.2.7.2-1.4-1-1 1.4-.2z', class: 'fill' }],
  ],
  music: [
    ['path', { d: 'M9 17.5V6.2l10-2.2v11.5' }],
    ['circle', { cx: 6.8, cy: 17.6, r: 2.3 }],
    ['circle', { cx: 16.8, cy: 15.6, r: 2.3 }],
  ],
  instagram: [
    ['rect', { x: 4, y: 4, width: 16, height: 16, rx: 4.6 }],
    ['circle', { cx: 12, cy: 12, r: 3.8 }],
    ['circle', { cx: 16.7, cy: 7.3, r: 1, class: 'fill' }],
  ],
  sparkle: [['path', { d: 'm12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z', class: 'fill' }]],
};

export function icon(name, className = 'icon') {
  const parts = ICONS[name];
  if (!parts) throw new Error(`unknown icon: ${name}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of parts) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    svg.append(node);
  }
  return svg;
}

/** Swap every <i data-icon="name"> placeholder in static markup for its SVG. */
export function hydrateIcons(root = document) {
  for (const slot of root.querySelectorAll('i[data-icon]')) {
    slot.replaceWith(icon(slot.dataset.icon, slot.className || 'icon'));
  }
}
