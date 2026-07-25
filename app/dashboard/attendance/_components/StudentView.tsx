"use client";

/** Student's own attendance + global quiz stats — mobile-first cards. */
import { useMyAttendance } from "@/lib/queries/attendance";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function StudentView() {
  const { data, isLoading } = useMyAttendance();

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!data) return <p className="text-slate-500">Could not load attendance.</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">Your attendance</h2>
        {data.register.percent === null ? (
          <p className="mt-2 text-slate-500">No attendance recorded yet.</p>
        ) : (
          <>
            <p className="mt-2 text-4xl font-bold text-slate-900">{data.register.percent}%</p>
            <div className="mt-3 space-y-1.5">
              {data.register.months.map((m) => (
                <div key={m.month} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{monthLabel(m.month)}</span>
                  <span className="font-medium text-slate-800">
                    {m.present} / {m.total} days
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">Live classes</h2>
        {data.school_links.total === 0 ? (
          <p className="mt-2 text-slate-500">No live classes for your school yet.</p>
        ) : (
          <p className="mt-2 text-lg text-slate-800">
            Your school attended{" "}
            <b>{data.school_links.attended} of {data.school_links.total}</b> live classes
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">Global quizzes</h2>
        {data.quizzes.assigned === 0 ? (
          <p className="mt-2 text-slate-500">No global quizzes assigned yet.</p>
        ) : (
          <>
            <p className="mt-2 text-lg text-slate-800">
              Completed <b>{data.quizzes.completed} of {data.quizzes.assigned}</b>
            </p>
            <div className="mt-3 space-y-1.5">
              {data.quizzes.items.map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate pr-2">{q.title}</span>
                  {q.completed ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✓ Done</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
