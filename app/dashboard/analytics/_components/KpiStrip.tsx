"use client";

import { InsightsResponse } from "@/lib/api";

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
};

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 600, color: up ? "#08784a" : "#b83232" }}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

function Sparkline({ data }: { data: number[] | null }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <svg width="100%" height="32" viewBox={`0 0 ${data.length * 10} 32`} style={{ marginTop: "10px" }}>
      <polyline
        fill="none"
        stroke="#209379"
        strokeWidth="2"
        points={data.map((v, i) => `${i * 10},${32 - (v / max) * 28}`).join(" ")}
      />
    </svg>
  );
}

export function KpiStrip({ kpis }: { kpis: InsightsResponse["kpis"] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: "20px",
      }}
    >
      <div style={card}>
        <div style={labelStyle}>Students reached</div>
        <div style={{ fontSize: "30px", fontWeight: 700, color: "var(--color-text)", marginTop: "4px" }}>
          {kpis.students_reached.value.toLocaleString()}
          <Delta pct={kpis.students_reached.delta_pct} />
        </div>
        <Sparkline data={kpis.students_reached.sparkline} />
      </div>

      <div style={card}>
        <div style={labelStyle}>Avg programme score</div>
        <div style={{ fontSize: "30px", fontWeight: 700, color: "var(--color-text)", marginTop: "4px" }}>
          {kpis.avg_score.value}%
          <Delta pct={kpis.avg_score.delta_pct} />
        </div>
        <Sparkline data={kpis.avg_score.sparkline} />
      </div>
    </div>
  );
}
