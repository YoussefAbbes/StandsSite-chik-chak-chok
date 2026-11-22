// Security meta tags injected into the built page only (the dev server needs
// inline styles for hot reload). GitHub Pages can't send custom headers, so the
// policy travels as <meta http-equiv>. Everything is self-hosted: no third parties.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  'upgrade-insecure-requests',
].join('; ');

export function securityMeta() {
  return {
    name: 'security-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const tags =
          `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    ` +
          '<meta name="referrer" content="strict-origin-when-cross-origin" />\n    ';
        return html.replace('<meta name="viewport"', `${tags}<meta name="viewport"`);
      },
    },
  };
}
