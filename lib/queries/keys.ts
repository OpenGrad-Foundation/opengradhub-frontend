/**
 * Layer 4 of caching strategy v2 — query-key factory.
 *
 * Single source of truth for TanStack Query keys. Both useQuery hooks and
 * invalidateQueries calls construct keys here, so an invalidation can never
 * silently miss because of a typo'd key.
 *
 * All keys start with the 'og' prefix so `queryClient.invalidateQueries({
 * queryKey: qk.all })` clears everything app-owned in one call.
 */
export const qk = {
  all: ['og'] as const,

  courses: (params: Record<string, unknown>) => ['og', 'courses', params] as const,
  course: (id: string) => ['og', 'course', id] as const,
  courseOverview: (courseId: string, studentId: string) =>
    ['og', 'course', courseId, 'overview', studentId] as const,

  lesson: (lessonId: string) => ['og', 'lesson', lessonId] as const,

  user: (userId: string) => ['og', 'user', userId] as const,

  announcements: (role: string) => ['og', 'announcements', role] as const,
  announcementUnreadCount: () => ['og', 'announcements', 'unread-count'] as const,

  notifications: () => ['og', 'notifications'] as const,
  unreadCount: () => ['og', 'notifications', 'unread'] as const,

  studentCourses: (studentId: string) =>
    ['og', 'student', studentId, 'courses'] as const,

  managers: (role: string) => ['og', 'managers', role] as const,
  assessmentsOverview: (params: Record<string, unknown>) =>
    ['og', 'assessments', 'overview', params] as const,
  reportHistory: (studentId: string) =>
    ['og', 'report', studentId, 'history'] as const,
  staffDoubts: (filters: Record<string, unknown>) =>
    ['og', 'doubts', 'staff', filters] as const,

  managerAnalytics: (courseId: string) =>
    ['og', 'analytics', 'manager', courseId] as const,
  analyticsSchools: () => ['og', 'analytics', 'schools'] as const,
  analyticsStudents: (filters: Record<string, unknown>) =>
    ['og', 'analytics', 'students', filters] as const,
  topicStrength: (studentId: string) =>
    ['og', 'student', studentId, 'topics'] as const,
  quizAttempts: (quizId: string, studentId?: string) =>
    ['og', 'quiz', quizId, 'attempts', studentId ?? 'self'] as const,
  myQuizAttempts: (studentId?: string) =>
    ['og', 'quiz-attempts', 'mine', studentId ?? 'self'] as const,
  availableQuizzes: () => ['og', 'quizzes', 'available'] as const,
  bundles: (studentId?: string) => ['og', 'bundles', studentId ?? 'all'] as const,
  batches: (status?: string) => ['og', 'batches', status ?? 'ACTIVE'] as const,
  batch: (id: string) => ['og', 'batches', 'detail', id] as const,
  liveClasses: () => ['og', 'live-classes'] as const,
  nextLiveClass: (studentId: string) =>
    ['og', 'live-classes', 'next', studentId] as const,
  assignments: () => ['og', 'assignments'] as const,
  submissionQueue: (filters: Record<string, unknown>) =>
    ['og', 'assignments', 'submission-queue', filters] as const,
  resources: (programmeType?: string) =>
    ['og', 'resources', programmeType ?? 'all'] as const,
  calendar: (from?: string, to?: string) =>
    ['og', 'calendar', from ?? '', to ?? ''] as const,
  studentEnrolments: (studentId: string) =>
    ['og', 'student', studentId, 'enrolments'] as const,

  dashboard: (role: string, tab: 'overview' | 'activity') =>
    ['og', 'dashboard', role, tab] as const,
  dashboardWidget: (role: string, tab: 'overview' | 'activity', widgetId: string) =>
    ['og', 'dashboard', role, tab, widgetId] as const,
};
