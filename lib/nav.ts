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

export type ProgrammeTab = 'overview' | 'people' | 'students' | 'schools' | 'batches' | 'content' | 'settings';
export type ProgrammeUrlState = {
  tab: ProgrammeTab; q: string; school: string; via: '' | 'PROGRAMME' | 'BATCH' | 'SCHOOL'; page: number;
};

export function readProgrammeState(params: Pick<URLSearchParams, 'get'>): ProgrammeUrlState {
  const tabs = ['overview', 'people', 'students', 'schools', 'batches', 'content', 'settings'];
  const tab = params.get('tab') ?? '';
  const via = params.get('via') ?? '';
  const page = Number(params.get('page') ?? 0);
  return {
    tab: tabs.includes(tab) ? tab as ProgrammeTab : 'overview',
    q: params.get('q') ?? '', school: params.get('school') ?? '',
    via: ['PROGRAMME', 'BATCH', 'SCHOOL'].includes(via) ? via as ProgrammeUrlState['via'] : '',
    page: Number.isSafeInteger(page) && page >= 0 ? page : 0,
  };
}

export function updateProgrammeUrl(pathname: string, params: Pick<URLSearchParams, 'toString'>, changes: Partial<ProgrammeUrlState>): string {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(changes)) {
    if (value === '' || (key === 'page' && value === 0)) next.delete(key);
    else next.set(key, String(value));
  }
  return `${pathname}${next.size ? `?${next}` : ''}`;
}
