"use client";

/**
 * Attendance — permission-switched.
 *
 *  staff   (attendance.view)     Records | School confirmations | Registers
 *  student (attendance.view_own) their own attendance
 *
 * "Records" is first and default because it is the answer to the question the
 * module exists for: was this student present? The other two tabs are the ways
 * data gets IN — a whole-school confirmation, and a paper register.
 */
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { Tabs } from "../_components/Tabs";
import { RecordsTab } from "./_components/RecordsTab";
import { SchoolConfirmationsTab } from "./_components/SchoolConfirmationsTab";
import { RegistersTab } from "./_components/RegistersTab";
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
        Student attendance, whole-school confirmations, and paper registers.
      </p>

      <div className="mt-4">
        <Tabs
          ariaLabel="Attendance tabs"
          tabs={[
            { key: "records", label: "Records", panel: <RecordsTab /> },
            { key: "confirmations", label: "School confirmations", panel: <SchoolConfirmationsTab canManage={canManage} /> },
            { key: "registers", label: "Registers", panel: <RegistersTab canManage={canManage} /> },
          ]}
        />
      </div>
    </div>
  );
}
