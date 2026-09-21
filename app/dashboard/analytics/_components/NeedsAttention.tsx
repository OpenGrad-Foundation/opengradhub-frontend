"use client";

import { EntityLink } from "../../programmes/_components/entity-link";
import { PERM, STUDENT_PROFILE_PERMISSIONS } from "@/lib/permissions";
import { InsightsResponse } from "@/lib/api";

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const header: React.CSSProperties = {
  fontSize: "16px", fontWeight: 600, color: "var(--color-text)", marginBottom: "12px",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

export function NeedsAttention({
  data,
}: { data: NonNullable<InsightsResponse["needs_attention"]> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "16px" }}>
      <div style={card}>
        <p style={header}>At-risk students</p>
        {data.at_risk_students.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>No at-risk students in scope.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.at_risk_students.map((s) => (
              <li key={s.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                <EntityLink
                  href={`/dashboard/students/${s.id}`} permissions={STUDENT_PROFILE_PERMISSIONS} requiredPermissions={[PERM.students.view]}
                  style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text)", textDecoration: "none" }}
                >
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {s.completion_pct}% · {s.avg_score ?? "—"}% · {timeAgo(s.last_activity_at)}
                  </span>
                </EntityLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={card}>
        <p style={header}>Worst-performing quizzes</p>
        {data.worst_quizzes.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>All quizzes performing above 40%.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.worst_quizzes.map((q) => (
              <li key={q.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                <EntityLink
                  href={`/dashboard/quiz/${q.id}/leaderboard`} permissions={[PERM.assessments.view]} requiredPermissions={[PERM.students.view]}
                  style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text)", textDecoration: "none" }}
                >
                  <span style={{ fontWeight: 600 }}>{q.title}</span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {q.avg_score}% · {q.attempts} attempts
                  </span>
                </EntityLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
