"use client";

import type { CSSProperties, ReactNode } from "react";

export const BRAND = { dark: "#034852", teal: "#006d6c", mid: "#209379", red: "#c53030" };

export const card: CSSProperties = {
  background: "#ffffff", borderRadius: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "24px 28px",
};
export const sectionLabel: CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: BRAND.mid, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "12px",
};
export const th: CSSProperties = {
  padding: "10px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em",
  color: "rgba(3,72,82,0.55)", textAlign: "left", borderBottom: "1px solid rgba(3,72,82,0.08)", whiteSpace: "nowrap",
};
export const td: CSSProperties = {
  padding: "12px 14px", fontSize: "13px", color: BRAND.dark, borderBottom: "1px solid rgba(3,72,82,0.05)",
};
export const muted: CSSProperties = { color: "rgba(3,72,82,0.45)", fontSize: "13px" };
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
      <p style={{ ...sectionLabel, marginBottom: "6px" }}>{label}</p>
      <p style={{ fontSize: "26px", fontWeight: 700, color: BRAND.dark, margin: 0 }}>{value}</p>
    </div>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
