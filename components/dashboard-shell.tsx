"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "./sidebar";
import DashboardAccountControls from "@/app/dashboard/_components/DashboardAccountControls";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import PMDashboardHeader from "./dashboard/roles/program-manager/Header";
import WorkspaceHeader from "./dashboard/WorkspaceHeader";
import NotificationBell from "./NotificationBell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardRouteGuard } from "@/components/require-permission";
import { hasEffectiveSelfScope } from "@/lib/permissions";
import SentryUserSync from "@/components/sentry-user-sync";
import { PARTNER_TRACKER_NAME, TRACKER_NAME } from "@/lib/labels";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: currentUser } = useCurrentUser();
  const pathname = usePathname();
  const isProgramDashboard = pathname === "/dashboard" && currentUser?.role.code === "PROGRAM_MANAGER";
  const workspaceTitle = currentUser ? workspaceTitleFor(pathname, currentUser.permissions ?? []) : null;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setSidebarOpen(false); };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])
      .filter(element => element.tabIndex !== -1 && element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [sidebarOpen]);

  // Restore desktop collapse preference after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div data-dashboard-shell style={{ "--dashboard-sidebar-width": collapsed ? "68px" : "256px" } as React.CSSProperties} className="flex min-h-screen bg-gray-50">
      <SentryUserSync />
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Fixed to the viewport; the navigation list scrolls independently. */}
      <div
        id="dashboard-navigation"
        ref={sidebarRef}
        role={sidebarOpen ? "dialog" : undefined}
        aria-modal={sidebarOpen || undefined}
        aria-label={sidebarOpen ? "Navigation" : undefined}
        className={
          "fixed inset-y-0 left-0 z-40 h-dvh transition-transform duration-200 lg:z-30 lg:translate-x-0 lg:visible " +
          (sidebarOpen ? "translate-x-0 visible" : "-translate-x-full invisible")
        }
      >
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          footer={<DashboardAccountControls collapsed={collapsed} onNavigate={() => setSidebarOpen(false)} />}
        />
      </div>

      {/* Main content */}
      <div inert={sidebarOpen} className={`flex min-w-0 flex-1 flex-col ${collapsed ? "lg:ml-[68px]" : "lg:ml-64"}`}>
        <main className="flex-1 px-6 py-6 sm:px-8 sm:py-8 bg-gray-50">
          {isProgramDashboard ? (
            <PMDashboardHeader userId={currentUser.user.id} onMenuClick={() => setSidebarOpen(true)} sidebarOpen={sidebarOpen} />
          ) : workspaceTitle ? (
            <WorkspaceHeader key={pathname} title={workspaceTitle} onMenuClick={() => setSidebarOpen(true)} sidebarOpen={sidebarOpen} />
          ) : <div className="pt-[calc(var(--dashboard-header-top)-1.5rem)] sm:pt-[calc(var(--dashboard-header-top)-2rem)]">
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" aria-controls="dashboard-navigation" aria-expanded={sidebarOpen} className="float-left mr-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--dark-teal)] lg:hidden">
            <Menu size={20} aria-hidden="true" />
          </button>
          {currentUser?.user.id && <div className="relative z-20 float-right ml-3"><NotificationBell /></div>}
          </div>}
          <DashboardRouteGuard>{children}</DashboardRouteGuard>
        </main>
      </div>
    </div>
  );
}

const ANALYTICS_VIEW = ["analytics.view", "analytics.view_admin", "analytics.view_manager", "analytics.view_fellow"];

// Pages whose title lives in the shared WorkspaceHeader. Each page omits its
// own <h1>; a route whose learner view keeps its own heading stays gated here.
const WORKSPACE_TITLES: Record<string, string | ((permissions: string[]) => string | null)> = {
  "/dashboard/attendance": p => p.includes("attendance.view") ? "Attendance" : null,
  "/dashboard/courses": p => p.includes("courses.view") && !hasEffectiveSelfScope(p) ? "Courses" : null,
  "/dashboard/bundles": p => p.includes("bundles.view") ? "Bundles" : null,
  "/dashboard/bundles/new": p => p.includes("bundles.create") ? "New bundle" : null,
  "/dashboard/assessments": p => !hasEffectiveSelfScope(p) && p.includes("students.view") && p.some(x => ANALYTICS_VIEW.includes(x)) ? "Quizzes" : null,
  "/dashboard/test-bank": p => p.includes("test_bank.view") ? "Question Bank" : null,
  "/dashboard/analytics": "Programme Insights",
  "/dashboard/assignments": "Assignments",
  "/dashboard/batches": "Batches",
  "/dashboard/calendar": "Calendar",
  "/dashboard/doubts": "Doubts",
  "/dashboard/inbox": "Inbox",
  "/dashboard/live-classes": "Live Classes",
  "/dashboard/password-resets": "Password Resets",
  "/dashboard/programmes": "Programmes",
  "/dashboard/reports": "Reports",
  "/dashboard/resources": "Resources",
  "/dashboard/role-management": "Role Management",
  "/dashboard/schools": "Schools",
  "/dashboard/shared-tracker": PARTNER_TRACKER_NAME,
  "/dashboard/student-export": "Student Export",
  "/dashboard/students": "Students",
  "/dashboard/tracker": TRACKER_NAME,
  "/dashboard/user-management": "User Management",
};

export function workspaceTitleFor(pathname: string, permissions: string[]): string | null {
  if (pathname.startsWith("/dashboard/course-management/")) return permissions.includes("courses.edit") ? "Course" : null;
  if (pathname === "/dashboard/live-classes/new") return "Schedule class";
  if (/^\/dashboard\/live-classes\/[^/]+\/edit$/.test(pathname)) return "Edit class";
  if (pathname === "/dashboard/courses/new") return "New course";
  // Detail pages: the shell names the kind of record; the page shows its name as an h2.
  const detail = pathname.match(/^\/dashboard\/(schools|batches|students|user-management|programmes|bundles)\/(?!new$)[^/]+$/);
  if (detail) return ({ schools: "School", batches: "Batch", students: "Student", "user-management": "Staff profile", programmes: "Programme", bundles: "Bundle" } as const)[detail[1] as "schools"];
  if (pathname === "/dashboard/assignments/new") return "New assignment";
  if (/^\/dashboard\/assignments\/[^/]+\/edit$/.test(pathname)) return "Edit assignment";
  if (/^\/dashboard\/assignments\/[^/]+\/submissions$/.test(pathname)) return "Submissions";
  if (/^\/dashboard\/assignments\/[^/]+$/.test(pathname)) return "Assignment";
  if (pathname === "/dashboard/quiz-builder/new") return "New quiz";
  if (pathname === "/dashboard/quiz-builder/bulk-import") return "Import quiz";
  if (/^\/dashboard\/quiz-builder\/[^/]+$/.test(pathname) && pathname !== "/dashboard/quiz-builder/duplicate") return permissions.includes("test_bank.edit") ? "Quiz" : null;
  const entry = WORKSPACE_TITLES[pathname];
  return typeof entry === "function" ? entry(permissions) : entry ?? null;
}
