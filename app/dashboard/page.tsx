"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getNavModules, type ModuleMeta } from "@/lib/moduleAccess";

// ─── Nav icons (inline SVG per module) ───────────────────────────────────────

function NavIcon({ moduleKey }: { moduleKey: string }) {
  const cls = "flex-shrink-0";
  switch (moduleKey) {
    case "dashboard":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case "courses":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "assessments":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "resources":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "doubts":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "announcements":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "analytics":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "student_export":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case "user_management":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "role_management":
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
      );
    default:
      return (
        <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

// ─── Placeholder stat card ────────────────────────────────────────────────────

function StatCard({ label }: { label: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.7)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.4)",
      borderRadius: "24px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
      padding: "28px 24px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      <p style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.28em",
        color: "#209379",
      }}>
        {label}
      </p>
      <div style={{
        height: "40px",
        borderRadius: "10px",
        background: "rgba(3,72,82,0.05)",
      }} />
      <div style={{
        height: "12px",
        width: "60%",
        borderRadius: "6px",
        background: "rgba(3,72,82,0.04)",
      }} />
    </div>
  );
}

// ─── Stat cards config per role ───────────────────────────────────────────────

const ROLE_STAT_CARDS: Record<string, string[]> = {
  SUPER_ADMIN:      ["Total Users", "Active Courses", "Pending Actions"],
  PROGRAM_MANAGER:  ["Active Students", "Courses Running", "Pending Doubts"],
  ZONAL_MANAGER:    ["Schools in Zone", "Students in Zone", "Recent Activity"],
  FELLOW:           ["Students Assigned", "Announcements", "Export Ready"],
  STUDENT:          ["Courses Enrolled", "Resources Available", "Announcements"],
  GOVERNMENT:       ["Programme Stats", "Announcements", "Analytics Overview"],
  FUNDING_PARTNER:  ["Programme Progress", "Announcements", "Analytics"],
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ navModules, roleLabel }: { navModules: ModuleMeta[]; roleLabel: string }) {
  const pathname = usePathname();

  return (
    <aside style={{
      width: "240px",
      minHeight: "100vh",
      background: "#034852",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      alignSelf: "flex-start",
    }}>
      {/* Logo — white card floating inside the dark sidebar */}
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
        }}>
          <Image
            src="/logo.png"
            alt="OpenGrad"
            width={160}
            height={40}
            style={{ objectFit: "contain", height: "40px", width: "auto", maxWidth: "100%" }}
            priority
          />
        </div>
      </div>

      {/* Role badge */}
      <div style={{
        padding: "16px 24px 8px",
      }}>
        <span style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.3em",
          color: "rgba(255,255,255,0.4)",
        }}>
          {roleLabel}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ padding: "8px 12px", flex: 1 }}>
        {navModules.map((mod) => {
          const isActive = pathname === mod.href || (mod.href !== "/dashboard" && pathname.startsWith(mod.href));
          return (
            <Link
              key={mod.key}
              href={mod.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                marginBottom: "2px",
                color: isActive ? "#ffffff" : "rgba(255,255,255,0.65)",
                background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 400,
                transition: "background 150ms ease, color 150ms ease",
              }}
            >
              <NavIcon moduleKey={mod.key} />
              {mod.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom spacer */}
      <div style={{ height: "24px" }} />
    </aside>
  );
}

// ─── Main dashboard page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, error, isLoading } = useCurrentUser();

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
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
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
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

  const navModules = getNavModules(roleCode, programmeType);
  const statCards = ROLE_STAT_CARDS[roleCode] ?? ["Overview", "Activity", "Updates"];

  return (
    // Outermost shell — white bg + gradient overlays matching login.html
    <div style={{
      position: "relative",
      minHeight: "100vh",
      backgroundColor: "#ffffff",
      display: "flex",
      overflow: "hidden",
    }}>
      {/* Gradient overlays (matching branding/login.html) */}
      <div style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(circle at top right, rgba(0,109,108,0.08), transparent 40%), radial-gradient(circle at bottom left, rgba(10,190,98,0.08), transparent 40%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Sidebar */}
      <Sidebar navModules={navModules} roleLabel={roleName} />

      {/* Content area */}
      <main style={{
        flex: 1,
        minHeight: "100vh",
        overflow: "auto",
        padding: "40px 36px",
        position: "relative",
        zIndex: 1,
      }}>
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
              Here&rsquo;s an overview of your OpenGrad workspace.
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

        {/* Stat cards grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "20px",
        }}>
          {statCards.map((label) => (
            <StatCard key={label} label={label} />
          ))}
        </div>
      </main>
    </div>
  );
}
