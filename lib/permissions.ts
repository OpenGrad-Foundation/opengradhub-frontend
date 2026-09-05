/**
 * PBAC permission codes — the canonical `<module>.<action>` strings shared by
 * the DB (`permissions.code`), the backend `@RequirePermission(...)` decorators,
 * and the frontend `usePermission(...)` checks.
 *
 * Keep in sync with `opengradhub-backend/src/database/migrations/022_pbac_full_modules.sql`
 * (and `contextfile/RBAC_MODULES.md`). 17 modules · 64 permissions.
 *
 * Using this map instead of bare string literals gives compile-time protection
 * against typos in `usePermission(PERM.courses.create)`.
 */
export const PERM = {
  dashboard: {
    view: "dashboard.view",
  },
  courses: {
    view: "courses.view",
    create: "courses.create",
    edit: "courses.edit",
    delete: "courses.delete",
    enrol: "courses.enrol",
    manage_curriculum: "courses.manage_curriculum",
  },
  bundles: {
    view: "bundles.view",
    create: "bundles.create",
    edit: "bundles.edit",
    delete: "bundles.delete",
    enrol: "bundles.enrol",
    manage_tests: "bundles.manage_tests",
  },
  assessments: {
    view: "assessments.view",
    attempt: "assessments.attempt",
    reset_attempt: "assessments.reset_attempt",
    edit: "assessments.edit",
  },
  test_bank: {
    view: "test_bank.view",
    create: "test_bank.create",
    edit: "test_bank.edit",
    delete: "test_bank.delete",
    publish: "test_bank.publish",
    manage_questions: "test_bank.manage_questions",
  },
  assignments: {
    view: "assignments.view",
    create: "assignments.create",
    edit: "assignments.edit",
    delete: "assignments.delete",
    submit: "assignments.submit",
    grade: "assignments.grade",
  },
  live_classes: {
    view: "live_classes.view",
    create: "live_classes.create",
    edit: "live_classes.edit",
    delete: "live_classes.delete",
    join: "live_classes.join",
    attendance: "live_classes.attendance",
  },
  attendance: {
    manage: "attendance.manage",
    view: "attendance.view",
    view_own: "attendance.view_own",
  },
  calendar: {
    view:   "calendar.view",
    create: "calendar.create",
    edit:   "calendar.edit",
    delete: "calendar.delete",
  },
  resources: {
    view: "resources.view",
    create: "resources.create",
    edit: "resources.edit",
    delete: "resources.delete",
  },
  doubts: {
    view: "doubts.view",
    submit: "doubts.submit",
    respond: "doubts.respond",
    delete: "doubts.delete",
  },
  announcements: {
    view: "announcements.view",
    create: "announcements.create",
    edit: "announcements.edit",
    delete: "announcements.delete",
  },
  analytics: {
    view: "analytics.view",
    view_admin: "analytics.view_admin",
    view_manager: "analytics.view_manager",
    view_fellow: "analytics.view_fellow",
  },
  reports: {
    view: "reports.view",
  },
  student_export: {
    view: "student_export.view",
    run: "student_export.run",
  },
  schools: {
    view: "schools.view",
    create: "schools.create",
    edit: "schools.edit",
    bulk_import: "schools.bulk_import",
  },
  programmes: {
    view: "programmes.view",
    create: "programmes.create",
    manage: "programmes.manage",
    /** Legacy catalogue entry only; not a runtime administration gate. */
    edit: "programmes.edit",
    manage_members: "programmes.manage_members",
  },
  students: { view: "students.view" },
  staff: { view_contacts: "staff.view_contacts" },
  scope: { self: "scope.self", subtree: "scope.subtree", programme_all: "scope.programme_all", unrestricted: "scope.unrestricted" },
  batches: {
    view: "batches.view",
    create: "batches.create",
    edit: "batches.edit",
    delete: "batches.delete",
    enrol: "batches.enrol",
    assign_content: "batches.assign_content",
  },
  user_management: {
    view: "user_management.view",
    create: "user_management.create",
    edit: "user_management.edit",
    archive: "user_management.archive",
    delete: "user_management.delete",
    bulk_import: "user_management.bulk_import",
  },
  role_management: {
    view: "role_management.view",
    assign_role: "role_management.assign_role",
    manage_overrides: "role_management.manage_overrides",
    manage_roles: "role_management.manage_roles",
  },
  password_resets: {
    view: "password_resets.view",
    manage: "password_resets.manage",
  },
  notifications: {
    view: "notifications.view",
    send: "notifications.send",
  },
  tracker: {
    view: "tracker.view",
    author: "tracker.author",
    // Sharing a task outside the organisation. Separate from `author` because
    // that one includes Zonal Managers, and publishing proof photographs to a
    // funder is not the same decision as writing a task. See migration 124.
    share_external: "tracker.share_external",
    fill: "tracker.fill",
    /** Fill a subordinate's row in their name — ZM/PM only (migration 103). */
    fill_override: "tracker.fill.override",
    blocker_clear: "tracker.blocker.clear",
    admin: "tracker.admin",
    all_tasks: "tracker.all_tasks",
    /** Accept an out-of-range school-visit verification (migration 097). */
    geo_override: "tracker.geo.override",
    /** Reopen one overdue record until a new date (migration 098). */
    extension_grant: "tracker.extension.grant",
  },
} as const;

