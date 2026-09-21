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

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: currentUser } = useCurrentUser();
  const pathname = usePathname();
  const isProgramDashboard = pathname === "/dashboard" && currentUser?.role.code === "PROGRAM_MANAGER";
  const isStaffAttendance = pathname === "/dashboard/attendance" && currentUser?.permissions?.includes("attendance.view");
  const isStaffCourses = pathname === "/dashboard/courses" && currentUser?.permissions?.includes("courses.view") && !hasEffectiveSelfScope(currentUser.permissions);
  const isBundlesPage = (pathname === "/dashboard/bundles" && currentUser?.permissions?.includes("bundles.view")) || (pathname === "/dashboard/bundles/new" && currentUser?.permissions?.includes("bundles.create"));
  const isQuizMonitor = pathname === "/dashboard/assessments" && !hasEffectiveSelfScope(currentUser?.permissions ?? []) && currentUser?.permissions?.includes("students.view") && currentUser?.permissions?.some(p => ["analytics.view", "analytics.view_admin", "analytics.view_manager", "analytics.view_fellow"].includes(p));
  const isQuestionBank = pathname === "/dashboard/test-bank" && currentUser?.permissions?.includes("test_bank.view");
  const isCourseManagement = pathname.startsWith("/dashboard/course-management/") && currentUser?.permissions?.includes("courses.edit");
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
          ) : isStaffAttendance || isStaffCourses || isCourseManagement || isBundlesPage || isQuizMonitor || isQuestionBank ? (
            <WorkspaceHeader key={pathname} title={isQuizMonitor ? "Quizzes" : isQuestionBank ? "Question Bank" : isStaffAttendance ? "Attendance" : isCourseManagement ? "Course" : isBundlesPage ? (pathname.endsWith("/new") ? "New bundle" : "Bundles") : "Courses"} onMenuClick={() => setSidebarOpen(true)} sidebarOpen={sidebarOpen} />
          ) : <>
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" aria-controls="dashboard-navigation" aria-expanded={sidebarOpen} className="float-left mr-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--dark-teal)] lg:hidden">
            <Menu size={20} aria-hidden="true" />
          </button>
          {currentUser?.user.id && <div className="relative z-20 float-right ml-3"><NotificationBell /></div>}
          </>}
          <DashboardRouteGuard>{children}</DashboardRouteGuard>
        </main>
      </div>
    </div>
  );
}
