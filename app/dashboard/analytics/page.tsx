"use client";

import { useCurrentUser } from "@/hooks/use-current-user";

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "FELLOW",
  "GOVERNMENT",
  "FUNDING_PARTNER",
];

export default function AnalyticsPage() {
  const { data, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading…</p>
      </div>
    );
  }

  const roleCode = data?.role?.code ?? "";

  if (!ALLOWED_ROLES.includes(roleCode)) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "24px",
          padding: "40px 48px",
          textAlign: "center",
          maxWidth: "440px",
        }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62" }}>
            Access Denied
          </p>
          <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
            No access to Analytics
          </p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>
            Your role does not have permission to view this module.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: "24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
        padding: "32px 36px",
        marginBottom: "28px",
      }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", marginBottom: "8px" }}>
          Analytics
        </p>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, color: "#034852", margin: 0 }}>
          Progress &amp; Scores
        </h1>
        <p style={{ marginTop: "6px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>
          Student progress tracking and performance metrics.
        </p>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: "24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
        padding: "48px 36px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62", marginBottom: "12px" }}>
          Coming Soon
        </p>
        <p style={{ fontSize: "18px", fontWeight: 700, color: "#034852" }}>
          Analytics dashboard is under construction
        </p>
        <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)", maxWidth: "480px", margin: "8px auto 0" }}>
          Detailed progress charts, score breakdowns, and engagement metrics will appear here.
        </p>
      </div>
    </div>
  );
}
