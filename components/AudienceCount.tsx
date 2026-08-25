"use client";

import type { AudiencePreview } from "@/lib/api";

/**
 * The number the prose cannot carry.
 *
 * Live-class filters AND together, so "students enrolled in X AND in the UG
 * programme AND in 2 batches" reads identically whether it matches forty
 * students or nobody at all. Zero is the answer that matters most here — it is
 * silent, easy to build, and only discovered after the class fails to appear
 * for anyone.
 */
export function AudienceCount({ preview }: {
  preview: { data?: AudiencePreview; isFetching: boolean; error: unknown };
}) {
  const { data, isFetching, error } = preview;

  if (error) {
    return (
      <p style={{ fontSize: "12px", color: "#4a6b70", margin: "4px 0 0" }}>
        Couldn&apos;t count this audience — the class can still be scheduled.
      </p>
    );
  }
  if (!data) {
    return (
      <p style={{ fontSize: "12px", color: "#4a6b70", margin: "4px 0 0" }}>
        {isFetching ? "Counting…" : " "}
      </p>
    );
  }

  const none = data.total === 0;
  return (
    <p
      style={{
        fontSize: "12px",
        margin: "4px 0 0",
        fontWeight: none ? 700 : 600,
        color: none ? "#c62828" : "#067a3f",
        opacity: isFetching ? 0.6 : 1,
      }}
    >
      {none
        ? "No students match this combination — nobody would see this class."
        : `${data.total} student${data.total === 1 ? "" : "s"} match.`}
      {/* Not a blocker: the class is still worth scheduling, but their
          attendance will read as not-recorded rather than a false absent. */}
      {data.untrackable > 0 && !none && (
        <span style={{ display: "block", fontWeight: 500, color: "#4a6b70" }}>
          {data.untrackable} of them {data.untrackable === 1 ? "is" : "are"} in no batch,
          so their attendance can&apos;t be tracked.
        </span>
      )}
    </p>
  );
}
