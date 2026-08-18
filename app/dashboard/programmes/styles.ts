// Shared inline-style constants for the Programmes pages.
// Mirrors app/dashboard/schools/styles.ts so the two admin surfaces match.
import type React from "react";

export const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
export const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
export const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap" };
export const secondaryButton: React.CSSProperties = { padding: "12px 24px", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "12px", background: "rgba(3,72,82,0.04)", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
export const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };
export const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };
export const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
export const thStyle: React.CSSProperties = { padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" };
export const tdStyle: React.CSSProperties = { padding: "12px 20px", color: "#034852" };
export const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#0abe62", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
export const cardStyle: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "16px", overflow: "hidden" };
export const errorStyle: React.CSSProperties = { padding: "12px 16px", borderRadius: "12px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c", fontSize: "13px" };
export const noticeStyle: React.CSSProperties = { padding: "12px 16px", borderRadius: "12px", background: "rgba(3,72,82,0.05)", border: "1px solid rgba(3,72,82,0.12)", color: "rgba(3,72,82,0.75)", fontSize: "13px", lineHeight: 1.6 };

/** Level pill colours — OWNER reads as the strongest. */
export const levelBadge = (level: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  background:
    level === "OWNER" ? "rgba(10,190,98,0.14)"
    : level === "EDITOR" ? "rgba(3,72,82,0.10)"
    : "rgba(0,0,0,0.05)",
  color:
    level === "OWNER" ? "#067a45"
    : level === "EDITOR" ? "#034852"
    : "rgba(3,72,82,0.6)",
});
