"use client";

import { EntityLink } from "../../programmes/_components/entity-link";
import { PERM, STUDENT_PROFILE_PERMISSIONS } from "@/lib/permissions";
import { useManagerAnalytics } from "@/lib/queries/analytics";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ArrowLeft } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BRAND = { dark: "#034852", teal: "#006d6c", mid: "#209379", green: "#0abe62", yellow: "#ffde00" };

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const th: React.CSSProperties = {
  padding: "10px 14px", fontSize: "12px", fontWeight: 500,
  background: "#eef5f3",
  color: "var(--color-text-muted)", textAlign: "left",
  borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px 14px", fontSize: "13px", color: "var(--color-text)",
  borderBottom: "1px solid var(--color-border)",
};

export default function ManagerDrill({
  courseId, courseTitle, onBack,
}: { courseId: string; courseTitle?: string; onBack: () => void }) {
  const { data, isPending, error } = useManagerAnalytics(courseId);

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "12px", padding: "0 16px", minHeight: "44px", cursor: "pointer",
          fontSize: "14px", fontWeight: 500, color: "var(--color-text)", marginBottom: "20px",
          display: "flex", alignItems: "center", gap: "6px",
        }}
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to insights
      </button>

      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", marginBottom: "4px" }}>
        Course detail
      </p>
      <h2 style={{ fontSize: "22px", fontWeight: 700,
                   color: "var(--color-text)", marginBottom: "24px", marginTop: 0 }}>
        {courseTitle ?? "Course"}
      </h2>

      {isPending ? (
        <div style={{ minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Loading…</p>
        </div>
      ) : error ? (
        <div style={{ padding: "24px", color: "#b83232", fontSize: "14px" }}>
          Error: {(error as Error).message}
        </div>
      ) : data && data.view === "students" ? (
        <>
          <div style={{ ...card, marginBottom: "20px" }}>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", marginBottom: "16px" }}>
              Student progress
            </p>
            {data.students.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "14px", textAlign: "center", padding: "24px 0" }}>
                No enrolled students.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Student</th>
                      <th style={{ ...th, textAlign: "right" }}>Completion</th>
                      <th style={{ ...th, textAlign: "right" }}>Best score</th>
                      <th style={{ ...th, textAlign: "right" }}>Avg score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.id}>
                        <td style={{ ...td, fontWeight: 600 }}>
                          <EntityLink
                            href={`/dashboard/students/${s.id}`} permissions={STUDENT_PROFILE_PERMISSIONS} requiredPermissions={[PERM.students.view]}
                            style={{ color: "var(--color-text)", textDecoration: "none" }}
                          >
                            {s.name}
                          </EntityLink>
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>{s.completion_pct}%</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {s.best_score != null ? `${s.best_score}%` : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: "var(--color-text-muted)" }}>
                          {s.avg_score != null ? `${s.avg_score}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data.quiz_distribution.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {data.quiz_distribution.map((q) => (
                <div key={q.id} style={card}>
                  <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)", marginBottom: "12px" }}>
                    {q.title}
                  </p>
                  <Bar
                    data={{
                      labels: q.buckets.map((b) => b.label),
                      datasets: [{
                        label: "Students", data: q.buckets.map((b) => b.count),
                        backgroundColor: BRAND.teal, borderRadius: 5,
                      }],
                    }}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: BRAND.dark, font: { size: 11 } } },
                        y: { beginAtZero: true, ticks: { stepSize: 1, color: BRAND.dark, font: { size: 11 } },
                             grid: { color: "rgba(3,72,82,0.06)" } },
                      },
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
