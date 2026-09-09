"use client";

import Link from "next/link";
import type { StaffProfile } from "@/lib/api";
import { PERM } from "@/lib/permissions";
import { roleLabel } from "@/lib/labels";
import { EntityLink } from "@/app/dashboard/programmes/_components/entity-link";
import { TASK_STATE_META, taskStateFromLifecycle, type StateTone } from "@/lib/tracker-status";
import { SectionCard, BRAND, th, td, muted, link, formatDate } from "./section-card";

const TONE_COLOR: Record<StateTone, string> = { green: "#0abe62", gray: "rgba(3,72,82,0.55)", amber: "#b7791f", red: BRAND.red };
const viewAll = (href: string) => <Link href={href} style={{ ...link, fontSize: "12px" }}>View all →</Link>;
const profileHref = (id: string) => `/dashboard/user-management/${id}`;

export function OrgSection({ org }: { org: StaffProfile["org"] }) {
  return (
    <SectionCard title="Reporting line">
      <p style={{ fontSize: "13px", color: BRAND.dark, margin: "0 0 12px" }}>
        Reports to:{" "}
        {org.manager ? (
          <Link href={profileHref(org.manager.id)} style={link}>{org.manager.name}</Link>
        ) : org.manager_hidden ? (
          <span style={muted}>manager outside your scope</span>
        ) : (
          <span style={muted}>none</span>
        )}
      </p>
      {org.reports.length === 0 ? <p style={muted}>No direct reports.</p> : (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
          {org.reports.map((r) => (
            <li key={r.id}>
              <Link href={profileHref(r.id)} style={link}>{r.name}</Link>
              <span style={muted}> · {roleLabel(r.role)}</span>
            </li>
          ))}
          {org.reports_total > org.reports.length && <li style={muted}>+{org.reports_total - org.reports.length} more</li>}
        </ul>
      )}
    </SectionCard>
  );
}

/** `viewAllHref` is null when the caller has no tracker surface that can show this person's list. */
export function TasksSection({ tracker, viewAllHref }: { tracker: NonNullable<StaffProfile["tracker"]>; viewAllHref: string | null }) {
  return (
    <SectionCard title="Tracker tasks" action={viewAllHref ? viewAll(viewAllHref) : undefined}>
      {tracker.tasks.length === 0 ? <p style={muted}>No tasks in the current period.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>Task</th><th style={th}>Target</th><th style={th}>Deadline</th><th style={th}>State</th></tr>
            </thead>
            <tbody>
              {tracker.tasks.map((t) => {
                const meta = TASK_STATE_META[taskStateFromLifecycle(t.lifecycle)];
                return (
                  <tr key={t.record_id}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <Link href={`/dashboard/tracker?task=${t.template_id}`} style={{ color: BRAND.dark, textDecoration: "none" }}>{t.name}</Link>
                    </td>
                    <td style={td}>{t.target_name ?? t.school_name ?? "—"}</td>
                    <td style={td}>{formatDate(t.deadline)}</td>
                    <td style={td}><span style={{ fontSize: "11px", fontWeight: 700, color: TONE_COLOR[meta.tone] }}>{meta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function DoubtsSection({ doubts }: { doubts: NonNullable<StaffProfile["doubts"]> }) {
  return (
    <SectionCard title="Doubts" action={viewAll("/dashboard/doubts")}>
      <p style={{ fontSize: "13px", color: BRAND.dark, margin: "0 0 10px" }}>
        {doubts.open_for_responsibility} open under their students · {doubts.answered_by_user} answered by them
      </p>
      {doubts.recent.length === 0 ? <p style={muted}>No recent doubts.</p> : (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
          {doubts.recent.map((d) => (
            <li key={d.id}>
              <Link href={`/dashboard/doubts?focus=${d.id}`} style={link}>{d.subject}</Link>
              <span style={muted}> · {d.student_name ?? "student"} · {d.status.toLowerCase()} · {formatDate(d.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function SchoolsSection({ schools }: { schools: NonNullable<StaffProfile["schools"]> }) {
  return (
    <SectionCard title={`Schools (${schools.total})`}>
      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
        {schools.items.map((s) => (
          <li key={s.id}>
            <EntityLink href={`/dashboard/schools/${s.id}`} permissions={[PERM.schools.view]} style={link}>{s.name}</EntityLink>
            <span style={muted}> · {s.district ?? "—"}{s.student_count != null ? ` · ${s.student_count} students` : ""}</span>
          </li>
        ))}
        {schools.total > schools.items.length && <li style={muted}>+{schools.total - schools.items.length} more</li>}
      </ul>
    </SectionCard>
  );
}

export function AttendanceSection({ attendance }: { attendance: NonNullable<StaffProfile["attendance"]> }) {
  return (
    <SectionCard title="Attendance marked · last 30 days" action={viewAll("/dashboard/attendance")}>
      <p style={{ fontSize: "13px", color: BRAND.dark, margin: 0 }}>
        {attendance.live_classes_marked_30d} live classes · {attendance.registers_uploaded_30d} registers · last {formatDate(attendance.last_marked_at)}
      </p>
    </SectionCard>
  );
}

export function ContentSection({ content }: { content: NonNullable<StaffProfile["content"]> }) {
  const hrefFor = (r: NonNullable<StaffProfile["content"]>["recent"][number]) =>
    r.kind === "course" ? `/dashboard/courses/${r.id}` : r.kind === "quiz" ? `/dashboard/quiz-builder/${r.id}` : `/dashboard/batches/${r.id}`;
  const counts = [
    content.courses != null && `${content.courses} courses`,
    content.quizzes != null && `${content.quizzes} quizzes`,
    content.batches != null && `${content.batches} batches`,
  ].filter(Boolean).join(" · ");
  return (
    <SectionCard title="Content created">
      <p style={{ fontSize: "13px", color: BRAND.dark, margin: "0 0 10px" }}>{counts || "—"}</p>
      {content.recent.length === 0 ? <p style={muted}>Nothing created yet.</p> : (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
          {content.recent.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <Link href={hrefFor(r)} style={link}>{r.title}</Link>
              <span style={muted}> · {r.kind} · {formatDate(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function ActivitySection({ activity }: { activity: StaffProfile["activity"] }) {
  return (
    <SectionCard title="Recent activity">
      {activity.length === 0 ? <p style={muted}>No visible activity.</p> : (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: BRAND.dark }}>
          {activity.map((a, i) => (
            <li key={`${a.kind}-${a.at}-${i}`}>
              <span style={muted}>{new Date(a.at).toLocaleString()}</span>{" — "}
              {a.link ? <Link href={a.link} style={link}>{a.label}</Link> : a.label}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
