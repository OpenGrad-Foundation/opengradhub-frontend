"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, getBulkParseJobStatus } from "@/lib/api";

const POLL_INTERVAL_MS = 1500;

/**
 * Tracks the background job a bulk quiz save was handed off to.
 *
 * The bulk-import page redirects here with ?uploadJobId=<id> — the quiz does
 * not exist yet at that point, so the landing page polls until the worker is
 * done, then reloads its list and drops the param.
 *
 * @param cleanupUrl  where to land once the job settles — the param must be
 *                    gone so a refresh doesn't re-poll a finished job.
 * @param onCompleted refetch whatever list should now contain the quiz.
 */
export function useBulkSaveJob({
  cleanupUrl,
  onCompleted,
}: {
  cleanupUrl: string;
  onCompleted: () => void | Promise<void>;
}): { jobId: string | null; status: string; expired: boolean } {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobId, setJobId] = useState<string | null>(searchParams.get("uploadJobId"));
  const [status, setStatus] = useState<string>("Uploading and queuing...");
  // Outlives jobId: the expiry notice has to stay on screen after the poll
  // stops and the param is cleared.
  const [expired, setExpired] = useState(false);

  // Held in a ref so a caller passing an inline callback cannot restart the
  // poll loop on every render.
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  const finish = useCallback(() => {
    setJobId(null);
    router.replace(cleanupUrl);
  }, [router, cleanupUrl]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const job = await getBulkParseJobStatus(jobId);
          if (cancelled) break;
          if (job.status === "completed") {
            await onCompletedRef.current();
            if (!cancelled) finish();
            break;
          }
          if (job.status === "failed") {
            alert("Quiz upload failed: " + (job.error || "Unknown error"));
            if (!cancelled) finish();
            break;
          }
          setStatus(job.status === "active" ? "Processing quiz..." : "Queued...");
        } catch (err) {
          // A finished job's result is dropped from Redis after its TTL, and
          // another user's job reads as 404 — neither will ever resolve, so
          // stop instead of polling forever. Other errors may be transient.
          if (err instanceof ApiError && err.status === 404) {
            if (!cancelled) {
              setExpired(true);
              finish();
            }
            break;
          }
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };
    void poll();

    return () => {
      cancelled = true;
    };
  }, [jobId, finish]);

  return { jobId, status, expired };
}
