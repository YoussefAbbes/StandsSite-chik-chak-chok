import { describe, it, expect } from 'vitest';
import html from '../index.html?raw';

const doc = new DOMParser().parseFromString(html, 'text/html');

describe('static page', () => {
  it('credits Youssef Abbes with a glowing link to GitHub', () => {
    const a = doc.querySelector('footer a.credit-link');
    expect(a).not.toBeNull();
    expect(a.textContent.trim()).toBe('Youssef Abbes');
    expect(a.getAttribute('href')).toBe('https://github.com/YoussefAbbes');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('hero tagline', () => {
  it('asks "fech testannew?" in Tunisian Arabic instead of the English line', () => {
    const t = doc.querySelector('#hero .tagline-ar');
    expect(t).not.toBeNull();
    expect(t.textContent.trim()).toBe('فاش تستنّاو؟');
    expect(t.getAttribute('lang')).toBe('ar');
    expect(t.getAttribute('dir')).toBe('rtl');
    expect(html).not.toContain('An Oriental Celebration');
  });
});
