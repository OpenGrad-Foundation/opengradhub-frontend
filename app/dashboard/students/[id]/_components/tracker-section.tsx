"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { PeriodHistory } from "@/app/dashboard/tracker/_components/period-history";
import { useStudentDetails, useStudentTrackerTasks } from "@/lib/queries/tracker";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { displayCellValue } from "@/lib/tracker-value";
import { TASK_STATE_META, taskStateFromLifecycle, type StateTone } from "@/lib/tracker-status";
import type { TrackerStudentTask } from "@/lib/tracker-api";

const BRAND = { dark: "#034852", teal: "#006d6c", mid: "#209379", red: "#c53030" };

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  padding: "24px 28px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: BRAND.mid,
  letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "12px",
};

const th: React.CSSProperties = {
  padding: "10px 14px", fontSize: "11px", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.22em",
  color: "rgba(3,72,82,0.55)", textAlign: "left",
  borderBottom: "1px solid rgba(3,72,82,0.08)", whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px 14px", fontSize: "13px", color: BRAND.dark,
  borderBottom: "1px solid rgba(3,72,82,0.05)", verticalAlign: "top",
};

const muted: React.CSSProperties = { color: "rgba(3,72,82,0.45)", fontSize: "13px" };

const TONE: Record<StateTone, { bg: string; fg: string }> = {
  green: { bg: "rgba(32,147,121,0.12)", fg: BRAND.mid },
  gray: { bg: "rgba(3,72,82,0.08)", fg: "rgba(3,72,82,0.65)" },
  amber: { bg: "rgba(214,158,46,0.14)", fg: "#8a6116" },
  red: { bg: "rgba(197,48,48,0.10)", fg: BRAND.red },
};

/**
 * A deadline is a plain calendar date, a timestamp is an instant — and they must not
 * be parsed the same way. `new Date("2026-09-01")` is UTC midnight, which renders as
 * the previous day for any viewer west of UTC, so a date-only value is split into
 * local year/month/day instead.
 */
