"use client";

import { useState } from "react";
import { useProgrammeInsights } from "@/lib/queries/analytics";
import { KpiStrip } from "./KpiStrip";
import { TrendDistribution } from "./TrendDistribution";
import { NeedsAttention } from "./NeedsAttention";
import { ScopeChip } from "./ScopeChip";
import SchoolDetail from "./SchoolDetail";
import ManagerDrill from "./ManagerDrill";

export default function ProgrammeInsights() {
  const [programmeFilter, setProgrammeFilter] = useState<"" | "UG" | "PG">("");
  const [drilledSchoolId, setDrilledSchoolId] = useState<string | null>(null);
  const [drilledCourse, setDrilledCourse] = useState<{ id: string; title: string } | null>(null);
  const { data, isPending, error } = useProgrammeInsights(programmeFilter || undefined);

  if (drilledSchoolId) {
    return (
      <SchoolDetail
        schoolId={drilledSchoolId}
        onBack={() => setDrilledSchoolId(null)}
      />
    );
  }
  if (drilledCourse) {
    return (
      <ManagerDrill
        courseId={drilledCourse.id}
        courseTitle={drilledCourse.title}
        onBack={() => setDrilledCourse(null)}
      />
    );
  }

  if (isPending) return <Spinner />;
  if (error)     return <Err msg={(error as Error).message} />;
  if (!data)     return null;

  const showFilter = data.scope.kind === "global";

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "#ffffff", borderRadius: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          padding: "28px 36px", marginBottom: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "16px", flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#209379", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: "6px" }}>
            Analytics
          </p>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "26px", fontWeight: 700, color: "#034852", margin: 0 }}>
            Programme Insights
          </h1>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <ScopeChip scope={data.scope} />
          {showFilter && (
            <select
              value={programmeFilter}
              onChange={(e) => setProgrammeFilter(e.target.value as "" | "UG" | "PG")}
              style={{ padding: "8px 14px", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.2)", background: "#fff", color: "#034852", fontSize: "13px", fontWeight: 600 }}
            >
              <option value="">All programmes</option>
              <option value="UG">UG</option>
              <option value="PG">PG</option>
            </select>
          )}
        </div>
      </div>

      <KpiStrip kpis={data.kpis} />
      <TrendDistribution
        trend={data.trend}
        distribution={data.distribution}
        onBarClick={(entity, row) => {
          if (entity === "school")  setDrilledSchoolId(row.id);
          if (entity === "course")  setDrilledCourse({ id: row.id, title: row.name });
          // district: no-op for now
        }}
      />
      {data.needs_attention && <NeedsAttention data={data.needs_attention} />}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading insights…</p>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <div style={{ padding: "24px", color: "#c0392b", fontSize: "14px" }}>Error: {msg}</div>;
}
