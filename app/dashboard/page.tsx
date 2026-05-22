"use client";

import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import NextLiveClassHero from "@/app/dashboard/_components/NextLiveClassHero";
import FellowWidgets from "@/components/widgets/fellow-widgets";
import FundingPartnerWidgets from "@/components/widgets/funding-partner-widgets";
import GovernmentWidgets from "@/components/widgets/government-widgets";
import ProgramManagerWidgets from "@/components/widgets/program-manager-widgets";
import StudentWidgets from "@/components/widgets/student-widgets";
import SuperAdminWidgets from "@/components/widgets/super-admin-widgets";
import ZonalManagerWidgets from "@/components/widgets/zonal-manager-widgets";

// ─── Main dashboard page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, error, isLoading } = useCurrentUser();

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          background: "#ffffff",
          border: "1px solid rgba(3,72,82,0.08)",
          borderRadius: "24px",
          padding: "40px 48px",
          textAlign: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62" }}>
            Loading
          </p>
          <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
            Opening your dashboard
          </p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>
            Fetching your OpenGrad workspace&hellip;
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          background: "#ffffff",
          border: "1px solid rgba(3,72,82,0.08)",
          borderRadius: "24px",
          padding: "40px 48px",
          textAlign: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          maxWidth: "480px",
        }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62" }}>
            Error
          </p>
          <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
            Could not load profile
          </p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>
            {error ?? "Unknown error"}
          </p>
          <Link href="/" style={{
            display: "inline-block",
            marginTop: "24px",
            padding: "12px 24px",
            background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
            color: "#ffffff",
            borderRadius: "12px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 700,
          }}>
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  const roleCode = data.role.code;
  const roleName = data.role.name;
  const userName = data.user.fullName;
  const programmeType = data.user.programme;

  const widgetsByRole: Record<string, React.ReactNode> = {
    SUPER_ADMIN: <SuperAdminWidgets />,
    PROGRAM_MANAGER: <ProgramManagerWidgets />,
    ZONAL_MANAGER: <ZonalManagerWidgets />,
    FELLOW: <FellowWidgets />,
    STUDENT: <StudentWidgets programmeType={programmeType} />,
    GOVERNMENT: <GovernmentWidgets />,
    FUNDING_PARTNER: <FundingPartnerWidgets />,
  };

  return (
    <div>
      {/* Welcome hero */}
      <section className="mb-6 overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#034852] via-[#006d6c] to-[#209379] p-6 text-white shadow-xl shadow-teal-950/10 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-teal-100/80">
              {roleName}
            </p>
            <h1
              className="text-3xl font-bold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Welcome back, {userName} 👋
            </h1>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/90 ring-1 ring-white/20">
            {roleName}
          </div>
        </div>
      </section>

      {/* Next live class hero — students only */}
      {roleCode === "STUDENT" && data.user.id && (
        <NextLiveClassHero studentId={data.user.id} />
      )}

      {widgetsByRole[roleCode] ?? <StudentWidgets programmeType={programmeType} />}
    </div>
  );
}