function formatDate(value: string | null): string {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * FellowTracker, as seen from a student's profile.
 *
 * The tracker's own pages are organised by who does the work; this is the same data
 * cut the other way — what has been recorded about this one student, and how far each
 * task about them has got.
 *
 * Read-only by design: filling stays in the tracker grid, where the proof, blocker and
 * geo-verification rules live. Both cards vanish rather than error when the viewer has
 * no `tracker.view` (which includes students looking at their own profile), so staff
 * outside the tracker see a profile page unchanged from before.
 */
export function TrackerSection({ studentId }: { studentId: string }) {
  return (
    <>
      <TrackerDetailsCard studentId={studentId} />
      <TrackerTasksCard studentId={studentId} />
    </>
  );
}

function TrackerDetailsCard({ studentId }: { studentId: string }) {
  const { data, error } = useStudentDetails(studentId);
  if (error || !data) return null;

  // The endpoint returns every active field so the fill form can render empty inputs.
  // A profile only wants what was actually filled — and `updated_at` is the one signal
  // that survives falsy values, which are real answers ("No", 0), not blanks.
  const filled = data.details.filter((d) => d.updated_at !== null);
  if (filled.length === 0) return null;

  return (
    <div style={card}>
      <p style={sectionLabel}>Student details from the tracker</p>
      <dl style={{
        display: "grid", gap: "12px 24px", margin: 0,
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
      }}>
        {filled.map((d) => (
          <div key={d.field.id}>
            <dt style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em",
                         textTransform: "uppercase", color: "rgba(3,72,82,0.5)" }}>
              {d.field.label}
            </dt>
            <dd style={{ margin: "4px 0 0", fontSize: "14px", color: BRAND.dark, fontWeight: 600 }}>
              {displayCellValue(d.value)}
            </dd>
            <dd style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.4)" }}>
              Updated {formatDate(d.updated_at)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TrackerTasksCard({ studentId }: { studentId: string }) {
  const { data, error } = useStudentTrackerTasks(studentId);
  // Captured here rather than in each row so every task link carries the same origin.
  const currentUrl = useCurrentUrl();
  if (error || !data) return null;

  return (
    <div style={card}>
      <p style={sectionLabel}>Tracker tasks</p>
      {data.tasks.length === 0 ? (
        <p style={muted}>No tracker tasks are assigned for this student.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Task</th>
                <th style={th}>Status</th>
                <th style={th}>Deadline</th>
                <th style={th}>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t) => (
                <TaskRow key={t.record_id} task={t} studentId={studentId} currentUrl={currentUrl} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, studentId, currentUrl }: {
  task: TrackerStudentTask; studentId: string; currentUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = TASK_STATE_META[taskStateFromLifecycle(task.lifecycle)];
  const tone = TONE[meta.tone];
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <>
      <tr onClick={() => setOpen((v) => !v)} style={{ cursor: "pointer" }}>
        <td style={{ ...td, fontWeight: 600 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            {/* The row is the expand target, so the name sits inside a real button:
                clicking anywhere reveals the detail, and keyboard users get the same
                control with proper aria-expanded rather than an inert row handler.
                stopPropagation keeps the row's own handler from toggling it back. */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
              aria-expanded={open}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px",
                       background: "none", border: "none", padding: 0, cursor: "pointer",
                       font: "inherit", color: BRAND.dark, textAlign: "left" }}
            >
              <Chevron size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
              {task.template_name}
            </button>
            {/* The only thing on the row that navigates. */}
            <Link
              href={withFrom(`/dashboard/tracker?task=${encodeURIComponent(task.template_id)}`, currentUrl)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open ${task.template_name} in the tracker`}
              title="Open this task in the tracker"
              style={{ display: "inline-flex", alignItems: "center", color: BRAND.teal }}
            >
              <ExternalLink size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
            </Link>
          </span>
          {task.batch_name && (
            <span style={{ ...muted, display: "block", marginTop: "2px" }}>
              via {task.batch_name}
            </span>
          )}
        </td>
        <td style={td}>
          <span style={{ background: tone.bg, color: tone.fg, fontSize: "11px", fontWeight: 700,
                         letterSpacing: "0.1em", textTransform: "uppercase",
                         padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>
            {meta.label}
          </span>
          <WorkflowStep task={task} />
        </td>
        <td style={td}>{task.deadline ? formatDate(task.deadline) : "—"}</td>
        <td style={{ ...td, color: "rgba(3,72,82,0.55)" }}>
          {/* Null while the row is untouched — the server refuses to attribute a
              spawned recurring row to whoever filled the previous period. */}
          {task.updated_at ? formatDate(task.updated_at) : "Not started"}
          {task.updated_by_name && (
            <span style={{ ...muted, display: "block" }}>by {task.updated_by_name}</span>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td style={{ ...td, background: "rgba(3,72,82,0.02)" }} colSpan={4}>
            <TaskDetail task={task} studentId={studentId} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * A workflow task's own step name. The four-state badge deliberately merges every
 * mid-flight step into "Pending", which is the right rollup for a task list but
 * loses the progress a profile is asking about — so the step is shown next to it.
 */
function WorkflowStep({ task }: { task: TrackerStudentTask }) {
  if (task.completion_style !== "workflow" || !task.workflow_statuses?.length) return null;
  const index = task.workflow_statuses.indexOf(task.status);
  if (index < 0) return null;
  return (
    <span style={{ ...muted, display: "block", marginTop: "4px" }}>
      {task.status} · step {index + 1} of {task.workflow_statuses.length}
    </span>
  );
}

function TaskDetail({ task, studentId }: { task: TrackerStudentTask; studentId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {task.description && <p style={{ ...muted, margin: 0 }}>{task.description}</p>}

      {task.blocker && (
        <p style={{ margin: 0, fontSize: "13px", color: BRAND.red }}>
          <strong>Blocked:</strong> {task.blocker.text}{" "}
          <span style={muted}>(raised {formatDate(task.blocker.raised_at)})</span>
        </p>
      )}

      {task.cells.length === 0 ? (
        <p style={{ ...muted, margin: 0 }}>This task has no fields to fill in.</p>
      ) : (
        <dl style={{
          display: "grid", gap: "8px 24px", margin: 0,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
        }}>
          {task.cells.map((c) => (
            <div key={c.field_key}>
              <dt style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em",
                           textTransform: "uppercase", color: "rgba(3,72,82,0.5)" }}>
                {c.label}
              </dt>
              <dd style={{ margin: "2px 0 0", fontSize: "13px", color: BRAND.dark }}>
                {displayCellValue(c.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <PeriodHistory
        recordId={task.record_id}
        recurring={task.recurrence_frequency !== null}
        studentId={studentId}
      />
    </div>
  );
}
