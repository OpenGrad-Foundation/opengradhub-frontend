"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import DashboardTopbar from "@/app/dashboard/_components/DashboardTopbar";
import { DashboardRouteGuard } from "@/components/require-permission";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
        className={
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:translate-x-0 " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-6 py-6 sm:px-8 sm:py-8 bg-gray-50">
          <DashboardRouteGuard>{children}</DashboardRouteGuard>
        </main>
      </div>
    </div>
  );
}
