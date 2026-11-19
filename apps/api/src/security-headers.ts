import helmet from 'helmet';

/**
 * Content security policy of the app, as changes to helmet's defaults: images also come from blobs (previews, chart
 * exports) and from any HTTPS address (map tiles, images linked in a text, remote images of a mail once allowed).
 */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
};

/** Security headers every page of the app carries, whoever serves it (the API, or Apache for the built files). */
const PAGE_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/**
 * Content security policy of the app as a header value: helmet's defaults with `CSP_DIRECTIVES`.
 * @returns {string} Value of Content-Security-Policy.
 */
export function contentSecurityPolicy(): string {
  const directives: Record<string, Iterable<unknown>> = { ...helmet.contentSecurityPolicy.getDefaultDirectives(), ...CSP_DIRECTIVES };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join(';');
}

/**
 * Block of the .htaccess of the built web app: Apache serves its files itself (the API never sees them), so it gives
 * them the headers the API gives its own answers, and sends plain HTTP to HTTPS (for the API too). Written by `scripts/deploy.sh` (`npm run htaccess:print`).
 * @returns {string} Apache directives, between their markers.
 */
export function htaccessSecurityBlock(): string {
  const headers = Object.entries(PAGE_HEADERS).map(([name, value]) => `  Header always set ${name} "${value}"`);
  return [
    '# BEGIN ordo-security (written by scripts/deploy.sh: do not edit)',
    '<IfModule mod_headers.c>',
    ...headers,
    '  <FilesMatch "\\.html$">',
    `    Header always set Content-Security-Policy "${contentSecurityPolicy()}"`,
    '  </FilesMatch>',
    '</IfModule>',
    // Plain HTTP goes to HTTPS; both tests, so that a proxy ending TLS before Apache does not loop.
    '<IfModule mod_rewrite.c>',
    '  RewriteEngine On',
    '  RewriteCond %{HTTPS} !=on',
    '  RewriteCond %{HTTP:X-Forwarded-Proto} !=https',
    '  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]',
    '</IfModule>',
    '# END ordo-security',
    '',
  ].join('\n');
}
