"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ChevronUp, LogOut, UserRound } from "lucide-react";
import { clearUserCache, useCurrentUser } from "@/hooks/use-current-user";
import { clearStoredAuthToken, isClerkMode } from "@/lib/auth-session";
import { roleLabel } from "@/lib/labels";
import { useRealtime } from "@/lib/realtime/use-realtime";
import { registerServiceWorker } from "@/lib/push/register-sw";
import ReportBugButton from "./ReportBugButton";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardAccountControls({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { data } = useCurrentUser();
  const router = useRouter();
  const clerk = useClerk();

  const userId   = data?.user?.id      ?? "";
  const userName = data?.user?.fullName ?? "";
  const roleName = roleLabel(data?.role?.name);
  // Students have their own profile surface; the staff page 404s them.
  const canOpenStaffProfile = !!data?.role?.name && roleLabel(data.role.name) !== "Student";

  // One SSE stream per authenticated user: pushes notification/announcement
  // change signals → invalidates the relevant React Query caches (replaces 30s
  // polling). Gated on having a user so it never opens pre-auth.
  useRealtime(Boolean(userId));

  // Register the push service worker once authenticated. Idempotent — rolls out
  // an updated /sw.js to existing subscribers. Subscription itself is opt-in,
  // gated behind an explicit click in the bell menu.
  useEffect(() => {
    if (userId) void registerServiceWorker();
  }, [userId]);

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
    <div className="w-full">

        {userName && (
          <div ref={menuRef} className="relative w-full" onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              event.stopPropagation();
              setMenuOpen(false);
              document.getElementById("topbar-profile-btn")?.focus();
            }
          }}>
            <button
              id="topbar-profile-btn"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title={userName}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-[var(--dark-teal)] hover:bg-[var(--color-success-surface)] transition-colors cursor-pointer ${collapsed ? "justify-center" : "p-2"}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--teal)] text-xs font-bold text-white">{initials(userName)}</span>
              {!collapsed && <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{userName}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)]">{roleName}</span>
                </span>
                <ChevronUp size={16} aria-hidden="true" className={`shrink-0 ${menuOpen ? "rotate-180" : ""}`} />
              </>}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className={`absolute ${collapsed ? "left-0" : "right-0"} bottom-full mb-3 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50`}
              >
                <div className="border-b border-gray-100 px-4 py-2.5">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {userName}
                  </p>
                  {roleName && (
                    <p className="truncate text-xs text-gray-500">{roleName}</p>
                  )}
                </div>
                {canOpenStaffProfile && (
                  <Link
                    href="/dashboard/user-management/me"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigate?.(); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <UserRound size={16} aria-hidden="true" />
                    My profile
                  </Link>
                )}
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
                <ReportBugButton />
              </div>
            )}
          </div>
        )}
    </div>
  );
}
