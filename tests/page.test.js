import { describe, it, expect } from 'vitest';
import html from '../index.html?raw';

const doc = new DOMParser().parseFromString(html, 'text/html');

describe('static page', () => {
  it('credits Youssef Abbes as plain text, not a link', () => {
    const credit = doc.querySelector('footer .credit');
    expect(credit.querySelector('.credit-name').textContent.trim()).toBe('Youssef Abbes');
    expect(credit.querySelector('a')).toBeNull();
    expect(html).not.toContain('github.com/YoussefAbbes');
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
