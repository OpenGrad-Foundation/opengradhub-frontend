import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api';
import { isTerminalSubmitError } from '../lib/quiz-submit-recovery';

describe('isTerminalSubmitError', () => {
  it('treats a 409 as terminal (attempt voided/reset)', () => {
    expect(isTerminalSubmitError(new ApiError('This attempt has been reset by a supervisor.', 409))).toBe(true);
  });

  it('treats a 404 as terminal (attempt no longer exists)', () => {
    expect(isTerminalSubmitError(new ApiError('Attempt "att-1" not found.', 404))).toBe(true);
  });

  it('treats a 403 as terminal (no longer assigned this quiz)', () => {
    expect(isTerminalSubmitError(new ApiError('This quiz is not assigned to you.', 403))).toBe(true);
  });

  it('treats "already submitted" 400s as terminal', () => {
    expect(isTerminalSubmitError(new ApiError('This attempt has already been submitted.', 400))).toBe(true);
    expect(isTerminalSubmitError(new ApiError('This attempt is already submitted.', 400))).toBe(true);
    expect(isTerminalSubmitError(new ApiError('This section has already been submitted.', 400))).toBe(true);
  });

  it('treats a "time is up" 400 as terminal', () => {
    expect(isTerminalSubmitError(new ApiError('Time is up — this attempt can no longer be submitted.', 400))).toBe(true);
  });

  it('treats an ownership-mismatch 400 as terminal', () => {
    expect(isTerminalSubmitError(new ApiError('This attempt does not belong to you.', 400))).toBe(true);
  });

  it('does not treat a transient failure as terminal', () => {
    expect(isTerminalSubmitError(new ApiError('Internal server error', 500))).toBe(false);
    expect(isTerminalSubmitError(new ApiError('Bad request', 400))).toBe(false);
    expect(isTerminalSubmitError(new TypeError('Failed to fetch'))).toBe(false);
  });
});
