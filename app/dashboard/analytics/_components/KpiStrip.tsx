"use client";

import { InsightsResponse } from "@/lib/api";

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  padding: "20px 24px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "rgba(3,72,82,0.5)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 600, color: up ? "#0abe62" : "#c0392b" }}>
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
  const totalSplit = kpis.ug_pg_split.ug + kpis.ug_pg_split.pg || 1;
  const ugPct = Math.round((kpis.ug_pg_split.ug / totalSplit) * 100);

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
        <div style={{ fontSize: "30px", fontWeight: 700, color: "#034852", marginTop: "4px" }}>
          {kpis.students_reached.value.toLocaleString()}
          <Delta pct={kpis.students_reached.delta_pct} />
        </div>
        <Sparkline data={kpis.students_reached.sparkline} />
      </div>

      <div style={card}>
        <div style={labelStyle}>Districts covered</div>
        <div style={{ fontSize: "30px", fontWeight: 700, color: "#034852", marginTop: "4px" }}>
          {kpis.districts_covered.value}
          <Delta pct={kpis.districts_covered.delta_pct} />
        </div>
        <Sparkline data={kpis.districts_covered.sparkline} />
      </div>

      <div style={card}>
        <div style={labelStyle}>UG vs PG</div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#034852", marginTop: "8px" }}>
          UG {kpis.ug_pg_split.ug.toLocaleString()} · PG {kpis.ug_pg_split.pg.toLocaleString()}
        </div>
        <div style={{ marginTop: "10px", display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", background: "rgba(3,72,82,0.08)" }}>
          <div style={{ width: `${ugPct}%`, background: "#0abe62" }} />
          <div style={{ width: `${100 - ugPct}%`, background: "#ffde00" }} />
        </div>
      </div>

      <div style={card}>
        <div style={labelStyle}>Avg programme score</div>
        <div style={{ fontSize: "30px", fontWeight: 700, color: "#034852", marginTop: "4px" }}>
          {kpis.avg_score.value}%
          <Delta pct={kpis.avg_score.delta_pct} />
        </div>
        <Sparkline data={kpis.avg_score.sparkline} />
      </div>
    </div>
  );
}
