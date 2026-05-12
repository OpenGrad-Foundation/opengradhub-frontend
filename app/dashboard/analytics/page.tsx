"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";

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

export default function AnalyticsPage() {
  const { has, isLoading } = usePermissions();
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

  // Which dashboard variant the caller sees is driven by their analytics
  // permissions (route access itself is gated by `analytics.view` upstream).
  const showAdmin = has(PERM.analytics.view_admin);
  const showManager = !showAdmin && has(PERM.analytics.view_manager);
  const showFellow = !showAdmin && !showManager && has(PERM.analytics.view_fellow);

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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
            {showAdmin
              ? "Analytics Hub"
              : showManager
                ? "Course Performance"
                : "School Dashboard"}
          </h1>
        </div>

        {/* Programme Type filter — admin view only */}
        {showAdmin && (
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

      {/* Permission-driven content */}
      {showAdmin && <AdminAnalytics programmeFilter={programmeFilter} />}
      {showManager && <ManagerAnalytics />}
      {showFellow && <FellowAnalytics />}
      {!showAdmin && !showManager && !showFellow && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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
            No analytics dashboard is configured for your permissions.
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
