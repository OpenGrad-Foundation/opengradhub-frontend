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
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
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

export default function RegisterGaps({ compact = false }: { compact?: boolean }) {
  const { has } = usePermissions();
  const canUseRegisters = has(PERM.attendance.view) && has(PERM.attendance.manage) && has(PERM.students.view) && (has(PERM.schools.view) || has(PERM.user_management.create));
  const { data, isLoading, error, refetch } = useRegisterGaps(canUseRegisters);
  if (!canUseRegisters) return null;

  if (error) {
    return <WidgetError compact={compact} message="Could not load register status." onRetry={() => void refetch()} />;
  }

  const dueMonth = data?.due_month ?? null;
  const title = dueMonth ? `Registers · ${monthLabel(dueMonth)}` : "Registers";
  const rows = data?.schools ?? [];
  const hidden = (data?.behind_total ?? 0) - rows.length;

  return (
    <ListCard
      plain={compact}
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
            <p key="summary" className="text-sm text-[var(--color-text-muted)]">
              <span className="font-bold text-[var(--dark-teal)]">
                {data!.behind_total} of {data!.total}
              </span>{" "}
              {data!.behind_total === 1 ? "school has" : "schools have"} not submitted
            </p>,
            ...rows.map((row) => (
              <Link
                key={row.school_id}
                href={`/dashboard/attendance?tab=registers&school_id=${encodeURIComponent(row.school_id)}`}
                className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-3 py-3 transition-colors hover:bg-[var(--color-info-surface)]"
              >
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block break-words font-medium text-[var(--dark-teal)]">{row.school_name}</span>
                  {compact && <span className="mt-1 block text-[var(--color-text-muted)]">{gapReason(row, data!.due_month)}</span>}
                </span>
                <span className="text-sm font-medium text-[var(--teal)]">
                  {compact ? "Review →" : gapReason(row, data!.due_month)}
                </span>
              </Link>
            )),
            ...(hidden > 0
              ? [
                  <Link key="more" href="/dashboard/attendance?tab=registers" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-[var(--teal)] underline underline-offset-4">
                    View all registers ({data!.behind_total} missing)
                  </Link>,
                ]
              : []),
          ]
        : null}
    </ListCard>
  );
}
