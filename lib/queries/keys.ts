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

  notifications: (recipientId: string) => ['og', 'notifications', recipientId] as const,
  unreadCount: (recipientId: string) =>
    ['og', 'notifications', recipientId, 'unread'] as const,

  studentCourses: (studentId: string) =>
    ['og', 'student', studentId, 'courses'] as const,

  managers: (role: string) => ['og', 'managers', role] as const,
  assessmentsOverview: (params: Record<string, unknown>) =>
    ['og', 'assessments', 'overview', params] as const,
  reportHistory: (studentId: string) =>
    ['og', 'report', studentId, 'history'] as const,
  staffDoubts: (filters: Record<string, unknown>) =>
    ['og', 'doubts', 'staff', filters] as const,
};
