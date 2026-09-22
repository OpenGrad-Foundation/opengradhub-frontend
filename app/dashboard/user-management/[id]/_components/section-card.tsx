"use client";

import type { CSSProperties, ReactNode } from "react";

export const BRAND = { dark: "var(--color-text)", teal: "#006d6c", mid: "var(--color-text-muted)", red: "#b83232" };

export const card: CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px,4vw,24px)",
};
export const sectionLabel: CSSProperties = {
  fontSize: "15px", fontWeight: 600, color: "var(--color-text)", margin: "0 0 12px",
};
export const th: CSSProperties = {
  padding: "10px 14px", fontSize: "12px", fontWeight: 500, background: "#eef5f3",
  color: "var(--color-text-muted)", textAlign: "left", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
};
export const td: CSSProperties = {
  padding: "12px 14px", fontSize: "13px", color: BRAND.dark, borderBottom: "1px solid var(--color-border)",
};
export const muted: CSSProperties = { color: "var(--color-text-muted)", fontSize: "13px" };
export const link: CSSProperties = { color: BRAND.teal, textDecoration: "none", fontWeight: 600 };

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
        <p style={sectionLabel}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, padding: "18px 20px" }}>
      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: "26px", fontWeight: 700, color: BRAND.dark, margin: 0 }}>{value}</p>
    </div>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
