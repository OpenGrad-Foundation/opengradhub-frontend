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
  | "student_export"
  | "user_management"
  | "role_management";

export type RoleCode =
  | "SUPER_ADMIN"
  | "PROGRAM_MANAGER"
  | "ZONAL_MANAGER"
  | "FELLOW"
  | "STUDENT"
  | "GOVERNMENT"
  | "FUNDING_PARTNER";

export type ModuleMeta = {
  key: ModuleKey;
  label: string;
  href: string;
};

export const MODULE_META: Record<ModuleKey, Omit<ModuleMeta, "key">> = {
  dashboard:        { label: "Dashboard",        href: "/dashboard" },
  courses:          { label: "Courses",           href: "/dashboard/courses" },
  bundles:          { label: "Course Bundles",    href: "/dashboard/bundles" },
  assessments:      { label: "Assessments",       href: "/dashboard/assessments" },
  test_bank:        { label: "Question Bank",     href: "/dashboard/test-bank" },
  assignments:      { label: "Assignments",       href: "/dashboard/assignments" },
  live_classes:     { label: "Live Classes",      href: "/dashboard/live-classes" },
  calendar:         { label: "Calendar",          href: "/dashboard/calendar" },
  resources:        { label: "Resources",         href: "/dashboard/resources" },
  doubts:           { label: "Doubts",            href: "/dashboard/doubts" },
  announcements:    { label: "Announcements",     href: "/dashboard/announcements" },
  analytics:        { label: "Analytics",         href: "/dashboard/analytics" },
  student_export:   { label: "Student Export",    href: "/dashboard/student-export" },
  user_management:  { label: "User Management",   href: "/dashboard/user-management" },
  role_management:  { label: "Role Management",   href: "/dashboard/role-management" },
};

// Default sidebar modules per role — from context/RBAC_MODULES.md
// STUDENT assessments is conditionally added when programme_type === "PG"
export const ROLE_MODULES: Record<RoleCode, ModuleKey[]> = {
  SUPER_ADMIN: [
    "dashboard", "courses", "bundles", "assessments", "test_bank", "assignments",
    "live_classes", "calendar", "resources", "doubts", "announcements",
    "analytics", "student_export", "user_management", "role_management",
  ],
  PROGRAM_MANAGER: [
    "dashboard", "courses", "bundles", "assessments", "test_bank", "assignments",
    "live_classes", "calendar", "resources", "doubts", "announcements",
    "analytics", "student_export",
  ],
  ZONAL_MANAGER: [
    "dashboard", "courses", "assessments", "assignments",
    "live_classes", "calendar", "resources", "announcements", "analytics", "student_export",
  ],
  FELLOW: [
    "dashboard", "assignments", "live_classes", "calendar",
    "announcements", "analytics", "student_export",
  ],
  STUDENT: [
    // assessments added at runtime when programme_type === "PG"
    "dashboard", "courses", "assignments", "live_classes", "calendar",
    "resources", "doubts", "announcements",
  ],
  GOVERNMENT: [
    "dashboard", "announcements", "analytics",
  ],
  FUNDING_PARTNER: [
    "dashboard", "announcements", "analytics",
  ],
};

export function getNavModules(
  roleCode: string,
  programmeType?: string | null,
): ModuleMeta[] {
  const base = (ROLE_MODULES[roleCode as RoleCode] ?? ["dashboard"]).slice();

  // Insert assessments for PG students after courses
  if (roleCode === "STUDENT" && programmeType === "PG") {
    const coursesIdx = base.indexOf("courses");
    base.splice(coursesIdx + 1, 0, "assessments");
  }

  return base.map((key) => ({ key, ...MODULE_META[key] }));
}
