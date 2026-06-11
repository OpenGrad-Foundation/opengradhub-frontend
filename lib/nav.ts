/**
 * Back-navigation helpers. Back buttons read a `?from=` query param so they
 * return to the page the user actually came from; `getBackHref` validates it
 * (internal dashboard paths only) and falls back to the page's canonical parent.
 */

const ALLOWED_PREFIX = '/dashboard';

/** Sanitized back target: `from` if it is a safe internal dashboard URL, else `fallback`. */
export function getBackHref(from: string | null, fallback: string): string {
  if (!from) return fallback;
  if (!from.startsWith(ALLOWED_PREFIX)) return fallback;
  // Raw scheme or protocol-relative content anywhere in the value is rejected;
  // legitimate nested URLs arrive percent-encoded so they never contain ':' or '//'.
  if (from.includes(':') || from.includes('//')) return fallback;
  return from;
}

/** Returns `href` with the current URL attached as an encoded `from` param. */
export function withFrom(href: string, currentUrl: string): string {
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}from=${encodeURIComponent(currentUrl)}`;
}
