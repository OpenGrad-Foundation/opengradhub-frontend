"use client";

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
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "24px",
          padding: "40px 48px",
          textAlign: "center",
          boxShadow: "0 32px 64px rgba(0,0,0,0.1)",
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
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "24px",
          padding: "40px 48px",
          textAlign: "center",
          boxShadow: "0 32px 64px rgba(0,0,0,0.1)",
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
          <a href="/" style={{
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
          </a>
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
      {/* Welcome card */}
      <div style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: "24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
        padding: "32px 36px",
        marginBottom: "28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}>
        <div>
          <p style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.28em",
            color: "#209379",
            marginBottom: "8px",
          }}>
            {roleName}
          </p>
          <h1 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "28px",
            fontWeight: 700,
            color: "#034852",
            margin: 0,
          }}>
            Welcome back, {userName}
          </h1>
          <p style={{
            marginTop: "6px",
            fontSize: "14px",
            color: "rgba(3,72,82,0.6)",
          }}>
            {roleName}
          </p>
        </div>

        {/* Role badge pill */}
        <div style={{
          flexShrink: 0,
          padding: "8px 18px",
          background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
          borderRadius: "100px",
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}>
          {roleName}
        </div>
      </div>

      {/* Next live class hero — students only */}
      {roleCode === "STUDENT" && data.user.id && (
        <NextLiveClassHero studentId={data.user.id} />
      )}

      {widgetsByRole[roleCode] ?? <StudentWidgets programmeType={programmeType} />}
    </div>
  );
}
