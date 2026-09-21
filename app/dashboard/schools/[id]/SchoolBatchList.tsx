"use client";

import Link from "next/link";
import type { SchoolRosterDetail } from "@/lib/api";
import { withFrom } from "@/lib/nav";
import { titleStyle } from "../styles";

/**
 * ACTIVE batches hosted at this school, as a flat list.
 *
 * This used to be an accordion that unfolded each batch's roster in place. The
 * batch page already owns that roster (and the enrol/remove controls that go
 * with it), so the school page names the batches and hands off: a whole row is
 * one link, and `withFrom` makes the batch page's BackLink return here.
 */
export function SchoolBatchList({
  batches,
  currentUrl,
  canOpen = true,
  showStudentCounts = true,
}: {
  batches: SchoolRosterDetail["batches"];
  currentUrl: string;
  canOpen?: boolean;
  showStudentCounts?: boolean;
}) {
  if (batches.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text-muted)" }}>
        No batches at this school yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {batches.map((b) => {
        const contents = <>
          <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ ...titleStyle, fontSize: "16px", fontWeight: 600 }}>{b.name}</span>
            {b.programme_type && <span style={chipStyle}>{b.programme_type}</span>}
            {showStudentCounts && <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
              {b.students.length} student{b.students.length === 1 ? "" : "s"}
            </span>}
          </span>
          {canOpen && <span aria-hidden="true" style={{ fontSize: "13px", fontWeight: 600, color: "#08784a" }}>
            View batch →
          </span>}
        </>;
        return canOpen
          ? <Link key={b.id} href={withFrom(`/dashboard/batches/${b.id}`, currentUrl)} style={rowStyle}>{contents}</Link>
          : <div key={b.id} style={rowStyle}>{contents}</div>;
      })}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  padding: "14px 18px",
  borderRadius: "12px",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  textDecoration: "none",
  color: "inherit",
};

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "6px",
  background: "rgba(3,72,82,0.06)",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-text)",
};
