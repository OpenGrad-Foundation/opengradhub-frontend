"use client";

import { roleLabel } from "@/lib/labels";

/** Pill for a role code; label goes through lib/labels so FELLOW reads "School In-Charge". */
export function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", background: "rgba(32,147,121,0.12)", color: "#209379" }}>
      {roleLabel(role)}
    </span>
  );
}
