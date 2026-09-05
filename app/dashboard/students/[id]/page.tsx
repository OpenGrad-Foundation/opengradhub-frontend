"use client";

import { useParams } from "next/navigation";
import { EntityLink } from "../../programmes/_components/entity-link";
import { usePermissions } from "@/hooks/use-permission";
import { PERM, STUDENT_PROFILE_PERMISSIONS } from "@/lib/permissions";
import { BackLink } from "@/components/back-link";
import { PerformanceHistoryTable } from "@/components/performance-history-table";
import { TrackerSection } from "./_components/tracker-section";
import { useStudentProfile } from "@/lib/queries/students";
import { useTopicStrength } from "@/lib/queries/analytics";
import { useReportHistory } from "@/lib/queries/reports";
import type { StudentProfile } from "@/lib/api";

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
  borderBottom: "1px solid rgba(3,72,82,0.05)",
};

const backLinkStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 700, color: "#0abe62", textDecoration: "none",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { has, hasAny } = usePermissions();
  const { data, isPending, error } = useStudentProfile(id);
  // Both degrade silently — the profile itself is the page, these are extras.
  const { data: history } = useReportHistory(id, hasAny(...STUDENT_PROFILE_PERMISSIONS));
  const { data: topics } = useTopicStrength(id);

  if (error) {
    return (
      <div>
        <BackLink fallback="/dashboard/analytics" style={backLinkStyle} />
        <p style={{ color: BRAND.red, fontWeight: 600, marginTop: "16px" }}>
          {error instanceof Error ? error.message : "Failed to load student profile."}
        </p>
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div>
        <BackLink fallback="/dashboard/analytics" style={backLinkStyle} />
        <p style={{ color: "rgba(3,72,82,0.6)", marginTop: "16px" }}>Loading student…</p>
      </div>
    );
  }

  const { student, kpis, courses } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <BackLink fallback="/dashboard/analytics" style={backLinkStyle} />

      <Header student={student} atRisk={kpis.at_risk} />

      <div style={{ display: "grid", gap: "16px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
        <Kpi label="Completion" value={`${kpis.completion_pct}%`} />
        <Kpi label="Average score" value={kpis.avg_score == null ? "—" : `${kpis.avg_score}%`} />
        <Kpi label="Quiz attempts" value={String(kpis.attempts)} />
        <Kpi label="Last activity" value={formatDate(kpis.last_activity_at)} />
      </div>

      <div style={card}>
        <p style={sectionLabel}>Enrolled courses</p>
        {courses.length === 0 ? (
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>No course enrolments.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Course</th>
                  <th style={{ ...th, textAlign: "right" }}>Lessons</th>
                  <th style={{ ...th, textAlign: "right" }}>Completion</th>
                  <th style={{ ...th, textAlign: "right" }}>Avg score</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <EntityLink
                        href={`/dashboard/courses/${c.id}`} permissions={[PERM.courses.view]}
                        style={{ color: BRAND.dark, textDecoration: "none" }}
                      >
                        {c.title}
                      </EntityLink>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{c.lessons_done} / {c.lessons_total}</td>
                    <td style={{ ...td, textAlign: "right" }}>{c.completion_pct}%</td>
                    <td style={{ ...td, textAlign: "right", color: "rgba(3,72,82,0.55)" }}>
                      {c.avg_score == null ? "—" : `${c.avg_score}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {has(PERM.tracker.view) && <TrackerSection studentId={id} />}

      {topics && topics.length > 0 && (
        <div style={card}>
          <p style={sectionLabel}>Topic strength</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Subject</th>
                  <th style={th}>Topic</th>
                  <th style={{ ...th, textAlign: "right" }}>Correct</th>
                  <th style={{ ...th, textAlign: "right" }}>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t, i) => (
                  <tr key={`${t.subject}-${t.topic ?? i}`}>
                    <td style={td}>{t.subject}</td>
                    <td style={td}>{t.topic ?? "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{t.correct} / {t.total}</td>
                    <td style={{ ...td, textAlign: "right" }}>{t.accuracy_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={card}>
        <p style={sectionLabel}>Quiz history</p>
        {history && history.rows.length > 0 ? (
          <PerformanceHistoryTable rows={history.rows} />
        ) : (
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>No completed attempts yet.</p>
        )}
      </div>
    </div>
  );
}

function Header({
  student, atRisk,
}: { student: StudentProfile["student"]; atRisk: boolean }) {
  const meta = [
    student.programme,
    student.roll_number ? `Roll ${student.roll_number}` : null,
    student.district,
    student.status === "ACTIVE" ? null : student.status,
  ].filter(Boolean) as string[];

  return (
    <div style={card}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 700,
                     color: BRAND.dark, margin: 0 }}>
          {student.name}
        </h1>
        {atRisk && (
          <span style={{ background: "rgba(197,48,48,0.1)", color: BRAND.red, fontSize: "11px",
                         fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
                         padding: "4px 10px", borderRadius: "999px" }}>
            At risk
          </span>
        )}
      </div>

      <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "8px 0 0" }}>
        {student.school_id ? (
          <EntityLink
            href={`/dashboard/schools/${student.school_id}`} permissions={[PERM.schools.view]}
            style={{ color: BRAND.teal, textDecoration: "none", fontWeight: 600 }}
          >
            {student.school_name ?? "School"}
          </EntityLink>
        ) : (
          <span>{student.school_name ?? "No school"}</span>
        )}
        {meta.length > 0 && <span> · {meta.join(" · ")}</span>}
        {student.email && <span> · {student.email}</span>}
      </p>

      {student.batches.length > 0 && (
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "6px 0 0" }}>
          Batches:{" "}
          {student.batches.map((b, i) => (
            <span key={b.id}>
              {i > 0 && ", "}
              <EntityLink
                href={`/dashboard/batches/${b.id}`} permissions={[PERM.batches.view]}
                style={{ color: BRAND.teal, textDecoration: "none" }}
              >
                {b.name}
              </EntityLink>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <p style={sectionLabel}>{label}</p>
      <p style={{ fontFamily: "var(--font-heading)", fontSize: "26px", fontWeight: 700,
                  color: BRAND.dark, margin: 0 }}>
        {value}
      </p>
    </div>
  );
}
