"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { RoleCode } from "@/lib/moduleAccess";

const ALLOWED_ROLES: RoleCode[] = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "FELLOW",
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function StudentExportPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId = data?.user?.id ?? "";

  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAllowed = ALLOWED_ROLES.includes(roleCode);

  if (userLoading) return <LoadingState />;

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <div style={glassCard}>
          <p style={labelStyle}>Access Denied</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>
            You do not have access to this module.
          </p>
        </div>
      </div>
    );
  }

  async function handleDownload() {
    setDownloading(true);
    setStatus("idle");
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({ role: roleCode, caller_id: userId });
      const response = await fetch(
        `${API_BASE_URL}/analytics/students/export?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Export failed (${response.status}).`);
      }

      // Trigger browser file download from blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opengrad_students_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Download failed. Please try again.");
      setStatus("error");
    } finally {
      setDownloading(false);
    }
  }

  const scopeLabel =
    roleCode === "SUPER_ADMIN" || roleCode === "PROGRAM_MANAGER"
      ? "All students across all schools"
      : "Students at your assigned schools only";

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <p style={labelStyle}>Data</p>
        <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 0" }}>
          Student Export
        </h1>
        <p style={{ ...subtitleStyle, marginTop: "6px" }}>
          Download student data for your assigned schools
        </p>
      </div>

      {/* ── Main card ──────────────────────────────────────── */}
      <div style={glassCard}>
        {/* Icon */}
        <div style={{
          width: "56px", height: "56px", borderRadius: "16px",
          background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "24px",
          boxShadow: "0 8px 20px rgba(10,190,98,0.25)",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>

        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 700, color: "#034852", margin: "0 0 8px" }}>
          Export as CSV
        </h2>
        <p style={{ ...subtitleStyle, marginBottom: "8px" }}>
          Columns included: Name, Email, Phone, Role, Programme, School, Status, Created At
        </p>
        <p style={{ fontSize: "12px", fontWeight: 600, color: "#209379", marginBottom: "28px" }}>
          Scope: {scopeLabel}
        </p>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            ...primaryButton,
            opacity: downloading ? 0.7 : 1,
            cursor: downloading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "10px",
          }}
          onMouseEnter={(e) => { if (!downloading) hoverIn(e); }}
          onMouseLeave={(e) => { if (!downloading) hoverOut(e); }}
        >
          {downloading ? (
            <>
              <SpinnerIcon />
              Preparing download&hellip;
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download CSV
            </>
          )}
        </button>

        {/* Status messages */}
        {status === "success" && (
          <div style={successBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Download started — check your downloads folder.
          </div>
        )}
        {status === "error" && errorMsg && (
          <div style={errorBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── Info note ──────────────────────────────────────── */}
      <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.4)", marginTop: "20px", textAlign: "center" }}>
        Export is scoped to your role. Contact your Super Admin if you need broader access.
      </p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
          Student Export
        </p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Please wait&hellip;</p>
      </div>
    </div>
  );
}

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 12px 20px rgba(10,190,98,0.35)";
}

function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 8px 16px rgba(10,190,98,0.2)";
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "24px",
  padding: "36px",
  boxShadow: "0 16px 40px rgba(0,0,0,0.06)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: "#209379",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "22px",
  fontWeight: 700,
  color: "#034852",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
};

const primaryButton: React.CSSProperties = {
  padding: "14px 28px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "15px",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
};

const successBanner: React.CSSProperties = {
  marginTop: "20px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "rgba(10,190,98,0.08)",
  border: "1px solid rgba(10,190,98,0.2)",
  color: "#0a944e",
  fontSize: "13px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const errorBanner: React.CSSProperties = {
  marginTop: "20px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "rgba(229,62,62,0.06)",
  border: "1px solid rgba(229,62,62,0.2)",
  color: "#c53030",
  fontSize: "13px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "8px",
};
