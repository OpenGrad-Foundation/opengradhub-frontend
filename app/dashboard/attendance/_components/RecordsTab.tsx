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
import { ApiError } from "@/lib/api";
import { STATUS_LABEL, STATUS_GLYPH, STATUS_FG, STATUS_ORDER, chipStyle } from "@/lib/attendance-status";

type Cohort = { type: "batch" | "course"; id: string };

export function RecordsTab() {
  const [cohort, setCohort] = useState<Cohort>({ type: "batch", id: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [studentQ, setStudentQ] = useState("");
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<string | null>(null);

  // Typing stays local; the query only moves once the user pauses. Feeding the
  // raw input straight into the key fired a request per keystroke against a
  // matrix endpoint — the Live Classes search already debounces the identical
  // control, and this one is used on the same phones.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    if (studentQ.trim() === debouncedQ) return;
    const t = setTimeout(() => { setDebouncedQ(studentQ.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [studentQ, debouncedQ]);

  const filters = {
    ...(cohort.type === "batch" ? { batch_id: cohort.id } : { course_id: cohort.id }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(debouncedQ ? { student_q: debouncedQ } : {}),
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
          onChange={(e) => setStudentQ(e.target.value)}
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
  // "0%" and "0 of 0" are the same lie the rest of this feature exists to stop:
  // an empty record is no evidence, not a cohort that never showed up.
  const nothingRecorded = data.totals.marked === 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        {nothingRecorded ? (
          <span className="text-lg font-semibold text-slate-500" style={{ fontFamily: "var(--font-heading)" }}>
            Nothing recorded yet
          </span>
        ) : (
          <>
            <span className="text-3xl font-bold text-[var(--dark-teal)]" style={{ fontFamily: "var(--font-heading)" }}>
              {data.totals.pct}%
            </span>
            <span className="text-sm text-slate-600">
              {data.totals.present} of {data.totals.marked} recorded marks present
            </span>
          </>
        )}
        <span className="text-sm text-slate-500">
          {data.totals.students} students · {data.totals.occasions} {data.mode === "ONLINE" ? "classes" : "days"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{source}</p>
    </div>
  );
}

/**
 * Two live classes on one date used to render two identical column headers,
 * with the only differentiator hidden in a `title` tooltip. Time disambiguates
 * them without widening the column much.
 */
function occasionHeading(o: { kind: string; at: string }): string {
  if (o.kind !== "LIVE_CLASS") return o.at.slice(5);
  const d = new Date(o.at);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * "–" is the load-bearing mark in this grid and the one most likely to be read
 * as an accusation. Nothing on screen explained any of the three until now —
 * the meanings lived in tooltips, which are mouse-only.
 */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
      {STATUS_ORDER.map((st) => (
        <span key={st} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="font-bold" style={{ color: STATUS_FG[st] }}>{STATUS_GLYPH[st]}</span>
          {STATUS_LABEL[st]}
        </span>
      ))}
      <span className="text-slate-500">· % is of what was recorded, not of every class</span>
    </div>
  );
}

function Grid({ data, onDrill }: {
  data: NonNullable<ReturnType<typeof useAttendanceRecords>["data"]>;
  onDrill: (studentId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <Legend />
      {/* Wide grids scroll sideways and nothing said so. The inset shadow only
          appears when there is more to reach, so it reads as an edge rather
          than as decoration. */}
      <div className="overflow-x-auto [background:linear-gradient(to_right,white_30%,transparent),linear-gradient(to_left,white_30%,transparent),linear-gradient(to_right,rgba(3,72,82,0.10),transparent_12px),linear-gradient(to_left,rgba(3,72,82,0.10),transparent_12px)] [background-attachment:local,local,scroll,scroll] [background-repeat:no-repeat] [background-size:40px_100%,40px_100%,14px_100%,14px_100%] [background-position:left_center,right_center,left_center,right_center]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th scope="col" className="sticky left-0 bg-white px-4 py-2.5 text-left font-medium">Student</th>
              {data.occasions.map((o) => (
                <th key={o.key} scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap" title={o.label}>
                  {occasionHeading(o)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 font-medium" title="Present as a share of what was recorded — not of every class or day">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((st) => (
              <tr key={st.id} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[var(--dark-teal)] group-hover:bg-slate-50">
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
                    style={{ color: STATUS_FG[c] }}
                  >
                    {/* The glyph is for the eye only. A `title` tooltip is
                        mouse-only and reaches neither a screen reader nor a
                        touch device, and "–" reads as "absent" to anyone who
                        has not been told otherwise. */}
                    <span aria-hidden="true">{STATUS_GLYPH[c]}</span>
                    <span className="sr-only">{`${STATUS_LABEL[c]} on ${data.occasions[i].label}`}</span>
                  </td>
                ))}
                <td
                  className="px-3 py-2.5 text-center font-bold tabular-nums text-[var(--dark-teal)]"
                  title={st.marked === 0 ? "Nothing recorded" : `${st.present} of ${st.marked} recorded`}
                >
                  {st.marked === 0 ? "—" : `${st.pct}%`}
                  {st.marked > 0 && (
                    <span className="block text-[11px] font-normal text-slate-500">
                      of {st.marked}
                    </span>
                  )}
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
                    {s.summary.marked === 0
                      ? "nothing recorded yet"
                      : `${s.summary.present}/${s.summary.marked} (${s.summary.pct}%)`}
                  </p>
                  {/* The summary counts the whole period; the list below does not.
                      Saying so is the difference between a short history and a
                      history that looks like it contradicts its own total. */}
                  {s.truncated && (
                    <p className="mb-2 text-xs text-slate-500">
                      Showing the most recent {s.entries.length}. Older records are in
                      the total above but not listed.
                    </p>
                  )}
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
                          style={chipStyle(e.status)}
                        >
                          {STATUS_LABEL[e.status]}
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
