import { describe, it, expect } from 'vitest';
import { buildAnimatedTitle } from '../src/title.js';

describe('buildAnimatedTitle', () => {
  it('exposes one accessible image made of word layers', () => {
    const t = buildAnimatedTitle('t.webp', 'شيك شك شوك في إسبري', 'intro-title');
    expect(t.getAttribute('role')).toBe('img');
    expect(t.getAttribute('aria-label')).toBe('شيك شك شوك في إسبري');
    expect(t.classList.contains('title-anim')).toBe(true);
    expect(t.classList.contains('intro-title')).toBe(true);
    const layers = t.querySelectorAll('img.word');
    expect(layers).toHaveLength(4);
    for (const img of layers) {
      expect(img.getAttribute('src')).toBe('t.webp');
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('adds twinkling sparkles', () => {
    const t = buildAnimatedTitle('t.webp', 'x');
    expect(t.querySelectorAll('.twinkle').length).toBeGreaterThanOrEqual(4);
  });
});
