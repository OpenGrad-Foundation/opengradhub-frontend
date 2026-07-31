import type { SchoolOption } from "@/lib/api";

const FUZZY_MAX_DISTANCE = 2;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Small classic Levenshtein — school names/codes are short. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > FUZZY_MAX_DISTANCE) return FUZZY_MAX_DISTANCE + 1;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Best-effort, conservative match of a VLM-guessed school name/code against
 * the schools list already loaded for the picker. Single-confident-match
 * only — anything ambiguous returns null so the caller silently falls back
 * to manual selection rather than risk prefilling the wrong school.
 */
export function matchSchoolGuess(guess: string | null, schools: SchoolOption[]): SchoolOption | null {
  if (!guess) return null;
  const norm = normalize(guess);

  const exact = schools.filter(
    (s) => normalize(s.name) === norm || (s.code && normalize(s.code) === norm),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const fuzzy = schools.filter((s) => editDistance(norm, normalize(s.name)) <= FUZZY_MAX_DISTANCE);
  return fuzzy.length === 1 ? fuzzy[0] : null;
}
