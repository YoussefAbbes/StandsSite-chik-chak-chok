// The gold calligraphy is one bitmap cut from the poster. To make it dance,
// we stack four copies and clip each to one word (شيك · شك · شوك · في إسبري);
// CSS then bounces each word on its own beat. Screen readers get one image.

const WORDS = ['w-shik', 'w-shak', 'w-shok', 'w-sub'];
const TWINKLES = [
  [8, 18], [30, 6], [55, 14], [78, 4], [92, 30], [18, 62], [70, 70],
];

export function buildAnimatedTitle(src, alt, extraClass = '') {
  const wrap = document.createElement('div');
  wrap.className = `title-anim ${extraClass}`.trim();
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', alt);
  for (const word of WORDS) {
    const img = document.createElement('img');
    img.className = `word ${word}`;
    img.src = src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.width = 1200;
    img.height = 467;
    img.decoding = 'async';
    wrap.append(img);
  }
  TWINKLES.forEach(([x, y], i) => {
    const s = document.createElement('span');
    s.className = 'twinkle';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('left', `${x}%`);
    s.style.setProperty('top', `${y}%`);
    s.style.setProperty('animation-delay', `${(i * 0.37) % 2.2}s`);
    wrap.append(s);
  });
  return wrap;
}
