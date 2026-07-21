import type { OverviewWidgets } from "@/lib/queries/dashboard/_shared";

/**
 * Appends the "Reported Questions" StatCard to an overview widget set.
 * `show` should be the caller's test_bank.manage_questions permission; when
 * false the widgets are returned untouched (never mutated).
 */
export function withReportedStat(
  widgets: OverviewWidgets,
  opts: { show: boolean; count: number },
): OverviewWidgets {
  if (!opts.show) return widgets;
  return {
    ...widgets,
    stats: [
      ...widgets.stats,
      {
        key: "reported",
        label: "Reported Questions",
        value: opts.count,
        href: "/dashboard/test-bank?reports=open",
        helper: "None open",
      },
    ],
  };
}
