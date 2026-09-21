"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "./sidebar";
import DashboardTopbar from "@/app/dashboard/_components/DashboardTopbar";
import { DashboardRouteGuard } from "@/components/require-permission";
import SentryUserSync from "@/components/sentry-user-sync";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <div className="flex min-h-screen bg-gray-50">
      <SentryUserSync />
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar wrapper — drawer on mobile, sticky on desktop */}
      <div
        ref={sidebarRef}
        role={sidebarOpen ? "dialog" : undefined}
        aria-modal={sidebarOpen || undefined}
        aria-label={sidebarOpen ? "Navigation" : undefined}
        className={
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:translate-x-0 lg:visible " +
          (sidebarOpen ? "translate-x-0 visible" : "-translate-x-full invisible")
        }
      >
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>

      {/* Main content */}
      <div inert={sidebarOpen} className="flex flex-1 flex-col min-w-0">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-6 py-6 sm:px-8 sm:py-8 bg-gray-50">
          <DashboardRouteGuard>{children}</DashboardRouteGuard>
        </main>
      </div>
    </div>
  );
}
