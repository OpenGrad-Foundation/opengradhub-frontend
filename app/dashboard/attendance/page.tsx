"use client";

/**
 * Attendance tab — permission-switched:
 *  - attendance.view (staff): Live Classes links | Registers | Overview tabs
 *  - attendance.view_own (students): personal stats view
 */
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { Tabs } from "../_components/Tabs";
import { LinksTab } from "./_components/LinksTab";
import { RegistersTab } from "./_components/RegistersTab";
import { OverviewTab } from "./_components/OverviewTab";
import { StudentView } from "./_components/StudentView";

export default function AttendancePage() {
  const { has, isLoading } = usePermissions();

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
        <h1
          className="text-2xl font-bold text-[var(--dark-teal)] mb-4"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          My Attendance
        </h1>
        <StudentView />
      </div>
    );
  }

  const canManage = has(PERM.attendance.manage);

  return (
    <div className="p-4 sm:p-6">
      <h1
        className="text-2xl font-bold text-[var(--dark-teal)]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Attendance
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Per-school live-class links and paper register uploads.
      </p>

      <div className="mt-4">
        <Tabs
          ariaLabel="Attendance tabs"
          tabs={[
            { key: "links", label: "Live Classes", panel: <LinksTab canManage={canManage} /> },
            { key: "registers", label: "Registers", panel: <RegistersTab canManage={canManage} /> },
            { key: "overview", label: "Overview", panel: <OverviewTab /> },
          ]}
        />
      </div>
    </div>
  );
}
