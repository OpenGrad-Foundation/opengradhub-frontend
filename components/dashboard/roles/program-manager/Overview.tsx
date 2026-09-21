"use client";

import Link from "next/link";
import { useInsightsOverview } from "@/lib/queries/dashboard/_insights-overview";
import { useRegisterGaps } from "@/lib/queries/attendance";
import { useOpenReportedCount } from "@/lib/queries/dashboard/use-reported-count";
import { usePermissions } from "@/hooks/use-permission";
import { PERM, canAccessDashboardPath } from "@/lib/permissions";
import styles from "@/components/dashboard/workspace.module.css";
import ChartCard from "@/components/dashboard/primitives/ChartCard";
import WidgetError from "@/components/dashboard/primitives/WidgetError";

export default function PMOverview({ userId }: { userId: string }) {
  const overview = useInsightsOverview("PROGRAM_MANAGER", userId);
  const { has, hasAll } = usePermissions();
  const canUseRegisters = hasAll(PERM.attendance.view, PERM.attendance.manage, PERM.students.view) && (has(PERM.schools.view) || has(PERM.user_management.create));
  const canTriage = hasAll(PERM.test_bank.manage_questions, PERM.students.view, PERM.test_bank.view);
  const registers = useRegisterGaps(canUseRegisters);
  const reports = useOpenReportedCount(canTriage);
  const { widgets } = overview;
  const shortcuts = [
    { href: "/dashboard/tracker", title: "Task tracker", detail: "Review team tasks and blockers" },
    { href: "/dashboard/programmes", title: "Programmes", detail: "Manage programme delivery" },
    { href: "/dashboard/schools", title: "Schools", detail: "Open your school directory" },
    { href: "/dashboard/students", title: "Students", detail: "Find a student in your roster" },
  ].filter(item => canAccessDashboardPath(item.href, has));
  const chartData = {
    ...widgets.chart.data,
    labels: widgets.chart.data.labels.map(month => {
      const date = new Date(`${month}-01T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
    }),
  };

  function refresh() {
    void overview.refetch();
    if (canUseRegisters) void registers.refetch();
    if (canTriage) void reports.refetch();
  }

  return (
    <section aria-label="Programme overview" className="text-[var(--color-text)]">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-text-muted)]">{widgets.scopeLabel || "Your assigned scope"}</p>
        <button type="button" onClick={refresh} aria-label="Refresh programme overview" className={styles.utilityButton}>Refresh</button>
      </div>
      <div className={styles.metricGrid}>
        {overview.error ? <div className="col-span-2"><WidgetError compact message={overview.error} onRetry={overview.refetch} /></div> : widgets.stats.filter(stat => stat.key === "students" || stat.key === "avg").map(stat => (
          <div key={stat.key} className={styles.metricCard}>
            <p className={styles.metricLabel}>{stat.key === "avg" ? "Average score" : "Students reached"}</p>
            <p className={styles.metricValue}>
              {overview.isLoading ? <span role="status" aria-label={`Loading ${stat.label}`} className="block h-9 w-20 animate-pulse rounded bg-slate-100" /> : `${stat.value.toLocaleString()}${stat.key === "avg" ? "%" : ""}`}
            </p>
            <p className={styles.metricFooter}>{stat.key === "avg" ? (!overview.isLoading && stat.value === 0 ? "No submissions or a 0% average in the last 90 days" : "Last 90 days") : "Across your programme"}</p>
          </div>
        ))}
        {canUseRegisters && (registers.error ? <WidgetError compact message="Could not check registers." onRetry={() => void registers.refetch()} /> : (
          <Link href="/dashboard?tab=follow-ups" className={styles.priorityCard}>
            <span className={styles.metricLabel}>Registers missing</span>
            <span className={styles.metricValue}>{registers.isLoading ? "…" : registers.data?.behind_total ?? "—"}</span>
            <span className={styles.metricFooter}>{registers.isLoading ? "Checking schools…" : registers.data?.total === 0 ? "No schools assigned" : registers.data?.behind_total === 0 ? "All submitted · view details" : "View follow-ups →"}</span>
          </Link>
        ))}
        {canTriage && (reports.error ? <WidgetError compact message="Could not check question reports." onRetry={() => void reports.refetch()} /> : (
          <Link href="/dashboard/test-bank?reports=open" className={styles.priorityCard}>
            <span className={styles.metricLabel}>Question reports</span>
            <span className={styles.metricValue}>{reports.isLoading ? "…" : reports.count}</span>
            <span className={styles.metricFooter}>{reports.isLoading ? "Checking reports…" : reports.count === 0 ? "No open reports · view bank" : "Review questions →"}</span>
          </Link>
        ))}
      </div>
      <div className={styles.detailGrid}>
        {!overview.error && <div className={styles.detailPanel}>
          <ChartCard title="New enrolments · 12 months" variant="line" data={chartData} isLoading={overview.isLoading} emptyHelper="Enrolments will appear here once students join a course." compact wholeNumbers />
        </div>}
        {shortcuts.length > 0 && <section aria-labelledby="programme-tools-heading" className={`${styles.detailPanel} order-first lg:order-none`}>
          <h2 id="programme-tools-heading" className="mb-4 text-lg font-semibold">Programme tools</h2>
          <div className={styles.toolsGrid}>
            {shortcuts.map(item => <Link key={item.href} href={item.href} className={styles.actionCard}>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">{item.detail}</span></span>
              <span aria-hidden="true" className={styles.actionArrow}>→</span>
            </Link>)}
          </div>
        </section>}
      </div>
    </section>
  );
}
