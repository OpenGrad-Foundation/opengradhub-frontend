"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  getSchoolDetail,
  downloadAnalyticsStudentsCsv,
  type SchoolDetail as SchoolDetailType,
} from "@/lib/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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

type Props = {
  callerId: string;
  callerRole: string;
  schoolId: string;
  onBack: () => void;
};

export default function SchoolDetail({ callerId, callerRole, schoolId, onBack }: Props) {
  const [detail, setDetail] = useState<SchoolDetailType | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSchoolDetail(callerId, callerRole, schoolId, selectedCourse || undefined)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [callerId, callerRole, schoolId, selectedCourse]);

  async function handleExportStudents() {
    if (!detail) return;
    setExporting(true);
    try {
      const { blob, filename } = await downloadAnalyticsStudentsCsv({
        caller_role: callerRole,
        caller_id: callerId,
        school_id: schoolId,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — user can retry
    } finally {
      setExporting(false);
    }
  }

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
        }}
      >
        ← Back to schools
      </button>

      {loading || !detail ? (
        <Spinner />
      ) : error ? (
        <div style={{ padding: "24px", color: "#c0392b", fontSize: "14px" }}>Error: {error}</div>
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: "24px" }}>
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
              School Analytics
            </p>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "24px",
                fontWeight: 700,
                color: BRAND.dark,
                margin: "0 0 16px",
              }}
            >
              {detail.school_name}
            </h2>

            {/* Metric cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "14px",
                marginBottom: "24px",
              }}
            >
              <MiniCard label="Enrolled Students" value={detail.enrolled_students} accent={BRAND.green} />
              <MiniCard
                label="Avg Completion"
                value={`${detail.avg_completion}%`}
                accent={BRAND.teal}
              />
              <MiniCard
                label="At-Risk Students"
                value={detail.at_risk_count}
                accent={detail.at_risk_count > 0 ? BRAND.yellow : BRAND.mid}
              />
            </div>

            {/* Course filter + export buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              {detail.courses.length > 0 && (
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(3,72,82,0.2)",
                    background: "rgba(255,255,255,0.8)",
                    color: BRAND.dark,
                    fontSize: "13px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="">All Courses</option>
                  {detail.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={handleExportStudents}
                disabled={exporting}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: exporting ? "rgba(3,72,82,0.15)" : BRAND.green,
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: exporting ? "not-allowed" : "pointer",
                }}
              >
                {exporting ? "Exporting…" : "Student CSV"}
              </button>
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px" }}>
            {/* Bar: avg test score by section */}
            <div style={card}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.26em",
                  color: BRAND.mid,
                  marginBottom: "4px",
                }}
              >
                Avg Score by Section
              </p>
              {detail.section_scores.length === 0 ? (
                <EmptyChart />
              ) : (
                <Bar
                  data={{
                    labels: detail.section_scores.map((s) => s.section),
                    datasets: [
                      {
                        label: "Avg Score (%)",
                        data: detail.section_scores.map((s) => s.avg_score),
                        backgroundColor: BRAND.mid,
                        borderRadius: 6,
                        borderSkipped: false,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: BRAND.dark, font: { size: 11 } },
                      },
                      y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: "rgba(3,72,82,0.06)" },
                        ticks: {
                          color: BRAND.dark,
                          font: { size: 11 },
                          callback: (v) => `${v}%`,
                        },
                      },
                    },
                  }}
                />
              )}
            </div>

            {/* Doughnut: score distribution */}
            <div style={{ ...card, display: "flex", flexDirection: "column" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.26em",
                  color: BRAND.mid,
                  marginBottom: "12px",
                }}
              >
                Score Distribution
              </p>
              {detail.score_distribution.every((d) => d.count === 0) ? (
                <EmptyChart />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Doughnut
                    data={{
                      labels: detail.score_distribution.map((d) => d.label),
                      datasets: [
                        {
                          data: detail.score_distribution.map((d) => d.count),
                          backgroundColor: [BRAND.green, BRAND.yellow, "#f08080"],
                          borderColor: ["#fff", "#fff", "#fff"],
                          borderWidth: 3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { color: BRAND.dark, font: { size: 11 }, padding: 12 },
                        },
                      },
                      cutout: "58%",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: "18px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        padding: "16px 20px",
        borderTop: `3px solid ${accent}`,
      }}
    >
      <p
        style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: "rgba(3,72,82,0.5)",
          marginBottom: "6px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "26px",
          fontWeight: 700,
          color: "#034852",
          fontFamily: "var(--font-heading)",
          margin: 0,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div
      style={{
        padding: "32px 0",
        textAlign: "center",
        color: "rgba(3,72,82,0.4)",
        fontSize: "13px",
      }}
    >
      No data yet
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        minHeight: "200px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading…</p>
    </div>
  );
}
