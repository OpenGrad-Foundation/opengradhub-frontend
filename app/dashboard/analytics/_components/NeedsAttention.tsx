"use client";

import Link from "next/link";
import { InsightsResponse } from "@/lib/api";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  padding: "24px 28px",
};

const header: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#209379",
  letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "12px",
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
  const currentUrl = useCurrentUrl();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      <div style={card}>
        <p style={header}>At-risk students</p>
        {data.at_risk_students.length === 0 ? (
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>No at-risk students in scope.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.at_risk_students.map((s) => (
              <li key={s.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(3,72,82,0.06)" }}>
                <Link
                  href={`/dashboard/users/${s.id}` as any}
                  style={{ display: "flex", justifyContent: "space-between", color: "#034852", textDecoration: "none" }}
                >
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.6)" }}>
                    {s.completion_pct}% · {s.avg_score ?? "—"}% · {timeAgo(s.last_activity_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={card}>
        <p style={header}>Worst-performing quizzes</p>
        {data.worst_quizzes.length === 0 ? (
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>All quizzes performing above 40%.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.worst_quizzes.map((q) => (
              <li key={q.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(3,72,82,0.06)" }}>
                <Link
                  href={withFrom(`/dashboard/quiz/${q.id}/leaderboard`, currentUrl) as any}
                  style={{ display: "flex", justifyContent: "space-between", color: "#034852", textDecoration: "none" }}
                >
                  <span style={{ fontWeight: 600 }}>{q.title}</span>
                  <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.6)" }}>
                    {q.avg_score}% · {q.attempts} attempts
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
