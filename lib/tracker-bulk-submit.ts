/** Sends a validated bulk-fill upload to the batch-save endpoint.
 *
 *  A batch save is one transaction: every edit in the call commits, or none does. That is the
 *  right behaviour for the grid's Save button, but an import can carry hundreds of rows, and a
 *  single row the server rejects — a record deleted since the file was downloaded, a status the
 *  proof rules will not allow — would otherwise throw away the entire import.
 *
 *  So the upload goes out in chunks, and a chunk that fails is split in half and retried until
 *  the rows that actually fail are isolated. Everything around them still saves, and the failures
 *  come back named, with the server's own message attached.
 */
import type { TrackerBatchEdit } from "./tracker-api";

export const CHUNK_SIZE = 25;

export type BulkSubmitProgress = { attempted: number; total: number };

export type BulkSubmitResult = {
  savedRecordIds: string[];
  /** record_id -> the reason the server gave. */
  failures: Map<string, string>;
};

type SaveFn = (edits: TrackerBatchEdit[]) => Promise<unknown>;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "This row could not be saved.";
}

/** Saves one group, narrowing to the individual rows at fault if the server rejects it.
 *  A group of one that fails is the failure, so the recursion always terminates. */
async function saveOrIsolate(
  save: SaveFn,
  edits: TrackerBatchEdit[],
  result: BulkSubmitResult,
  onProgress: (delta: number) => void,
): Promise<void> {
  if (edits.length === 0) return;
  try {
    await save(edits);
    for (const e of edits) result.savedRecordIds.push(e.record_id);
    onProgress(edits.length);
    return;
  } catch (err) {
    if (edits.length === 1) {
      result.failures.set(edits[0].record_id, messageOf(err));
      onProgress(1);
      return;
    }
  }
  const mid = Math.floor(edits.length / 2);
  await saveOrIsolate(save, edits.slice(0, mid), result, onProgress);
  await saveOrIsolate(save, edits.slice(mid), result, onProgress);
}

/** Runs the whole upload. Chunks go out one after another rather than in parallel: they take row
 *  locks on the same table, and a fellow uploading a sheet is not in a hurry. */
export async function submitBulkEdits(
  save: SaveFn,
  edits: TrackerBatchEdit[],
  onProgress?: (p: BulkSubmitProgress) => void,
  chunkSize: number = CHUNK_SIZE,
): Promise<BulkSubmitResult> {
  const result: BulkSubmitResult = { savedRecordIds: [], failures: new Map() };
  let attempted = 0;
  const bump = (delta: number) => {
    attempted += delta;
    onProgress?.({ attempted, total: edits.length });
  };
  for (let i = 0; i < edits.length; i += chunkSize) {
    await saveOrIsolate(save, edits.slice(i, i + chunkSize), result, bump);
  }
  return result;
}
