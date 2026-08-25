"use client";

/**
 * Records — the default Attendance view and the only place individual
 * attendance is reported.
 *
 * It asks one API which answers for BOTH kinds of cohort: an online batch is
 * answered from join marks, a school-based one from the committed register.
 * The screen never has to know which — that is the whole point of the
 * consolidation, and why the old Overview tab (school totals from one stream)
 * and the Live Classes "Students" grid (classes only) are both gone.
 */
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { getCourses, type Course } from "@/lib/api";
import { useBatches } from "@/lib/queries/batches";
import { useAttendanceRecords, useStudentRecords } from "@/lib/queries/attendance";
import type { AttendanceStatus } from "@/lib/attendance-api";
import { ApiError } from "@/lib/api";

type Cohort = { type: "batch" | "course"; id: string };

const CELL: Record<AttendanceStatus, { mark: string; color: string; title: string }> = {
  PRESENT: { mark: "✓", color: "#0abe62", title: "Present" },
  ABSENT: { mark: "✗", color: "rgba(229,62,62,0.8)", title: "Absent" },
  UNKNOWN: { mark: "–", color: "rgba(3,72,82,0.35)", title: "Not recorded" },
};

export function RecordsTab() {
  const [cohort, setCohort] = useState<Cohort>({ type: "batch", id: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [studentQ, setStudentQ] = useState("");
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<string | null>(null);

  const filters = {
    ...(cohort.type === "batch" ? { batch_id: cohort.id } : { course_id: cohort.id }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(studentQ.trim() ? { student_q: studentQ.trim() } : {}),
    page,
    limit: 25,
  };
  const { data, isPending, error } = useAttendanceRecords(cohort.id ? filters : {});

  // A cohort that spans both delivery modes is a 400 by design — it is a
  // question with no single answer, not a failure. Say so, and say what to do.
  const mixed = error instanceof ApiError && error.status === 400;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cohort.type}
          onChange={(e) => { setCohort({ type: e.target.value as Cohort["type"], id: "" }); setPage(1); }}
          aria-label="Cohort type"
          className={CONTROL}
        >
          <option value="batch">By batch</option>
          <option value="course">By course</option>
        </select>

        <CohortPicker
          type={cohort.type}
          value={cohort.id}
          onChange={(id) => { setCohort((c) => ({ ...c, id })); setPage(1); }}
        />

        <input type="date" value={from} aria-label="From date"
          onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={CONTROL} />
        <span className="text-xs text-slate-500">to</span>
        <input type="date" value={to} aria-label="To date"
          onChange={(e) => { setTo(e.target.value); setPage(1); }} className={CONTROL} />

        <input
          type="search"
          value={studentQ}
          placeholder="Find a student…"
          aria-label="Find a student"
          onChange={(e) => { setStudentQ(e.target.value); setPage(1); }}
          className={`${CONTROL} min-w-[160px]`}
        />
      </div>

      {!cohort.id ? (
        <Panel>Pick a {cohort.type} to see attendance.</Panel>
      ) : mixed ? (
        <Panel>{(error as ApiError).message}</Panel>
      ) : isPending ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : !data ? null : (
        <>
          <Totals data={data} />
          {data.occasions.length === 0 ? (
            <Panel>Nothing has been recorded for this cohort in this period yet.</Panel>
          ) : (
            <Grid data={data} onDrill={setDrill} />
          )}
          {data.total > data.limit && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={PAGE_BTN}>← Prev</button>
              <span>Page {data.page} · {data.total} students</span>
              <button disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)} className={PAGE_BTN}>Next →</button>
            </div>
          )}
        </>
      )}

      {drill && (
        <StudentDrilldown
          studentId={drill}
          cohort={cohort}
          from={from}
          to={to}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

/** The numbers the deleted Overview tab used to carry, for the cohort on screen. */
function Totals({ data }: { data: NonNullable<ReturnType<typeof useAttendanceRecords>["data"]> }) {
  const source = data.mode === "ONLINE" ? "from live-class attendance" : "from committed school registers";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-3xl font-bold text-[var(--dark-teal)]" style={{ fontFamily: "var(--font-heading)" }}>
          {data.totals.pct}%
        </span>
        <span className="text-sm text-slate-600">
          {data.totals.present} of {data.totals.marked} recorded marks present
        </span>
        <span className="text-sm text-slate-500">
          {data.totals.students} students · {data.totals.occasions} {data.mode === "ONLINE" ? "classes" : "days"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{source}</p>
    </div>
  );
}

function Grid({ data, onDrill }: {
  data: NonNullable<ReturnType<typeof useAttendanceRecords>["data"]>;
  onDrill: (studentId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="sticky left-0 bg-white px-4 py-2.5 text-left font-medium">Student</th>
              {data.occasions.map((o) => (
                <th key={o.key} className="px-3 py-2.5 font-medium whitespace-nowrap" title={o.label}>
                  {o.kind === "LIVE_CLASS"
                    ? new Date(o.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                    : o.at.slice(5)}
                </th>
              ))}
              <th className="px-3 py-2.5 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((st) => (
              <tr key={st.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[var(--dark-teal)]">
                  {/* A real control, not a clickable row: a <tr> with onClick is
                      unreachable by keyboard and announces nothing. */}
                  <button
                    type="button"
                    onClick={() => onDrill(st.id)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    {st.name}
                    {st.school_name && <span className="block text-[11px] font-normal text-slate-500">{st.school_name}</span>}
                    <span className="sr-only"> — open attendance history</span>
                  </button>
                </td>
                {st.cells.map((c, i) => (
                  <td
                    key={data.occasions[i].key}
                    className="px-3 py-2.5 text-center font-bold"
                    style={{ color: CELL[c].color }}
                    title={CELL[c].title}
                  >
                    {CELL[c].mark}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center font-bold text-[var(--dark-teal)]">
                  {st.marked === 0 ? "—" : `${st.pct}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CohortPicker({ type, value, onChange }: {
  type: "batch" | "course";
  value: string;
  onChange: (v: string) => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseError, setCourseError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCourseError(false);
    getCourses(undefined, undefined, undefined, true)
      .then((cs) => { if (!cancelled) setCourses(cs); })
      .catch(() => { if (!cancelled) setCourseError(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const batches = useBatches();

  // An empty picker and a failed picker look identical, and the records query
  // stays disabled either way — so the failure has to be said out loud, with a
  // way back. Silently swallowing it stranded the user on "Pick a batch".
  const failed = type === "course" ? courseError : batches.isError;
  if (failed) {
    return (
      <span className="flex items-center gap-2 text-sm text-red-600">
        Couldn&apos;t load {type}s.
        <button
          type="button"
          onClick={() => (type === "course" ? setReloadKey((k) => k + 1) : void batches.refetch())}
          className="font-semibold underline"
        >
          Retry
        </button>
      </span>
    );
  }

  const options = type === "course"
    ? courses.map((c) => ({ id: c.id, label: c.title }))
    : (batches.data ?? []).map((b) => ({ id: b.id, label: b.name }));

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Select ${type}`} className={`${CONTROL} min-w-[220px]`}>
      <option value="">Select {type}…</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

function StudentDrilldown({ studentId, cohort, from, to, onClose }: {
  studentId: string;
  cohort: Cohort;
  from: string;
  to: string;
  onClose: () => void;
}) {
  // The cohort and range travel with the drill-down: opening a row from a
  // filtered grid must not answer a different question than the row did.
  const { data, isPending, error } = useStudentRecords(studentId, {
    ...(cohort.type === "batch" ? { batch_id: cohort.id } : { course_id: cohort.id }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  return (
    <Modal
      onClose={onClose}
      maxWidth="640px"
      title={
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--teal)]">Attendance history</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--dark-teal)]" style={{ fontFamily: "var(--font-heading)" }}>
            {data?.student.name ?? "…"}
          </h2>
          {data?.student.school_name && <p className="text-sm text-slate-500">{data.student.school_name}</p>}
        </>
      }
    >
      {isPending ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : data ? (
        <>
            {data.note && <p className="text-sm text-slate-500">{data.note}</p>}

            <div className="max-h-[55vh] space-y-4 overflow-y-auto">
              {data.series.map((s) => (
                <div key={s.mode}>
                  <p className="mb-2 text-sm font-semibold text-slate-600">
                    {s.mode === "ONLINE" ? "Live classes" : "School register"} ·{" "}
                    {s.summary.present}/{s.summary.marked} ({s.summary.pct}%)
                  </p>
                  <div className="space-y-1.5">
                    {s.entries.map((e) => (
                      <div key={e.key} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--dark-teal)]">{e.label}</p>
                          <p className="text-xs text-slate-500">
                            {e.kind === "LIVE_CLASS" ? new Date(e.at).toLocaleDateString("en-IN") : e.at}
                            {e.source === "MANUAL" && e.marked_by_name ? ` · marked by ${e.marked_by_name}` : ""}
                            {e.source === "JOIN" ? " · joined the class" : ""}
                            {e.source === "REGISTER" ? " · from the school register" : ""}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
                          style={{
                            background: e.status === "PRESENT" ? "rgba(10,190,98,0.12)"
                              : e.status === "ABSENT" ? "rgba(229,62,62,0.1)" : "rgba(3,72,82,0.07)",
                            color: e.status === "PRESENT" ? "#0abe62"
                              : e.status === "ABSENT" ? "#e53e3e" : "rgba(3,72,82,0.55)",
                          }}
                        >
                          {CELL[e.status].title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}

const CONTROL =
  "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--dark-teal)] bg-white";
const PAGE_BTN =
  "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--dark-teal)] disabled:opacity-40";
