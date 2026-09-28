"use client";

import dynamic from "next/dynamic";
import { usePermissions } from "@/hooks/use-permission";
import { ANALYTICS_DASHBOARD_PERMISSIONS } from "@/lib/permissions";

const ProgrammeInsights = dynamic(
  () => import("./_components/ProgrammeInsights"),
  { ssr: false, loading: () => <LoadingPlaceholder /> },
);

export default function AnalyticsPage() {
  const { hasAny, isLoading } = usePermissions();

  if (isLoading) return <LoadingPlaceholder />;
  if (!hasAny(...ANALYTICS_DASHBOARD_PERMISSIONS)) {
    return (
      <div style={{ background: "#ffffff", borderRadius: "24px", padding: "48px 36px", textAlign: "center" }}>
        <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.55)" }}>
          You do not have access to analytics.
        </p>
      </div>
    );
  }

  return <ProgrammeInsights />;
}

function LoadingPlaceholder() {
  return (
    <div style={{ minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading analytics…</p>
    </div>
  );
}
