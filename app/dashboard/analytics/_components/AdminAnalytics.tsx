"use client";

import { useAdminAnalytics } from "@/lib/queries/analytics";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const BRAND = {
  dark: "#034852",
  teal: "#006d6c",
  mid: "#209379",
  green: "#0abe62",
  light: "#a6db74",
  yellow: "#ffde00",
  yellowLight: "#ffde59",
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  padding: "24px 28px",
};

type Props = { programmeFilter: string };

export default function AdminAnalytics({ programmeFilter }: Props) {
  const { data: stats, isPending: loading, error: queryError } = useAdminAnalytics();
  const error = queryError ? (queryError as Error).message : null;

  if (loading) return <Spinner />;
  if (error) return <Err msg={error} />;
  if (!stats) return null;

  const filteredDistricts = stats.top_districts;
  const districtLabels = filteredDistricts.map((d) => d.district);
  const districtData = filteredDistricts.map((d) => d.count);

  const progDist =
    programmeFilter === ""
      ? stats.programme_distribution
      : stats.programme_distribution.filter((p) => p.programme === programmeFilter);

  const doughnutLabels = progDist.map((p) => p.programme);
  const doughnutData = progDist.map((p) => p.count);

  return (
    <div>
      {/* Headline stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <StatCard label="Total Active Users" value={stats.total_active_users} accent={BRAND.green} />
        <StatCard label="Active Courses" value={stats.active_courses} accent={BRAND.mid} />
        <StatCard
          label="Avg Completion Rate"
          value={`${stats.avg_completion_rate}%`}
          accent={BRAND.teal}
        />
        <StatCard
          label="Pending Approvals"
          value={stats.pending_approvals}
          accent={BRAND.yellow}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        {/* Bar: top districts */}
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
            Top Districts by Enrolment
          </p>
          {districtLabels.length === 0 ? (
            <EmptyChart />
          ) : (
            <Bar
              data={{
                labels: districtLabels,
                datasets: [
                  {
                    label: "Enrolments",
                    data: districtData,
                    backgroundColor: BRAND.green,
                    borderRadius: 6,
                    borderSkipped: false,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: BRAND.dark, font: { size: 12 } } },
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(3,72,82,0.07)" },
                    ticks: { color: BRAND.dark, font: { size: 12 } },
                  },
                },
              }}
            />
          )}
        </div>

        {/* Doughnut: UG vs PG */}
        <div style={{ ...card, display: "flex", flexDirection: "column" }}>
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
            Student Distribution
          </p>
          {doughnutData.every((v) => v === 0) ? (
            <EmptyChart />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Doughnut
                data={{
                  labels: doughnutLabels,
                  datasets: [
                    {
                      data: doughnutData,
                      backgroundColor: [BRAND.green, BRAND.yellow],
                      borderColor: ["#fff", "#fff"],
                      borderWidth: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: { color: BRAND.dark, font: { size: 12 }, padding: 16 },
                    },
                  },
                  cutout: "62%",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
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
        borderRadius: "20px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        padding: "20px 24px",
        borderTop: `4px solid ${accent}`,
      }}
    >
      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(3,72,82,0.5)", marginBottom: "8px" }}>
        {label}
      </p>
      <p style={{ fontSize: "32px", fontWeight: 700, color: "#034852", fontFamily: "var(--font-heading)", margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "rgba(3,72,82,0.4)", fontSize: "13px" }}>
      No data yet
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading analytics…</p>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "24px", color: "#c0392b", fontSize: "14px" }}>
      Error: {msg}
    </div>
  );
}
