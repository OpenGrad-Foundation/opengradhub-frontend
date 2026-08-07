/**
 * Bulk school-linking for a live class.
 *
 * The backend endpoint (POST /attendance/live-classes/:id/links) takes ONE
 * school per call, so "add these five schools" is composed client-side. Kept
 * free of network/React imports so it can be tested as plain logic.
 */

export type BulkAddResult = {
  /** Calls that succeeded. Note the endpoint is upsert-like (ON CONFLICT DO
   *  NOTHING returning the existing row), so this counts calls that went
   *  through, not rows newly inserted. */
  linked: number;
  failed: { id: string; message: string }[];
};

/**
 * Runs `add` over the unique `schoolIds`, at most `concurrency` at a time.
 *
 * Individual failures are collected rather than aborting the rest — one
 * out-of-scope school shouldn't stop the other four from being linked. If
 * *every* call fails the first error is rethrown, so a caller's `onError`
 * still fires on a wholesale failure (bad permissions, network down).
 */
export async function addSchoolLinksBatch(
  schoolIds: string[],
  add: (schoolId: string) => Promise<unknown>,
  concurrency = 5,
): Promise<BulkAddResult> {
  const ids = [...new Set(schoolIds)];
  if (ids.length === 0) return { linked: 0, failed: [] };

  const failed: { id: string; message: string }[] = [];
  let linked = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await add(id);
        linked += 1;
      } catch (e) {
        failed.push({ id, message: e instanceof Error ? e.message : 'Failed to add school.' });
      }
    }
  }

  // Always at least one worker: a zero/negative limit must not silently skip the work.
  const workers = Math.max(1, Math.min(concurrency, ids.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));

  if (linked === 0) {
    throw new Error(failed[0]?.message ?? 'Failed to add schools.');
  }

  return { linked, failed };
}
