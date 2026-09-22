"use client";

import Link from "next/link";
import styles from "@/components/dashboard/workspace.module.css";
import { useOpenReportedCount } from "@/lib/queries/dashboard/use-reported-count";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import RegisterGaps from "@/components/dashboard/RegisterGaps";
import WidgetError from "@/components/dashboard/primitives/WidgetError";

export default function PMFollowUps() {
  const { has } = usePermissions();
  const canTriage = has(PERM.test_bank.manage_questions) && has(PERM.students.view) && has(PERM.test_bank.view);
  const canUseRegisters = has(PERM.attendance.view) && has(PERM.attendance.manage) && has(PERM.students.view) && (has(PERM.schools.view) || has(PERM.user_management.create));
  const reports = useOpenReportedCount(canTriage);

  if (!canUseRegisters && !canTriage) return <p className="py-6 text-sm text-[var(--color-text-muted)]">No follow-up tools are available for your access.</p>;

  return (
    <div className={`${styles.followUps} text-[var(--color-text)]`}>
      <RegisterGaps compact />
      {canTriage && <section aria-labelledby="reports-heading" className={canUseRegisters ? "mt-6 border-t border-[var(--color-border)] pt-6" : "py-4"}>
        <h2 id="reports-heading" className="text-lg font-semibold">Reported questions</h2>
        {reports.isLoading ? <p role="status" className="py-4 text-sm text-[var(--color-text-muted)]">Checking reported questions…</p>
          : reports.error ? <WidgetError compact message="Could not check reported questions." onRetry={() => void reports.refetch()} />
          : reports.count > 0 ? (
            <Link href="/dashboard/test-bank?reports=open" className="mt-3 justify-between text-sm">
              <span>{reports.count} {reports.count === 1 ? "question needs" : "questions need"} review</span>
              <span className="shrink-0 font-medium text-[var(--teal)]">Review →</span>
            </Link>
          ) : <p className="py-4 text-sm text-[var(--color-text-muted)]">No open question reports</p>}
      </section>}
    </div>
  );
}
