"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LogOut, Menu } from "lucide-react";
import { clearUserCache, useCurrentUser } from "@/hooks/use-current-user";
import { clearStoredAuthToken, isClerkMode } from "@/lib/auth-session";
import NotificationBell from "@/components/NotificationBell";
import ReportBugButton from "./ReportBugButton";

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

export default function DashboardTopbar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const { data } = useCurrentUser();
  const router = useRouter();
  const clerk = useClerk();

  const userId   = data?.user?.id      ?? "";
  const userName = data?.user?.fullName ?? "";
  const roleCode = data?.role?.code    ?? "";
  const roleName = data?.role?.name    ?? "";

  const badgeClass = ROLE_BADGE[roleCode] ?? "bg-[var(--teal)] text-white";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  async function handleSignOut() {
    // Sign out first so any in-flight refetch loses its token and can't
    // re-populate the cache with the previous user's data. Then AWAIT the
    // cache wipe so IDB is empty before the next user's useCurrentUser
    // mounts and the persister tries to restore.
    if (isClerkMode()) {
      await clerk.signOut();
    } else {
      clearStoredAuthToken();
    }
    await clearUserCache();
    router.replace("/");
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-20 shadow-sm">
      {/* Left — hamburger on mobile */}
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden -ml-1 rounded-md p-2 text-gray-500 hover:bg-gray-100"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>
      <div className="hidden lg:block" />

      {/* Right — bug report + role badge + notification bell + avatar */}
      <div className="flex items-center gap-3">
        <ReportBugButton />

        {roleName && (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${badgeClass}`}
          >
            {roleName}
          </span>
        )}

        {userId && <NotificationBell recipientId={userId} />}

        {userName && (
          <div ref={menuRef} className="relative">
            <button
              id="topbar-profile-btn"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title={userName}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--teal)] text-xs font-bold text-white select-none hover:bg-[var(--dark-teal)] transition-colors cursor-pointer"
            >
              {initials(userName)}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30"
              >
                <div className="border-b border-gray-100 px-4 py-2.5">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {userName}
                  </p>
                  {roleName && (
                    <p className="truncate text-xs text-gray-500">{roleName}</p>
                  )}
                </div>
                <button
                  id="topbar-sign-out-btn"
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={16} aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
