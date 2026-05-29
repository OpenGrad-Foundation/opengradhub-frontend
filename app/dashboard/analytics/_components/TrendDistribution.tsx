"use client";

import { InsightsResponse } from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  padding: "24px 28px",
};

const entityLabel: Record<InsightsResponse["distribution"]["entity"], string> = {
  district: "Top districts by enrolment",
  school:   "Schools — lowest avg score first",
  course:   "Courses — lowest avg score first",
};

export function TrendDistribution({
  trend, distribution, onBarClick,
}: {
  trend: InsightsResponse["trend"];
  distribution: InsightsResponse["distribution"];
  onBarClick?: (
    entity: InsightsResponse["distribution"]["entity"],
    row: InsightsResponse["distribution"]["rows"][number],
  ) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "16px", marginBottom: "20px" }}>
      <div style={card}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#209379", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "12px" }}>
          12-month trend
        </p>
        {trend.length === 0 ? (
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>
            Not enough history yet — trend will fill in after first 60 days.
          </p>
        ) : (
          <Line
            data={{
              labels: trend.map((t) => t.month),
              datasets: [
                {
                  label: "New enrolments",
                  data: trend.map((t) => t.new_enrolments),
                  borderColor: "#0abe62",
                  backgroundColor: "rgba(10,190,98,0.1)",
                  yAxisID: "y",
                },
                {
                  label: "Avg score %",
                  data: trend.map((t) => t.avg_score ?? null),
                  borderColor: "#006d6c",
                  backgroundColor: "rgba(0,109,108,0.1)",
                  yAxisID: "y1",
                },
              ],
            }}
            options={{
              responsive: true,
              scales: {
                y:  { type: "linear", position: "left",  beginAtZero: true },
                y1: { type: "linear", position: "right", beginAtZero: true, grid: { drawOnChartArea: false } },
              },
            }}
          />
        )}
      </div>

      <div style={card}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#209379", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "12px" }}>
          {entityLabel[distribution.entity]}
        </p>
        {distribution.rows.length === 0 ? (
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>No data yet.</p>
        ) : (
          <Bar
            data={{
              labels: distribution.rows.map((r) => r.name),
              datasets: [{
                label: "Count",
                data: distribution.rows.map((r) => r.count),
                backgroundColor: "#209379",
                borderRadius: 6,
              }],
            }}
            options={{
              indexAxis: "y",
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { x: { beginAtZero: true } },
              onClick: (_evt, elements) => {
                if (!onBarClick || elements.length === 0) return;
                const idx = elements[0].index;
                const row = distribution.rows[idx];
                if (row) onBarClick(distribution.entity, row);
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
