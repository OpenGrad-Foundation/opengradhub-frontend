// Shared inline-style constants for the Schools pages (list, form modal, detail).
import type React from "react";

export const labelStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" };
export const titleStyle: React.CSSProperties = { fontSize: "22px", fontWeight: 700, color: "var(--color-text)" };
export const primaryButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--green)", borderRadius: "12px", background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none" };
export const secondaryButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", color: "var(--color-text)", fontWeight: 600, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none" };
export const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "var(--color-text-muted)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px", minWidth: "44px", minHeight: "44px" };
export const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", marginBottom: "6px" };
export const inputStyle: React.CSSProperties = { width: "100%", minHeight: "44px", padding: "8px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "8px", color: "var(--color-text)", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
export const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)", background: "#eef5f3" };
export const tdStyle: React.CSSProperties = { padding: "12px 16px", color: "var(--color-text)" };
export const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#08784a", fontWeight: 600, fontSize: "13px", cursor: "pointer" };
export const cardStyle: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px,4vw,24px)" };
export const backButton: React.CSSProperties = { ...secondaryButton, alignSelf: "flex-start" };
