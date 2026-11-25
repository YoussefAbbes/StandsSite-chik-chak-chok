import { describe, it, expect } from 'vitest';
import html from '../index.html?raw';
import { securityMeta, CSP } from '../build/security.js';

describe('security meta (build only)', () => {
  const out = securityMeta().transformIndexHtml.handler(html);

  it('injects a strict Content-Security-Policy', () => {
    expect(out).toContain('http-equiv="Content-Security-Policy"');
    for (const rule of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'"]) {
      expect(CSP).toContain(rule);
    }
    expect(CSP).not.toContain('unsafe-inline');
    expect(CSP).not.toContain('unsafe-eval');
  });

  it('lets the reservation form reach only the Google script', () => {
    expect(CSP).toContain("connect-src 'self' https://script.google.com https://script.googleusercontent.com");
  });

  it('sets a strict referrer policy', () => {
    expect(out).toContain('<meta name="referrer" content="strict-origin-when-cross-origin"');
  });

  it('only runs on build, so the dev server keeps hot reload', () => {
    expect(securityMeta().apply).toBe('build');
  });
});

describe('page has no third-party requests', () => {
  it('loads no external stylesheet or script', () => {
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const el of doc.querySelectorAll('link[href], script[src]')) {
      const url = el.getAttribute('href') || el.getAttribute('src');
      expect(url.startsWith('http')).toBe(false);
    }
  });
});
