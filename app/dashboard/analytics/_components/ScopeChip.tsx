"use client";

import { InsightsScope } from "@/lib/api";

export function ScopeChip({ scope }: { scope: InsightsScope }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "999px",
        background: "rgba(10,190,98,0.1)",
        color: "#034852",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0abe62" }} />
      {scope.label}
    </span>
  );
}
