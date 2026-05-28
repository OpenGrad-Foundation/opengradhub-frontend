"use client";

import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  type ManagerCourseRow,
  type ManagerStudentRow,
  type QuizDistributionRow,
} from "@/lib/api";
import { useManagerAnalytics } from "@/lib/queries/analytics";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BRAND = {
  dark: "#034852",
  teal: "#006d6c",
  mid: "#209379",
  green: "#0abe62",
  light: "#a6db74",
  yellow: "#ffde00",
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  padding: "24px 28px",
};

const th: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.22em",
  color: "rgba(3,72,82,0.55)",
  textAlign: "left",
  borderBottom: "1px solid rgba(3,72,82,0.08)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: "13px",
  color: "#034852",
  borderBottom: "1px solid rgba(3,72,82,0.05)",
};

export default function ManagerAnalytics() {
  const [selectedCourse, setSelectedCourse] = useState<ManagerCourseRow | null>(null);

  const coursesQuery = useManagerAnalytics();
  const drillQuery = useManagerAnalytics(selectedCourse?.id);

  const courses: ManagerCourseRow[] =
    coursesQuery.data?.view === "courses" ? coursesQuery.data.courses : [];
  const students: ManagerStudentRow[] =
    drillQuery.data?.view === "students" ? drillQuery.data.students : [];
  const quizDist: QuizDistributionRow[] =
    drillQuery.data?.view === "students" ? drillQuery.data.quiz_distribution : [];

  const loading = coursesQuery.isPending;
  const drillLoading = !!selectedCourse && drillQuery.isPending;
  const queryError = coursesQuery.error ?? drillQuery.error;
  const error = queryError ? (queryError as Error).message : null;

  function handleCourseClick(course: ManagerCourseRow) {
    setSelectedCourse(course);
  }

  if (loading) return <Spinner />;
  if (error) return <Err msg={error} />;

  if (selectedCourse) {
    return (
      <DrillDown
        course={selectedCourse}
        students={students}
        quizDist={quizDist}
        loading={drillLoading}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  return (
    <div style={card}>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.26em",
          color: BRAND.mid,
          marginBottom: "16px",
        }}
      >
        My Courses
      </p>
      {courses.length === 0 ? (
        <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px", padding: "32px 0", textAlign: "center" }}>
          No courses found.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Course</th>
                <th style={{ ...th, textAlign: "right" }}>Enrolments</th>
                <th style={{ ...th, textAlign: "right" }}>Avg Completion</th>
                <th style={{ ...th, textAlign: "right" }}>Avg Quiz Score</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => handleCourseClick(c)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background =
                      "rgba(10,190,98,0.05)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                  }
                >
                  <td style={td}>
                    <span style={{ fontWeight: 600, color: BRAND.dark }}>{c.title}</span>
                    <span
                      style={{
                        marginLeft: "8px",
                        fontSize: "11px",
                        color: "rgba(3,72,82,0.5)",
                        fontWeight: 500,
                      }}
                    >
                      {c.programme_type}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{c.enrolment_count}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <CompletionBar pct={c.avg_completion} />
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {c.avg_quiz_score > 0 ? `${c.avg_quiz_score}%` : "—"}
                  </td>
                  <td style={td}>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DrillDown({
  course,
  students,
  quizDist,
  loading,
  onBack,
}: {
  course: ManagerCourseRow;
  students: ManagerStudentRow[];
  quizDist: QuizDistributionRow[];
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "1px solid rgba(3,72,82,0.2)",
          borderRadius: "10px",
          padding: "6px 14px",
          cursor: "pointer",
          fontSize: "13px",
          color: BRAND.dark,
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ← Back to courses
      </button>

      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.28em",
          color: BRAND.mid,
          marginBottom: "4px",
        }}
      >
        Course Detail
      </p>
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "22px",
          fontWeight: 700,
          color: BRAND.dark,
          marginBottom: "24px",
          marginTop: 0,
        }}
      >
        {course.title}
      </h2>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Student table */}
          <div style={{ ...card, marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.26em",
                color: BRAND.mid,
                marginBottom: "16px",
              }}
            >
              Student Progress
            </p>
            {students.length === 0 ? (
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
                      <th style={th}>Assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <CompletionBar pct={s.completion_pct} />
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {s.best_score != null ? `${s.best_score}%` : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: "rgba(3,72,82,0.55)" }}>
                          {s.avg_score != null ? `${s.avg_score}%` : "—"}
                        </td>
                        <td style={td}>
                          <AssignBadge status={s.assignment_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quiz histograms */}
          {quizDist.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {quizDist.map((q) => (
                <div key={q.id} style={card}>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: BRAND.mid,
                      marginBottom: "12px",
                    }}
                  >
                    {q.title}
                  </p>
                  <Bar
                    data={{
                      labels: q.buckets.map((b) => b.label),
                      datasets: [
                        {
                          label: "Students",
                          data: q.buckets.map((b) => b.count),
                          backgroundColor: BRAND.teal,
                          borderRadius: 5,
                          borderSkipped: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: BRAND.dark, font: { size: 11 } } },
                        y: {
                          beginAtZero: true,
                          ticks: { stepSize: 1, color: BRAND.dark, font: { size: 11 } },
                          grid: { color: "rgba(3,72,82,0.06)" },
                        },
                      },
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CompletionBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? BRAND.green : pct >= 50 ? BRAND.mid : BRAND.yellow;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
      <div
        style={{
          width: "72px",
          height: "6px",
          background: "rgba(3,72,82,0.1)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: "3px" }}
        />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color: BRAND.dark, minWidth: "36px", textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: "rgba(10,190,98,0.12)", color: "#0abe62" },
    DRAFT: { bg: "rgba(255,222,0,0.2)", color: "#a08600" },
    ARCHIVED: { bg: "rgba(3,72,82,0.08)", color: "rgba(3,72,82,0.5)" },
  };
  const s = map[status] ?? { bg: "rgba(3,72,82,0.08)", color: "rgba(3,72,82,0.5)" };
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: "20px",
        background: s.bg,
        color: s.color,
        letterSpacing: "0.04em",
      }}
    >
      {status}
    </span>
  );
}

function AssignBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    SUBMITTED: { bg: "rgba(10,190,98,0.12)", color: "#0abe62", label: "Submitted" },
    GRADED: { bg: "rgba(32,147,121,0.12)", color: "#209379", label: "Graded" },
    NOT_STARTED: { bg: "rgba(3,72,82,0.07)", color: "rgba(3,72,82,0.5)", label: "Not Started" },
  };
  const s = map[status] ?? { bg: "rgba(3,72,82,0.07)", color: "rgba(3,72,82,0.5)", label: status };
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: "20px",
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading…</p>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "24px", color: "#c0392b", fontSize: "14px" }}>Error: {msg}</div>
  );
}
