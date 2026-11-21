import { ApiError } from '../api';

const MAX_BACKOFF_MS = 30_000;
const MAX_AUTOMATIC_WAIT_MS = 120_000;
const nextRetryAt = new WeakMap<Error, number>();

export function retryAfterAt(error: Error | null | undefined) {
  return error && error instanceof ApiError ? error.retryAfterAt : undefined;
}

export function canRetryQuery(failureCount: number, error: Error, maxRetries = 1) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
    return false;
  }
  // A long server cooldown stays in force, but does not keep the query pending.
  return failureCount < maxRetries && (retryAfterAt(error) ?? 0) - Date.now() <= MAX_AUTOMATIC_WAIT_MS;
}

export function queryRetryDelay(failureCount: number, error: Error) {
  const now = Date.now();
  const backoff = Math.min(1_000 * 2 ** failureCount, MAX_BACKOFF_MS);
  const delay = Math.max(backoff, (retryAfterAt(error) ?? 0) - now) + Math.floor(Math.random() * 250);
  if (error instanceof Error) nextRetryAt.set(error, now + delay);
  return delay;
}

export function automaticRetryAt(error: Error | null | undefined) {
  return error ? nextRetryAt.get(error) : undefined;
}
