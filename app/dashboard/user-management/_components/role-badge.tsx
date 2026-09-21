"use client";

import { roleLabel } from "@/lib/labels";

/** Pill for a role code; label goes through lib/labels so FELLOW reads "School In-Charge". */
export function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, background: "var(--color-success-surface)", color: "#006d6c" }}>
      {roleLabel(role)}
    </span>
  );
}
