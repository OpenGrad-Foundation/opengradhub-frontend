import { ApiError } from '@/lib/api';

/**
 * True when the server rejected a replayed quiz submit terminally — the attempt
 * can never be accepted, so the saved draft is safe to delete.
 *
 * This must stay generous. A draft is only ever cleared on success or on a
 * terminal error, and "Not now" deliberately keeps it, so every rejection this
 * predicate misses turns into a recovery modal that reappears on every single
 * page load, forever.
 *
 * Terminal cases:
 *   - 409 — attempt voided/reset by a supervisor, or the quiz was archived.
 *   - 404 — attempt (or its quiz) no longer exists.
 *   - 403 — the quiz is no longer assigned to this student.
 *   - 400 with a specific message: already submitted, time expired, or the
 *     attempt belongs to a different account (the backend signals all three
 *     with a plain 400, so match the message rather than the status alone).
 */
export function isTerminalSubmitError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 409 || e.status === 404 || e.status === 403) return true;
  if (e.status === 400) {
    if (/already\s+(been\s+)?submitted/i.test(e.message)) return true;
    if (/time is up/i.test(e.message)) return true;
    if (/does not belong to you/i.test(e.message)) return true;
  }
  return false;
}
