"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import dynamic from "next/dynamic";

const AdminAnalytics = dynamic(
  () => import("./_components/AdminAnalytics"),
  { ssr: false, loading: () => <LoadingPlaceholder /> },
);
const ManagerAnalytics = dynamic(
  () => import("./_components/ManagerAnalytics"),
  { ssr: false, loading: () => <LoadingPlaceholder /> },
);
const FellowAnalytics = dynamic(
  () => import("./_components/FellowAnalytics"),
  { ssr: false, loading: () => <LoadingPlaceholder /> },
);

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
  const [programmeFilter, setProgrammeFilter] = useState("");

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading…</p>
      </div>
    );
  }

  const roleCode = data?.role?.code ?? "";
  const userId = data?.user?.id ?? "";

  if (!ALLOWED_ROLES.includes(roleCode)) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "24px",
            padding: "40px 48px",
            textAlign: "center",
            maxWidth: "440px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              color: "#0abe62",
            }}
          >
            Access Denied
          </p>
          <p
            style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}
          >
            No access to Analytics
          </p>
          <p
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "rgba(3,72,82,0.6)",
            }}
          >
            Your role does not have permission to view this module.
          </p>
        </div>
      </div>
    );
  }

  const isSA = roleCode === "SUPER_ADMIN";
  const isPM = roleCode === "PROGRAM_MANAGER";
  const isFellowOrZM = roleCode === "FELLOW" || roleCode === "ZONAL_MANAGER";

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
          padding: "28px 36px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.28em",
              color: "#209379",
              marginBottom: "6px",
            }}
          >
            Analytics
          </p>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "26px",
              fontWeight: 700,
              color: "#034852",
              margin: 0,
            }}
          >
            {isSA
              ? "Analytics Hub"
              : isPM
                ? "Course Performance"
                : "School Dashboard"}
          </h1>
        </div>

        {/* Programme Type filter — SA only */}
        {isSA && (
          <select
            value={programmeFilter}
            onChange={(e) => setProgrammeFilter(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(3,72,82,0.2)",
              background: "rgba(255,255,255,0.85)",
              color: "#034852",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">All Programmes</option>
            <option value="UG">UG</option>
            <option value="PG">PG</option>
          </select>
        )}
      </div>

      {/* Role-based content */}
      {isSA && (
        <AdminAnalytics
          callerId={userId}
          callerRole={roleCode}
          programmeFilter={programmeFilter}
        />
      )}
      {isPM && <ManagerAnalytics callerId={userId} />}
      {isFellowOrZM && <FellowAnalytics callerId={userId} callerRole={roleCode} />}
      {!isSA && !isPM && !isFellowOrZM && (
        <div
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: "24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
            padding: "48px 36px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              color: "rgba(3,72,82,0.55)",
            }}
          >
            Analytics not available for your role.
          </p>
        </div>
      )}
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div
      style={{
        minHeight: "200px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading analytics…</p>
    </div>
  );
}
