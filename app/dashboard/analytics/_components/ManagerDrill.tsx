"use client";

import { useManagerAnalytics } from "@/lib/queries/analytics";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BRAND = { dark: "#034852", teal: "#006d6c", mid: "#209379", green: "#0abe62", yellow: "#ffde00" };

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  padding: "24px 28px",
};

const th: React.CSSProperties = {
  padding: "10px 14px", fontSize: "11px", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.22em",
  color: "rgba(3,72,82,0.55)", textAlign: "left",
  borderBottom: "1px solid rgba(3,72,82,0.08)", whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px 14px", fontSize: "13px", color: "#034852",
  borderBottom: "1px solid rgba(3,72,82,0.05)",
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
          background: "none", border: "1px solid rgba(3,72,82,0.2)",
          borderRadius: "10px", padding: "6px 14px", cursor: "pointer",
          fontSize: "13px", color: BRAND.dark, marginBottom: "20px",
          display: "flex", alignItems: "center", gap: "6px",
        }}
      >
        ← Back to insights
      </button>

      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.28em", color: BRAND.mid, marginBottom: "4px" }}>
        Course Detail
      </p>
      <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700,
                   color: BRAND.dark, marginBottom: "24px", marginTop: 0 }}>
        {courseTitle ?? "Course"}
      </h2>

      {isPending ? (
        <div style={{ minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading…</p>
        </div>
      ) : error ? (
        <div style={{ padding: "24px", color: "#c0392b", fontSize: "14px" }}>
          Error: {(error as Error).message}
        </div>
      ) : data && data.view === "students" ? (
        <>
          <div style={{ ...card, marginBottom: "20px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.26em", color: BRAND.mid, marginBottom: "16px" }}>
              Student Progress
            </p>
            {data.students.length === 0 ? (
              <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px", textAlign: "center", padding: "24px 0" }}>
                No enrolled students.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Student</th>
                      <th style={{ ...th, textAlign: "right" }}>Completion</th>
                      <th style={{ ...th, textAlign: "right" }}>Best Score</th>
                      <th style={{ ...th, textAlign: "right" }}>Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.id}>
                        <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                        <td style={{ ...td, textAlign: "right" }}>{s.completion_pct}%</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {s.best_score != null ? `${s.best_score}%` : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: "rgba(3,72,82,0.55)" }}>
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
                  <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                              letterSpacing: "0.22em", color: BRAND.mid, marginBottom: "12px" }}>
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
