/**
 * PBAC permission codes — the canonical `<module>.<action>` strings shared by
 * the DB (`permissions.code`), the backend `@RequirePermission(...)` decorators,
 * and the frontend `usePermission(...)` checks.
 *
 * Keep in sync with `opengradhub-backend/src/database/migrations/022_pbac_full_modules.sql`
 * (and `contextfile/RBAC_MODULES.md`). 17 modules · 62 permissions.
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
  },
  calendar: {
    view: "calendar.view",
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
  student_export: {
    view: "student_export.view",
    run: "student_export.run",
  },
  bulk_assign: {
    view: "bulk_assign.view",
    run: "bulk_assign.run",
  },
  user_management: {
    view: "user_management.view",
    create: "user_management.create",
    edit: "user_management.edit",
    delete: "user_management.delete",
    bulk_import: "user_management.bulk_import",
  },
  role_management: {
    view: "role_management.view",
    assign_role: "role_management.assign_role",
    manage_overrides: "role_management.manage_overrides",
  },
  notifications: {
    view: "notifications.view",
  },
  audit_log: {
    view: "audit_log.view",
  },
} as const;

/** Maps a top-level dashboard route segment → the permission needed to view it. */
export const ROUTE_PERMISSION: Record<string, string> = {
  courses: PERM.courses.view,
  "course-management": PERM.courses.edit,
  bundles: PERM.bundles.view,
  assessments: PERM.assessments.view,
  "test-bank": PERM.test_bank.view,
  "quiz-builder": PERM.test_bank.view,
  assignments: PERM.assignments.view,
  "live-classes": PERM.live_classes.view,
  calendar: PERM.calendar.view,
  resources: PERM.resources.view,
  doubts: PERM.doubts.view,
  announcements: PERM.announcements.view,
  analytics: PERM.analytics.view,
  "student-export": PERM.student_export.view,
  "bulk-manage": PERM.bulk_assign.view,
  "user-management": PERM.user_management.view,
  "role-management": PERM.role_management.view,
  "activity-log": PERM.audit_log.view,
  // `/dashboard` itself and self-scoped pages (notifications, profile) have no gate.
};
