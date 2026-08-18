"use client";

/**
 * Dashboard action widget: which of the caller's schools owe a paper register
 * for the last completed month.
 *
 * Deliberately a to-do list rather than a percentage. A number tells you the
 * programme is at 71%; this tells you which four schools to chase, and each row
 * lands one click from the upload that clears it. The current month is never
 * counted — a register is collected at month end, so flagging it on the 3rd
 * would make the widget noise, and a widget people learn to ignore is worse
 * than no widget.
 */
import React from "react";
import Link from "next/link";
import ListCard from "@/components/dashboard/primitives/ListCard";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { useRegisterGaps } from "@/lib/queries/attendance";
import type { RegisterGapRow } from "@/lib/attendance-api";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Why this school is listed, in the fewest words that stay true. */
function gapReason(row: RegisterGapRow, dueMonth: string): string {
  if (row.last_month === null) return "never submitted";
  // A later month exists but the due one was skipped — saying "behind" would
  // misdescribe it, so name the hole instead.
  if (row.last_month > dueMonth) return `${monthLabel(dueMonth)} missing`;
  return `nothing since ${monthLabel(row.last_month)}`;
}

export default function RegisterGaps() {
  const { data, isLoading, error, refetch } = useRegisterGaps();

  if (error) {
    return <WidgetError message="Could not load register status." onRetry={() => void refetch()} />;
  }

  const dueMonth = data?.due_month ?? null;
  const title = dueMonth ? `Registers · ${monthLabel(dueMonth)}` : "Registers";
  const rows = data?.schools ?? [];
  const hidden = (data?.behind_total ?? 0) - rows.length;

  return (
    <ListCard
      title={title}
      isLoading={isLoading}
      emptyHelper={
        data
          ? data.total === 0
            ? "No schools assigned to you yet"
            : `All ${data.total} schools submitted ${dueMonth ? monthLabel(dueMonth) : "on time"}`
          : undefined
      }
    >
      {rows.length > 0
        ? [
            <p key="summary" className="text-sm text-[rgba(3,72,82,0.6)]">
              <span className="font-bold text-[var(--dark-teal)]">
                {data!.behind_total} of {data!.total}
              </span>{" "}
              schools have not submitted
            </p>,
            ...rows.map((row) => (
              <Link
                key={row.school_id}
                href={`/dashboard/attendance?tab=registers&school_id=${encodeURIComponent(row.school_id)}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-[rgba(3,72,82,0.04)]"
              >
                <span className="truncate font-medium text-[var(--dark-teal)]">{row.school_name}</span>
                <span className="shrink-0 text-xs text-[rgba(3,72,82,0.55)]">
                  {gapReason(row, data!.due_month)}
                </span>
              </Link>
            )),
            ...(hidden > 0
              ? [
                  <p key="more" className="px-3 pt-1 text-xs text-[rgba(3,72,82,0.5)]">
                    Showing {rows.length} of {data!.behind_total}
                  </p>,
                ]
              : []),
          ]
        : null}
    </ListCard>
  );
}