export const ANALYTICS_DASHBOARD_PERMISSIONS = [
  PERM.analytics.view,
  PERM.analytics.view_admin,
  PERM.analytics.view_manager,
  PERM.analytics.view_fellow,
] as const;

/**
 * Staff-only analytics permissions. Excludes `analytics.view` on purpose —
 * students hold it for their own dashboards, and it must not unlock a page
 * that shows another student's record.
 */
export const STAFF_ANALYTICS_PERMISSIONS = [
  PERM.analytics.view_admin,
  PERM.analytics.view_manager,
  PERM.analytics.view_fellow,
] as const;

export const REPORTS_ROUTE_PERMISSIONS = [
  PERM.reports.view,
  PERM.analytics.view_admin,
  PERM.analytics.view_manager,
  PERM.analytics.view_fellow,
] as const;

/** Full profiles contain learning history, in addition to the roster identity. */
export const STUDENT_PROFILE_PERMISSIONS = [...ANALYTICS_DASHBOARD_PERMISSIONS, PERM.reports.view] as const;

type RoutePermission = string | readonly string[];

/** Maps a top-level dashboard route segment → the permission needed to view it. */
export const ROUTE_PERMISSION: Record<string, RoutePermission> = {
  courses: PERM.courses.view,
  "course-management": PERM.courses.edit,
  bundles: PERM.bundles.view,
  assessments: PERM.assessments.view,
  "test-bank": PERM.test_bank.view,
  "quiz-builder": PERM.test_bank.view,
  assignments: PERM.assignments.view,
  "live-classes": PERM.live_classes.view,
  attendance: [PERM.attendance.view, PERM.attendance.view_own],
  calendar: PERM.calendar.view,
  resources: PERM.resources.view,
  doubts: PERM.doubts.view,
  announcements: PERM.announcements.view,
  analytics: ANALYTICS_DASHBOARD_PERMISSIONS,
  reports: REPORTS_ROUTE_PERMISSIONS,
  "student-export": PERM.student_export.view,
  "user-management": PERM.user_management.view,
  schools: PERM.schools.view,
  programmes: PERM.programmes.view,
  students: PERM.students.view,
  batches: PERM.batches.view,
  "role-management": PERM.role_management.view,
  tracker: PERM.tracker.view,
  // `/dashboard` itself and self-scoped pages (notifications, profile) have no gate.
};

/** Action authority and administrative reach are independent from data access. */
export function programmeCapabilities(has: (code: string) => boolean, isMember: boolean) {
  const administer = isMember || has(PERM.scope.unrestricted);
  return {
    create: has(PERM.programmes.create),
    manage: has(PERM.programmes.manage) && administer,
    manageMembers: has(PERM.programmes.manage_members) && administer,
    students: has(PERM.students.view),
    staffContacts: has(PERM.staff.view_contacts),
  };
}

/** Dedicated source browsing requires create, without opening normal data routes. */
export function routePermissionForPath(pathname: string): RoutePermission | undefined {
  const path = pathname.split('?')[0].replace(/\/$/, '');
  if (path === '/dashboard/courses/duplicate') return PERM.courses.create;
  if (path === '/dashboard/test-bank/duplicate') return PERM.test_bank.create;
  return ROUTE_PERMISSION[path.replace(/^\/dashboard\/?/, '').split('/')[0]];
}

export function canAccessDashboardPath(pathname: string, has: (code: string) => boolean): boolean {
  const required = routePermissionForPath(pathname);
  const codes = typeof required === 'string' ? [required] : required ?? [];
  if (codes.length && !codes.some(has)) return false;
  if (/^\/dashboard\/student-export(?:\/|$)/.test(pathname)) return has(PERM.students.view);
  if (/^\/dashboard\/students(?:\/|$)/.test(pathname)) return STUDENT_PROFILE_PERMISSIONS.some(has);
  return true;
}

/** Learning persona follows the single effective scope, including custom role names. */
export function hasEffectiveSelfScope(permissions: readonly string[] | undefined): boolean {
  const scopes = permissions?.filter(code => code.startsWith("scope.")) ?? [];
  return scopes.length === 1 && scopes[0] === PERM.scope.self;
}
