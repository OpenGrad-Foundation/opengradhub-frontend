"use client";

/**
 * Attendance tab — permission-switched:
 *  - attendance.view (staff): Live Classes links | Registers | Overview tabs
 *  - attendance.view_own (students): personal stats view
 */
import { useState } from "react";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { LinksTab } from "./_components/LinksTab";
import { RegistersTab } from "./_components/RegistersTab";
import { OverviewTab } from "./_components/OverviewTab";
import { StudentView } from "./_components/StudentView";

type StaffTab = "links" | "registers" | "overview";

const TABS: { key: StaffTab; label: string }[] = [
  { key: "links", label: "Live Classes" },
  { key: "registers", label: "Registers" },
  { key: "overview", label: "Overview" },
];

export default function AttendancePage() {
  const { has, isLoading } = usePermissions();
  const [tab, setTab] = useState<StaffTab>("links");

  if (isLoading) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }

  const staff = has(PERM.attendance.view);
  const studentOnly = !staff && has(PERM.attendance.view_own);

  if (!staff && !studentOnly) {
    return (
      <div className="p-6">
        <p className="text-slate-600">You don&apos;t have access to Attendance.</p>
      </div>
    );
  }

  if (studentOnly) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">My Attendance</h1>
        <StudentView />
      </div>
    );
  }

  const canManage = has(PERM.attendance.manage);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
      <p className="mt-1 text-sm text-slate-500">
        Per-school live-class links and paper register uploads.
      </p>

      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "links" && <LinksTab canManage={canManage} />}
        {tab === "registers" && <RegistersTab canManage={canManage} />}
        {tab === "overview" && <OverviewTab />}
      </div>
    </div>
  );
}
