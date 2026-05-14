"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  BookOpen,
  Package,
  ClipboardList,
  Database,
  FileText,
  Video,
  Calendar,
  FolderOpen,
  HelpCircle,
  Bell,
  BarChart2,
  Download,
  Users,
  Shield,
  UserPlus,
  LogOut,
  X,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { clearUserCache, useCurrentUser } from "@/hooks/use-current-user";
import { MODULE_META, type ModuleKey } from "@/lib/moduleAccess";
import { clearStoredAuthToken, isClerkMode } from "@/lib/auth-session";

// Nav order = the order MODULE_META is declared in.
const MODULE_ORDER = Object.keys(MODULE_META) as ModuleKey[];

// ── Icon map ────────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard:       LayoutDashboard,
  courses:         BookOpen,
  bundles:         Package,
  assessments:     ClipboardList,
  test_bank:       Database,
  assignments:     FileText,
  live_classes:    Video,
  calendar:        Calendar,
  resources:       FolderOpen,
  doubts:          HelpCircle,
  announcements:   Bell,
  analytics:       BarChart2,
  student_export:  Download,
  user_management: Users,
  role_management: Shield,
  bulk_assign:     UserPlus,
};

// ── Active path helper ───────────────────────────────────────────────────────

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const clerk = useClerk();
  const { data } = useCurrentUser();

  // Nav is driven entirely by the server's effective module list (role defaults
  // + per-user overrides). Show only modules we have presentation metadata for
  // (e.g. `notifications` is a PBAC module but lives in the bell, not the rail),
  // rendered in the canonical MODULE_META order.
  const grantedCodes = new Set(
    (data?.modules ?? []).map((m: { code: string }) => m.code),
  );
  const navModules = MODULE_ORDER.filter((key) => grantedCodes.has(key)).map(
    (key) => ({ key, ...MODULE_META[key] }),
  );

  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const checkScrollLimits = () => {
    const nav = navRef.current;
    if (!nav) return;

    const hasScrollableContent = nav.scrollHeight > nav.clientHeight;

    if (hasScrollableContent) {
      const isAtTop = nav.scrollTop <= 1;
      const isAtBottom = nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 1;

      setCanScrollUp(!isAtTop);
      setCanScrollDown(!isAtBottom);
    } else {
      setCanScrollUp(false);
      setCanScrollDown(false);
    }
  };

  useEffect(() => {
    checkScrollLimits();

    const nav = navRef.current;
    if (!nav) return;

    const resizeObserver = new ResizeObserver(() => {
      checkScrollLimits();
    });
    resizeObserver.observe(nav);

    window.addEventListener("resize", checkScrollLimits);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkScrollLimits);
    };
  }, [navModules]);

  useEffect(() => {
    checkScrollLimits();
  }, [pathname]);

  const scrollUp = () => {
    if (navRef.current) {
      navRef.current.scrollBy({ top: -120, behavior: "smooth" });
    }
  };

  const scrollDown = () => {
    if (navRef.current) {
      navRef.current.scrollBy({ top: 120, behavior: "smooth" });
    }
  };

  async function handleSignOut() {
    clearUserCache();
    if (isClerkMode()) {
      await clerk.signOut();
      router.replace("/");
    } else {
      clearStoredAuthToken();
      router.replace("/");
    }
  }

  return (
    <aside className="flex h-full min-h-dvh w-64 shrink-0 flex-col bg-white border-r border-gray-200 shadow-sm">
      {/* Logo + mobile close */}
      <div className="px-6 pb-4 pt-6 border-b border-gray-100 flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center" onClick={onClose}>
          <Image
            src="/logo.png"
            alt="OpenGrad"
            width={140}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden -mr-1 rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav Container with Scroll Indicators */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Top Scroll Indicator */}
        <div
          className={
            "absolute top-2 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 transform " +
            (canScrollUp
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-2 scale-75 pointer-events-none")
          }
        >
          <button
            type="button"
            onClick={scrollUp}
            className="flex items-center justify-center rounded-full bg-white p-1.5 text-[var(--teal)] shadow-md border border-gray-100 hover:bg-teal-50 hover:text-[var(--dark-teal)] hover:scale-110 active:scale-95 transition-all cursor-pointer animate-bounce"
            style={{ animationDuration: "2s" }}
            aria-label="Scroll up"
          >
            <ChevronUp size={16} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Nav Area */}
        <nav
          ref={navRef}
          onScroll={checkScrollLimits}
          className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar scroll-smooth"
        >
          <ul className="space-y-0.5">
            {navModules.map((module) => {
              const isActive = isActivePath(pathname, module.href);
              const Icon = MODULE_ICONS[module.key];

              return (
                <li key={module.key}>
                  <Link
                    href={module.href}
                    className={
                      "relative flex items-center gap-3 rounded-lg border-l-[3px] px-4 py-2.5 text-sm font-medium transition-colors " +
                      (isActive
                        ? "border-[var(--teal)] bg-teal-50 text-[var(--teal)]"
                        : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-[var(--dark-teal)]")
                    }
                  >
                    {Icon && (
                      <Icon
                        size={18}
                        className={isActive ? "text-[var(--teal)]" : "text-gray-400"}
                        aria-hidden="true"
                      />
                    )}
                    {module.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Scroll Indicator */}
        <div
          className={
            "absolute bottom-2 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 transform " +
            (canScrollDown
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-2 scale-75 pointer-events-none")
          }
        >
          <button
            type="button"
            onClick={scrollDown}
            className="flex items-center justify-center rounded-full bg-white p-1.5 text-[var(--teal)] shadow-md border border-gray-100 hover:bg-teal-50 hover:text-[var(--dark-teal)] hover:scale-110 active:scale-95 transition-all cursor-pointer animate-bounce"
            style={{ animationDuration: "2s" }}
            aria-label="Scroll down"
          >
            <ChevronDown size={16} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Sign out */}
      <div className="px-3 pb-5 pt-3 border-t border-gray-100">
        <button
          id="sidebar-sign-out-btn"
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
