"use client";

import { InsightsResponse } from "@/lib/api";
import { ZONE_LOWER } from "@/lib/labels";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const entityLabel: Record<InsightsResponse["distribution"]["entity"], string> = {
  district: `Top ${ZONE_LOWER}s by enrolment`,
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "16px", marginBottom: "20px" }}>
      <div style={card}>
        <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", marginBottom: "12px" }}>
          12-month trend
        </p>
        {trend.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
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
        <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", marginBottom: "12px" }}>
          {entityLabel[distribution.entity]}
        </p>
        {distribution.rows.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>No data yet.</p>
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
