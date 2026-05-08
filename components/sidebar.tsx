"use client";

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
  type LucideIcon,
} from "lucide-react";
import { clearUserCache, useCurrentUser } from "@/hooks/use-current-user";
import { getNavModules } from "@/lib/moduleAccess";
import { clearStoredAuthToken, isClerkMode } from "@/lib/auth-session";

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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const clerk = useClerk();
  const { data } = useCurrentUser();

  const roleCode = data?.role?.code ?? "STUDENT";
  const programmeType = data?.user?.programme ?? null;
  const navModules = getNavModules(roleCode, programmeType);

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
    <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col bg-white border-r border-gray-200 shadow-sm">
      {/* Logo */}
      <div className="px-6 pb-4 pt-6 border-b border-gray-100">
        <Link href="/dashboard" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="OpenGrad"
            width={140}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
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
