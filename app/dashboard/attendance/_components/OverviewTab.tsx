"use client";

/** Per-school aggregates across both streams. */
import { useAttendanceSummary } from "@/lib/queries/attendance";

export function OverviewTab() {
  const { data, isLoading } = useAttendanceSummary();

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  const schools = data?.schools ?? [];
  if (schools.length === 0) {
    return <p className="text-slate-500">No attendance data yet.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
            <th className="px-4 py-2.5 font-medium">School</th>
            <th className="px-4 py-2.5 font-medium">Live classes (link stream)</th>
            <th className="px-4 py-2.5 font-medium">Register (days present)</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => {
            const regPct = s.register_total > 0
              ? Math.round((s.register_present / s.register_total) * 100)
              : null;
            return (
              <tr key={s.school_id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">{s.school_name}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {s.link_total > 0 ? `Attended ${s.link_attended} of ${s.link_total}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {s.register_total > 0
                    ? `${s.register_present} / ${s.register_total} (${regPct}%)`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
