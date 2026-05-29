// Sidebar / nav metadata.
//
// PBAC: the *set* of modules a user sees comes entirely from the backend
// (`GET /users/me` → `data.modules`, which already applies role defaults +
// per-user overrides). This file only carries the static presentation bits —
// human label and href — keyed by the DB `modules.code`. There is no role→module
// table here any more; that lived in the old RBAC world.

export type RoleCode =
  | "SUPER_ADMIN"
  | "PROGRAM_MANAGER"
  | "ZONAL_MANAGER"
  | "FELLOW"
  | "STUDENT"
  | "GOVERNMENT"
  | "FUNDING_PARTNER";

// The modules that have a dashboard page / nav entry. `notifications` is a real
// PBAC module but is surfaced through the bell icon, not the sidebar, so it is
// intentionally absent here. Keys must match `modules.code` in the DB exactly.
export type ModuleKey =
  | "dashboard"
  | "courses"
  | "bundles"
  | "assessments"
  | "test_bank"
  | "assignments"
  | "live_classes"
  | "calendar"
  | "resources"
  | "doubts"
  | "announcements"
  | "analytics"
  | "reports"
  | "student_export"
  | "user_management"
  | "role_management"
  | "bulk_assign";

export type ModuleMeta = { label: string; href: string };

export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  dashboard:        { label: "Dashboard",       href: "/dashboard" },
  courses:          { label: "Courses",         href: "/dashboard/courses" },
  bundles:          { label: "Bundles",         href: "/dashboard/bundles" },
  assessments:      { label: "Assessments",     href: "/dashboard/assessments" },
  test_bank:        { label: "Question Bank",    href: "/dashboard/test-bank" },
  assignments:      { label: "Assignments",     href: "/dashboard/assignments" },
  live_classes:     { label: "Live Classes",    href: "/dashboard/live-classes" },
  calendar:         { label: "Calendar",        href: "/dashboard/calendar" },
  resources:        { label: "Resources",       href: "/dashboard/resources" },
  doubts:           { label: "Doubts",          href: "/dashboard/doubts" },
  announcements:    { label: "Announcements",   href: "/dashboard/announcements" },
  analytics:        { label: "Analytics",       href: "/dashboard/analytics" },
  reports:          { label: "Reports",         href: "/dashboard/reports" },
  student_export:   { label: "Student Export",  href: "/dashboard/student-export" },
  user_management:  { label: "User Management", href: "/dashboard/user-management" },
  role_management:  { label: "Role Management", href: "/dashboard/role-management" },
  bulk_assign:      { label: "Bulk Assign",     href: "/dashboard/bulk-manage" },
};
