"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import NotificationBell from "@/components/NotificationBell";

// ── Role badge colour map ────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN:     "bg-[var(--dark-teal)] text-white",
  PROGRAM_MANAGER: "bg-[var(--teal)] text-white",
  ZONAL_MANAGER:   "bg-[var(--light-teal)] text-white",
  FELLOW:          "bg-[var(--green)] text-[var(--dark-teal)]",
  STUDENT:         "bg-[var(--green)] text-[var(--dark-teal)]",
  GOVERNMENT:      "bg-[var(--teal)] text-white",
  FUNDING_PARTNER: "bg-[var(--light-teal)] text-white",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardTopbar() {
  const { data } = useCurrentUser();

  const userId   = data?.user?.id      ?? "";
  const userName = data?.user?.fullName ?? "";
  const roleCode = data?.role?.code    ?? "";
  const roleName = data?.role?.name    ?? "";

  const badgeClass = ROLE_BADGE[roleCode] ?? "bg-[var(--teal)] text-white";

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-20 shadow-sm">
      {/* Left — reserved for future breadcrumbs */}
      <div />

      {/* Right — role badge + notification bell + avatar */}
      <div className="flex items-center gap-3">
        {roleName && (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${badgeClass}`}
          >
            {roleName}
          </span>
        )}

        {userId && <NotificationBell recipientId={userId} />}

        {userName && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--teal)] text-xs font-bold text-white select-none"
            title={userName}
          >
            {initials(userName)}
          </div>
        )}
      </div>
    </header>
  );
}
