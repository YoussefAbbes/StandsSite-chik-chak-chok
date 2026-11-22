import { describe, it, expect, beforeEach } from 'vitest';
import { runIntro, playSilhouette } from '../src/intro.js';

const meta = { frames: 34, cols: 8, w: 240, h: 300, fps: 12 };
let root;

beforeEach(() => {
  document.body.innerHTML = '<div id="intro"></div>';
  root = document.getElementById('intro');
});

const opts = (extra = {}) => ({ reducedMotion: false, silhouette: { url: 'x.webp', meta }, ...extra });

describe('runIntro', () => {
  it('enter resolves and closes the intro', async () => {
    const done = runIntro(root, opts());
    root.querySelector('#enter').click();
    await expect(done).resolves.toBeUndefined();
    expect(root.classList.contains('done')).toBe(true);
    expect(document.body.classList.contains('intro-open')).toBe(false);
  });

  it('has no audio element or music file', () => {
    runIntro(root, opts());
    expect(document.querySelector('audio')).toBeNull();
  });

  it('reduced motion skips animation', () => {
    runIntro(root, opts({ reducedMotion: true }));
    expect(root.classList.contains('static')).toBe(true);
    expect(root.querySelector('#enter').hidden).toBe(false);
  });

  it('skip button resolves', async () => {
    const done = runIntro(root, opts());
    root.querySelector('#skip').click();
    await expect(done).resolves.toBeUndefined();
  });

  it('builds the marquee bulbs, silhouette canvas and title', () => {
    runIntro(root, opts());
    expect(root.querySelectorAll('.marquee .bulb').length).toBeGreaterThanOrEqual(30);
    expect(root.querySelector('canvas.silhouette')).not.toBeNull();
    expect(root.querySelector('img.intro-title')).not.toBeNull();
    expect(document.body.classList.contains('intro-open')).toBe(true);
  });
});

describe('playSilhouette', () => {
  it('returns a stop function even without canvas support', () => {
    const canvas = document.createElement('canvas');
    const stop = playSilhouette(canvas, 'x.webp', meta);
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });
});
