import type {
  CurrentUserResponse,
  SignInPayload,
  SignInResponse,
  SignUpPayload,
  SignUpResponse,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ── Auth token store ───────────────────────────────────────────────────────────
// For Clerk mode: a getter fn is registered so every apiFetch call gets a fresh
// token (Clerk caches internally, so this is cheap). This avoids the race where
// sessionStorage cache hit sets isLoading=false synchronously but the async
// getToken() call hasn't completed yet, causing API calls to go out token-less.
// For custom auth mode: setApiAuthToken is called with the stored JWT.
let _apiToken: string | null = null;
let _tokenGetter: (() => Promise<string | null>) | null = null;

export function setApiAuthToken(token: string): void {
  _apiToken = token;
}

export function setApiTokenGetter(getter: () => Promise<string | null>): void {
  _tokenGetter = getter;
}

async function resolveAuthHeader(): Promise<Record<string, string>> {
  if (_tokenGetter) {
    const token = await _tokenGetter();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return _apiToken ? { Authorization: `Bearer ${_apiToken}` } : {};
}

/**
 * Drop-in replacement for `fetch` that injects the current auth token.
 * Explicit `Authorization` headers in `init` take precedence over the stored token.
 */
export async function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const authHdr = await resolveAuthHeader();
  const headers: Record<string, string> = {
    ...authHdr,
    ...(init?.headers as Record<string, string> | undefined ?? {}),
  };
  return fetch(typeof input === "string" ? input : input.toString(), {
    ...init,
    headers,
  });
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch the current user's profile from the backend.
 *
 * @param token - The bearer token to send. In custom mode this is the local JWT;
 *                in Clerk mode this is the Clerk session token from useAuth().getToken().
 */
export async function fetchCurrentUser(token: string) {
  const response = await apiFetch(`${API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

  const errorMessage =
      errorBody?.message ??
      (response.status === 401
        ? "Your session is not valid anymore. Please sign in again."
        : "We could not load your local OpenGradHub profile.");

    throw new ApiError(errorMessage, response.status);
  }

  return (await response.json()) as CurrentUserResponse;
}

export async function signIn(payload: SignInPayload) {
  return postJson<SignInResponse>("/auth/sign-in", payload);
}

export async function signUp(payload: SignUpPayload) {
  return postJson<SignUpResponse>("/auth/sign-up", payload);
}

async function postJson<TResponse>(
  path: string,
  payload: SignInPayload | SignUpPayload,
) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string | string[] } | null;

    const message = Array.isArray(errorBody?.message)
      ? errorBody.message[0]
      : errorBody?.message ?? "The request could not be completed.";

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as TResponse;
}

// ── Users API ──────────────────────────────────────────────────

export type SafeUser = {
  id: string;
  name: string;
  role: string;
  programme_type: string | null;
  school_id: string | null;
  zone: string | null;
  state: string | null;
  school_code: string | null;
  district: string | null;
  status: string;
  email: string | null;
  roll_number: string | null;
  phone: string | null;
  created_at: string;
  tempPassword?: string;
};

/**
 * Fetch all users. Optionally filter by role code (e.g. "FELLOW").
 */
export async function getUsers(role?: string): Promise<SafeUser[]> {
  const url = new URL(`${API_BASE_URL}/users`);
  if (role) url.searchParams.set("role", role);

  const response = await apiFetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new ApiError("Failed to fetch users.", response.status);
  }

  return (await response.json()) as SafeUser[];
}

/**
 * Fetch a single user by ID (mock-friendly — no auth required).
 */
export async function getMe(id: string): Promise<SafeUser> {
  const response = await apiFetch(`${API_BASE_URL}/users/me?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

    throw new ApiError(
      errorBody?.message ?? "Failed to fetch user.",
      response.status,
    );
  }

  return (await response.json()) as SafeUser;
}

// ── Analytics API ────────────────────────────────────────────

export type AnalyticsStudent = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  programme_type: string | null;
  school_name: string | null;
  zone: string | null;
  status: string;
  created_at: string;
};

export type AnalyticsSchool = {
  id: string;
  name: string;
  district: string | null;
  state: string | null;
};

export type AnalyticsStudentFilters = {
  role?: string;
  programme_type?: string;
  status?: string;
  school_id?: string;
  zone?: string;
  from?: string;
  to?: string;
};

function buildAnalyticsParams(filters: AnalyticsStudentFilters) {
  // Scope (which schools/students the caller may see) is derived server-side
  // from the JWT — the client never sends `caller_role`/`caller_id`.
  const params = new URLSearchParams();

  if (filters.role) params.set("role", filters.role);
  if (filters.programme_type) params.set("programme_type", filters.programme_type);
  if (filters.status) params.set("status", filters.status);
  if (filters.school_id) params.set("school_id", filters.school_id);
  if (filters.zone) params.set("zone", filters.zone);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return params;
}

export async function getAnalyticsSchools(): Promise<AnalyticsSchool[]> {
  const response = await apiFetch(`${API_BASE_URL}/analytics/schools`);

  if (!response.ok) {
    throw new ApiError("Failed to fetch schools.", response.status);
  }

  return (await response.json()) as AnalyticsSchool[];
}

export async function getAnalyticsStudents(
  filters: AnalyticsStudentFilters,
): Promise<AnalyticsStudent[]> {
  const params = buildAnalyticsParams(filters);
  const qs = params.toString();
  const response = await apiFetch(
    `${API_BASE_URL}/analytics/students${qs ? `?${qs}` : ""}`,
  );

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

    throw new ApiError(
      errorBody?.message ?? "Failed to fetch students.",
      response.status,
    );
  }

  return (await response.json()) as AnalyticsStudent[];
}

export async function downloadAnalyticsStudentsCsv(filters: AnalyticsStudentFilters) {
  const params = buildAnalyticsParams(filters);
  const qs = params.toString();
  const response = await apiFetch(
    `${API_BASE_URL}/analytics/students/export${qs ? `?${qs}` : ""}`,
  );

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

    throw new ApiError(
      errorBody?.message ?? "Failed to export students.",
      response.status,
    );
  }

  const blob = await response.blob();
  const header = response.headers.get("content-disposition");
  let filename = "opengrad_export.csv";
  if (header) {
    const match = /filename="?([^";]+)"?/i.exec(header);
    if (match?.[1]) filename = match[1];
  }

  return { blob, filename };
}

// ── Analytics Dashboard API ───────────────────────────────────

export type AdminStats = {
  total_active_users: number;
  active_courses: number;
  avg_completion_rate: number;
  pending_approvals: number;
  top_districts: { district: string; count: number }[];
  programme_distribution: { programme: string; count: number }[];
};

export type ManagerCourseRow = {
  id: string;
  title: string;
  status: string;
  programme_type: string;
  enrolment_count: number;
  avg_completion: number;
  avg_quiz_score: number;
};

export type ManagerStudentRow = {
  id: string;
  name: string;
  completion_pct: number;
  best_score: number | null;
  avg_score: number | null;
  assignment_status: string;
};

export type QuizDistributionRow = {
  id: string;
  title: string;
  buckets: { label: string; count: number }[];
};

export type FellowSchoolCard = {
  id: string;
  name: string;
  district: string | null;
  state: string | null;
  enrolled_students: number;
  avg_completion: number;
  badge: "ACTIVE" | "NEEDS_ATTENTION";
};

export type SchoolDetail = {
  school_id: string;
  school_name: string;
  enrolled_students: number;
  avg_completion: number;
  at_risk_count: number;
  courses: { id: string; title: string }[];
  section_scores: { section: string; avg_score: number }[];
  score_distribution: { label: string; count: number }[];
};

export async function getAdminAnalytics(): Promise<AdminStats> {
  const res = await apiFetch(`${API_BASE_URL}/analytics/admin`);
  if (!res.ok) throw new ApiError("Failed to fetch admin analytics.", res.status);
  return (await res.json()) as AdminStats;
}

export async function getManagerAnalytics(
  courseId?: string,
): Promise<
  | { view: "courses"; courses: ManagerCourseRow[] }
  | { view: "students"; students: ManagerStudentRow[]; quiz_distribution: QuizDistributionRow[] }
> {
  const url = courseId
    ? `${API_BASE_URL}/analytics/manager?course_id=${encodeURIComponent(courseId)}`
    : `${API_BASE_URL}/analytics/manager`;
  const res = await apiFetch(url);
  if (!res.ok) throw new ApiError("Failed to fetch manager analytics.", res.status);
  return res.json() as Promise<
    | { view: "courses"; courses: ManagerCourseRow[] }
    | { view: "students"; students: ManagerStudentRow[]; quiz_distribution: QuizDistributionRow[] }
  >;
}

export async function getFellowAnalytics(): Promise<FellowSchoolCard[]> {
  const res = await apiFetch(`${API_BASE_URL}/analytics/fellow`);
  if (!res.ok) throw new ApiError("Failed to fetch fellow analytics.", res.status);
  return (await res.json()) as FellowSchoolCard[];
}

export async function getSchoolDetail(
  schoolId: string,
  courseId?: string,
): Promise<SchoolDetail> {
  const params = new URLSearchParams({ school_id: schoolId });
  if (courseId) params.set("course_id", courseId);
  const res = await apiFetch(`${API_BASE_URL}/analytics/fellow/school?${params.toString()}`);
  if (!res.ok) throw new ApiError("Failed to fetch school detail.", res.status);
  return (await res.json()) as SchoolDetail;
}

// ── Courses API ────────────────────────────────────────────────

export type Course = {
  id: string;
  title: string;
  description: string | null;
  programme_type: string;
  cover_image_url: string | null;
  locking_mode: string;
  access_type: string;
  status: string;
  created_by: string;
  created_at: string;
  lesson_count: number;
};

export type CourseListParams = {
  programmeType?: string;
  studentId?: string;
  createdBy?: string;
  allStatuses?: boolean;
  search?: string;
  status?: string;
  accessType?: string;
  lockingMode?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedCoursesResponse = {
  items: Course[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

function appendCourseListParams(url: URL, params: CourseListParams, paginate = false) {
  if (params.programmeType) url.searchParams.set("programme_type", params.programmeType);
  if (params.studentId) url.searchParams.set("student_id", params.studentId);
  if (params.createdBy) url.searchParams.set("created_by", params.createdBy);
  if (params.allStatuses) url.searchParams.set("all_statuses", "true");
  if (params.search) url.searchParams.set("search", params.search);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.accessType) url.searchParams.set("access_type", params.accessType);
  if (params.lockingMode) url.searchParams.set("locking_mode", params.lockingMode);
  if (typeof params.page === "number") url.searchParams.set("page", String(params.page));
  if (typeof params.pageSize === "number") url.searchParams.set("page_size", String(params.pageSize));
  if (paginate) url.searchParams.set("paginate", "true");
}

/**
 * Fetch courses. Mode is determined by params:
 *   studentId   → enrolled courses for that student (ACTIVE only)
 *   createdBy   → all courses created by that user, all statuses (PM view)
 *   allStatuses → all courses regardless of status (SA view)
 *   default     → ACTIVE courses only
 */
export async function getCourses(
  programmeType?: string,
  studentId?: string,
  createdBy?: string,
  allStatuses?: boolean,
): Promise<Course[]> {
  const url = new URL(`${API_BASE_URL}/courses`);
  appendCourseListParams(url, { programmeType, studentId, createdBy, allStatuses });

  const response = await apiFetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new ApiError("Failed to fetch courses.", response.status);
  }

  return (await response.json()) as Course[];
}

export async function getCoursesPage(
  params: CourseListParams = {},
): Promise<PaginatedCoursesResponse> {
  const url = new URL(`${API_BASE_URL}/courses`);
  appendCourseListParams(url, params, true);

  const response = await apiFetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errorBody?.message ?? "Failed to fetch course catalogue.", response.status);
  }

  return (await response.json()) as PaginatedCoursesResponse;
}

/**
 * Enrol a student in a course.
 */
export async function assignCourse(
  studentId: string,
  courseId: string,
  assignedBy: string,
): Promise<{ id: string; student_id: string; course_id: string; enrolled_at: string }> {
  const response = await apiFetch(`${API_BASE_URL}/enrolments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId, course_id: courseId, assigned_by: assignedBy }),
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errorBody?.message ?? "Failed to assign course.", response.status);
  }
  return (await response.json()) as { id: string; student_id: string; course_id: string; enrolled_at: string };
}

/**
 * Get all courses a student is enrolled in.
 */
export async function getStudentEnrolments(studentId: string): Promise<Course[]> {
  const response = await apiFetch(`${API_BASE_URL}/users/${studentId}/enrolments`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError("Failed to fetch enrolments.", response.status);
  }
  return (await response.json()) as Course[];
}

export type StudentCourse = Course & {
  total_lessons: number;
  completed_lessons: number;
  completion_percent: number;
};

export type CourseManagementActivity = {
  type: "LESSON_COMPLETED" | "QUIZ_SUBMITTED" | "ASSIGNMENT_SUBMITTED" | "ENROLLED";
  student_name: string;
  label: string;
  happened_at: string;
};

export type CourseManagementModuleSummary = {
  id: string;
  title: string;
  order_index: number;
  lesson_count: number;
  module_quiz: { id: string; title: string; published: boolean } | null;
  avg_completion_percent: number;
};

export type CourseManagementSummary = {
  course: Course;
  metrics: {
    enrolled_students: number;
    average_completion_percent: number;
    average_quiz_score_percent: number;
    assignment_submission_rate_percent: number;
    at_risk_students: number;
  };
  recent_activity: CourseManagementActivity[];
  module_progress: CourseManagementModuleSummary[];
};

export type CourseManagementStudentRow = {
  id: string;
  name: string;
  email: string | null;
  enrolled_at: string;
  progress_percent: number;
  completed_lessons: number;
  total_lessons: number;
  average_quiz_score_percent: number | null;
  assignment_status: string;
  last_active_at: string | null;
};

export type CourseManagementStudentDetail = CourseManagementStudentRow & {
  lessons: { id: string; title: string; module_title: string; is_complete: boolean; completed_at: string | null }[];
  quiz_attempts: { id: string; title: string; score_percent: number | null; passed: boolean | null; submitted_at: string | null }[];
  assignments: { id: string; title: string; status: string; score: number | null; submitted_at: string | null }[];
};

export type CourseManagementStudentsResponse = {
  items: CourseManagementStudentRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type CourseManagementAnalytics = {
  enrollment_trend: { date: string; enrolled_students: number }[];
  progress_distribution: { label: string; count: number }[];
  quiz_score_distribution: { label: string; count: number }[];
};

export async function getStudentCourses(studentId: string): Promise<StudentCourse[]> {
  const r = await apiFetch(`${API_BASE_URL}/students/${studentId}/courses`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch student courses.", r.status);
  return (await r.json()) as StudentCourse[];
}

export async function getCourseManagementSummary(
  courseId: string,
): Promise<CourseManagementSummary> {
  const url = new URL(`${API_BASE_URL}/courses/${courseId}/management-summary`);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(e?.message ?? "Failed to fetch course management summary.", r.status);
  }
  return (await r.json()) as CourseManagementSummary;
}

export async function getCourseManagementStudents(
  courseId: string,
  params: {
    search?: string;
    status?: string;
    progressBucket?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<CourseManagementStudentsResponse> {
  const url = new URL(`${API_BASE_URL}/courses/${courseId}/management-students`);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.progressBucket) url.searchParams.set("progress_bucket", params.progressBucket);
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (typeof params.page === "number") url.searchParams.set("page", String(params.page));
  if (typeof params.pageSize === "number") url.searchParams.set("page_size", String(params.pageSize));
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(e?.message ?? "Failed to fetch course management students.", r.status);
  }
  return (await r.json()) as CourseManagementStudentsResponse;
}

export async function getCourseManagementStudentDetail(
  courseId: string,
  studentId: string,
): Promise<CourseManagementStudentDetail> {
  const url = new URL(`${API_BASE_URL}/courses/${courseId}/management-students/${studentId}`);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(e?.message ?? "Failed to fetch student detail.", r.status);
  }
  return (await r.json()) as CourseManagementStudentDetail;
}

export async function getCourseManagementCurriculum(
  courseId: string,
): Promise<CourseManagementModuleSummary[]> {
  const url = new URL(`${API_BASE_URL}/courses/${courseId}/management-curriculum`);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(e?.message ?? "Failed to fetch course management curriculum.", r.status);
  }
  return (await r.json()) as CourseManagementModuleSummary[];
}

export async function getCourseManagementAnalytics(
  courseId: string,
): Promise<CourseManagementAnalytics> {
  const url = new URL(`${API_BASE_URL}/courses/${courseId}/management-analytics`);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(e?.message ?? "Failed to fetch course management analytics.", r.status);
  }
  return (await r.json()) as CourseManagementAnalytics;
}

export type LessonWithProgress = {
  id: string;
  module_id: string;
  title: string;
  youtube_url: string;
  duration_minutes: number | null;
  notes_html: string | null;
  order_index: number;
  is_complete: boolean;
};

export type ModuleWithProgress = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lessons: LessonWithProgress[];
  is_module_complete: boolean;
  is_locked: boolean;
  module_quiz: { id: string; title: string; published: boolean } | null;
};

export async function getCourseOverview(courseId: string, studentId: string): Promise<ModuleWithProgress[]> {
  const url = new URL(`${API_BASE_URL}/courses/${courseId}/overview`);
  url.searchParams.set("student_id", studentId);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch course overview.", r.status);
  return (await r.json()) as ModuleWithProgress[];
}

/**
 * Create a new course (DRAFT by default).
 */
export async function getCourseById(id: string): Promise<Course> {
  const response = await apiFetch(`${API_BASE_URL}/courses/${id}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errorBody?.message ?? "Failed to fetch course.", response.status);
  }
  return (await response.json()) as Course;
}

export async function createCourse(payload: {
  title: string;
  description?: string;
  programme_type: string;
  locking_mode?: string;
  access_type?: string;
  cover_image_url?: string;
  created_by: string;
}): Promise<Course> {
  const response = await apiFetch(`${API_BASE_URL}/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;
    throw new ApiError(errorBody?.message ?? "Failed to create course.", response.status);
  }

  return (await response.json()) as Course;
}

export async function updateCourse(
  id: string,
  payload: {
    title?: string;
    description?: string;
    programme_type?: string;
    locking_mode?: string;
    access_type?: string;
    cover_image_url?: string;
    status?: string;
    caller_id: string;
    caller_role: string;
  },
): Promise<Course> {
  const response = await apiFetch(`${API_BASE_URL}/courses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errorBody?.message ?? "Failed to update course.", response.status);
  }

  return (await response.json()) as Course;
}

// ── Questions / Test Bank API ──────────────────────────────────

export type QuestionOption = {
  id: string;
  option_text: string;
  is_correct: boolean;
};

export type Question = {
  id: string;
  quiz_id: string | null;
  question_type: "MCQ" | "FILL" | "NUMERICAL" | "GROUP";
  content_html: string;
  correct_answer: string | null;
  tolerance: number | null;
  programme_type: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  explanation_video_url: string | null;
  created_by: string | null;
  options: QuestionOption[];
  children: Question[];
};

export type CreateOptionPayload = { option_text: string; is_correct: boolean };

export type CreateChildPayload = {
  question_type: "MCQ" | "FILL" | "NUMERICAL";
  content_html: string;
  correct_answer?: string;
  tolerance?: number;
  options?: CreateOptionPayload[];
};

export type CreateQuestionPayload = {
  quiz_id?: string;
  question_type: "MCQ" | "FILL" | "NUMERICAL" | "GROUP";
  content_html: string;
  correct_answer?: string;
  tolerance?: number;
  programme_type?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  explanation_video_url?: string;
  created_by?: string;
  options?: CreateOptionPayload[];
  children?: CreateChildPayload[];
};

export type QuestionFilters = {
  question_type?: string;
  programme_type?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  /** Return only questions attached to this quiz. */
  quiz_id?: string;
  /** Full-text search on content_html. */
  search?: string;
};

export async function getQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
  const url = new URL(`${API_BASE_URL}/questions`);
  if (filters.question_type) url.searchParams.set("question_type", filters.question_type);
  if (filters.programme_type) url.searchParams.set("programme_type", filters.programme_type);
  if (filters.subject) url.searchParams.set("subject", filters.subject);
  if (filters.topic) url.searchParams.set("topic", filters.topic);
  if (filters.difficulty) url.searchParams.set("difficulty", filters.difficulty);
  if (filters.quiz_id) url.searchParams.set("quiz_id", filters.quiz_id);
  if (filters.search) url.searchParams.set("search", filters.search);
  const response = await apiFetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new ApiError("Failed to fetch questions.", response.status);
  return (await response.json()) as Question[];
}

export async function createQuestion(payload: CreateQuestionPayload): Promise<Question> {
  const response = await apiFetch(`${API_BASE_URL}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to create question.", response.status);
  }
  return (await response.json()) as Question;
}

export async function updateQuestion(
  id: string,
  payload: {
    content_html?: string;
    correct_answer?: string;
    tolerance?: number | null;
    programme_type?: string;
    subject?: string;
    topic?: string;
    difficulty?: string;
    options?: CreateOptionPayload[];
  },
): Promise<Question> {
  const response = await apiFetch(`${API_BASE_URL}/questions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to update question.", response.status);
  }
  return (await response.json()) as Question;
}

export async function deleteQuestion(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/questions/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to delete question.", response.status);
  }
}

// ── Live Classes API ───────────────────────────────────────────

export type LiveClass = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  course_id: string | null;
  course_title: string | null;
  programme_type: string | null;
  created_by: string | null;
  created_at: string;
  attendee_count: number;
};

export async function getLiveClasses(): Promise<LiveClass[]> {
  const r = await apiFetch(`${API_BASE_URL}/live-classes`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch live classes.", r.status);
  return (await r.json()) as LiveClass[];
}

export async function getNextLiveClass(studentId: string): Promise<LiveClass | null> {
  const url = new URL(`${API_BASE_URL}/live-classes/next`);
  url.searchParams.set("studentId", studentId);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json() as LiveClass | null;
  return data ?? null;
}

export async function joinLiveClass(
  liveClassId: string,
  studentId: string,
): Promise<{ meeting_url: string; live_class_id: string }> {
  const r = await apiFetch(`${API_BASE_URL}/live-classes/${liveClassId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId }),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to join live class.", r.status);
  }
  return (await r.json()) as { meeting_url: string; live_class_id: string };
}

export async function createLiveClass(payload: {
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
  course_id?: string;
  programme_type?: string;
}): Promise<LiveClass> {
  const r = await apiFetch(`${API_BASE_URL}/live-classes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to create live class.", r.status);
  }
  return (await r.json()) as LiveClass;
}

// ── Notifications API ──────────────────────────────────────────

export type Notification = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  channel: "IN_APP" | "EMAIL" | "WHATSAPP";
  is_read: boolean;
  triggered_at: string;
};

export async function getNotifications(recipientId: string): Promise<Notification[]> {
  const url = new URL(`${API_BASE_URL}/notifications`);
  url.searchParams.set("recipientId", recipientId);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) return [];
  return (await r.json()) as Notification[];
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const url = new URL(`${API_BASE_URL}/notifications/unread-count`);
  url.searchParams.set("recipientId", recipientId);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) return 0;
  const data = await r.json() as { count: number };
  return data.count;
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  await apiFetch(`${API_BASE_URL}/notifications/mark-all-read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: recipientId }),
    cache: "no-store",
  });
}

// ── Assignments API ────────────────────────────────────────────

export type Assignment = {
  id: string;
  title: string;
  instructions_html: string | null;
  attachment_url: string | null;
  due_at: string;
  course_id: string | null;
  course_title: string | null;
  created_by: string | null;
  created_at: string;
  submission_status: string | null;
};

export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string | null;
  student_roll: string | null;
  response_text: string | null;
  file_urls: string[];
  status: string;
  submitted_at: string | null;
  is_late: boolean;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
};

export async function getAssignments(): Promise<Assignment[]> {
  const r = await apiFetch(`${API_BASE_URL}/assignments`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch assignments.", r.status);
  return (await r.json()) as Assignment[];
}

export async function getAssignmentById(id: string, studentId?: string): Promise<Assignment> {
  const url = new URL(`${API_BASE_URL}/assignments/${id}`);
  if (studentId) url.searchParams.set("student_id", studentId);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to fetch assignment.", r.status);
  }
  return (await r.json()) as Assignment;
}

export async function createAssignment(payload: {
  title: string;
  instructions_html?: string;
  attachment_url?: string;
  due_at: string;
  course_id?: string;
}): Promise<Assignment> {
  const r = await apiFetch(`${API_BASE_URL}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to create assignment.", r.status);
  }
  return (await r.json()) as Assignment;
}

export async function submitAssignment(
  assignmentId: string,
  payload: { student_id: string; response_text?: string; file_urls?: string[] },
): Promise<Submission> {
  const r = await apiFetch(`${API_BASE_URL}/assignments/${assignmentId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to submit assignment.", r.status);
  }
  return (await r.json()) as Submission;
}

export async function getSubmissions(assignmentId: string): Promise<Submission[]> {
  const r = await apiFetch(`${API_BASE_URL}/assignments/${assignmentId}/submissions`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch submissions.", r.status);
  return (await r.json()) as Submission[];
}

export async function patchSubmission(
  assignmentId: string,
  submissionId: string,
  payload: { score?: number; feedback?: string; status?: string; graded_by?: string },
): Promise<Submission> {
  const r = await apiFetch(`${API_BASE_URL}/assignments/${assignmentId}/submissions/${submissionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to update submission.", r.status);
  }
  return (await r.json()) as Submission;
}

// ── Quizzes API ────────────────────────────────────────────────

export type QuizSection = {
  id: string;
  quiz_id: string;
  title: string;
  order_index: number;
  duration_minutes: number | null;
  pass_threshold_percent: number | null;
  questions: Question[];
};

export type Quiz = {
  id: string;
  module_id: string | null;
  title: string;
  duration_minutes: number | null;
  max_attempts: number | null;
  pass_threshold_percent: number | null;
  shuffle_questions: boolean;
  show_answers_after: boolean;
  quiz_type: "MODULE_TEST" | "GLOBAL_TEST";
  published: boolean;
  created_by: string | null;
  created_at: string;
  questions: Question[];
  // ── Phase 3 additions ──
  is_sectioned: boolean;
  sequential_sections: boolean;
  sections: QuizSection[];
  // ── Phase 4 + 5 additions ──
  first_attempt_counts: boolean;
  require_fullscreen: boolean;
};

export type CreateQuizPayload = {
  module_id?: string;
  title: string;
  duration_minutes?: number;
  max_attempts?: number;
  pass_threshold_percent?: number;
  shuffle_questions?: boolean;
  show_answers_after?: boolean;
  quiz_type: "MODULE_TEST" | "GLOBAL_TEST";
  created_by?: string;
  is_sectioned?: boolean;
  sequential_sections?: boolean;
  first_attempt_counts?: boolean;
  require_fullscreen?: boolean;
};

export async function getQuizzes(params: { module_id?: string; quiz_type?: string } = {}): Promise<Omit<Quiz, "questions">[]> {
  const url = new URL(`${API_BASE_URL}/quizzes`);
  if (params.module_id) url.searchParams.set("module_id", params.module_id);
  if (params.quiz_type) url.searchParams.set("quiz_type", params.quiz_type);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch quizzes.", r.status);
  return (await r.json()) as Omit<Quiz, "questions">[];
}

export type ModuleQuiz = Omit<Quiz, "questions"> & {
  course_id: string;
  course_title: string;
  module_title: string;
};

export type BatchDimension = {
  peer_count: number;
  student_avg_pct: number;
  peer_avg_pct: number;
  percentile: number;
};

export type BatchComparison = {
  course_batch:    BatchDimension;
  school_peers:    BatchDimension | null;
  programme_peers: BatchDimension | null;
};

// ── Calendar ──────────────────────────────────────────────────────────────────

export type CalendarItem = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  source: "custom" | "live_class" | "assignment";
  ref_id: string | null;
};

export type CreateCalendarEventPayload = {
  title: string;
  description?: string;
  event_type: "EXAM" | "HOLIDAY" | "WORKSHOP" | "OTHER";
  starts_at: string;
  ends_at?: string;
  is_all_day?: boolean;
  programme_type?: "UG" | "PG";
  state?: string;
  school_ids?: string[];
  course_ids?: string[];
};

export async function getCalendar(from?: string, to?: string): Promise<CalendarItem[]> {
  const url = new URL(`${API_BASE_URL}/calendar`);
  if (from) url.searchParams.set("from", from);
  if (to)   url.searchParams.set("to", to);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch calendar.", r.status);
  return (await r.json()) as CalendarItem[];
}

export async function createCalendarEvent(payload: CreateCalendarEventPayload): Promise<{ id: string }> {
  const r = await apiFetch(`${API_BASE_URL}/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new ApiError("Failed to create event.", r.status);
  return (await r.json()) as { id: string };
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/calendar/${id}`, { method: "DELETE" });
  if (!r.ok) throw new ApiError("Failed to delete event.", r.status);
}

export async function getBatchComparison(studentId: string, courseId: string): Promise<BatchComparison> {
  const r = await apiFetch(`${API_BASE_URL}/analytics/students/${studentId}/batch-comparison?course_id=${courseId}`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch batch comparison.", r.status);
  return (await r.json()) as BatchComparison;
}

export async function getModuleQuizzes(): Promise<ModuleQuiz[]> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/module-tests`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch module tests.", r.status);
  return (await r.json()) as ModuleQuiz[];
}

export async function getQuizById(id: string): Promise<Quiz> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to fetch quiz.", r.status);
  }
  return (await r.json()) as Quiz;
}

export async function createQuiz(payload: CreateQuizPayload): Promise<Quiz> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to create quiz.", r.status);
  }
  return (await r.json()) as Quiz;
}

export async function updateQuiz(
  id: string,
  payload: {
    title?: string;
    duration_minutes?: number | null;
    max_attempts?: number | null;
    pass_threshold_percent?: number | null;
    shuffle_questions?: boolean;
    show_answers_after?: boolean;
    is_sectioned?: boolean;
    sequential_sections?: boolean;
    first_attempt_counts?: boolean;
    require_fullscreen?: boolean;
  },
): Promise<Quiz> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to update quiz.", r.status);
  }
  return (await r.json()) as Quiz;
}

export async function addQuizQuestion(
  quizId: string,
  payload: CreateQuestionPayload,
): Promise<Question> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to add question.", r.status);
  }
  return (await r.json()) as Question;
}

export async function attachQuizQuestion(
  quizId: string,
  questionId: string,
): Promise<Question> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/questions/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId }),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to attach question.", r.status);
  }
  return (await r.json()) as Question;
}

export async function reorderQuizQuestions(quizId: string, ids: string[]): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/questions/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    cache: "no-store",
  });
  if (!r.ok) throw new ApiError("Failed to reorder questions.", r.status);
}

export async function removeQuizQuestion(quizId: string, questionId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/questions/${questionId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!r.ok) throw new ApiError("Failed to remove question.", r.status);
}

// ── Sectioning ──────────────────────────────────────────────

export async function createQuizSection(
  quizId: string,
  payload: { title: string; duration_minutes?: number | null; pass_threshold_percent?: number | null },
): Promise<QuizSection> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new ApiError("Failed to create section.", r.status);
  return (await r.json()) as QuizSection;
}

export async function updateQuizSection(
  quizId: string,
  sectionId: string,
  payload: { title?: string; duration_minutes?: number | null; pass_threshold_percent?: number | null },
): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/sections/${sectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new ApiError("Failed to update section.", r.status);
}

export async function deleteQuizSection(quizId: string, sectionId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/sections/${sectionId}`, { method: "DELETE" });
  if (!r.ok) throw new ApiError("Failed to delete section.", r.status);
}

export async function reorderQuizSections(quizId: string, ids: string[]): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/sections/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!r.ok) throw new ApiError("Failed to reorder sections.", r.status);
}

export async function attachQuestionToSection(
  quizId: string,
  sectionId: string,
  questionId: string,
): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/sections/${sectionId}/questions/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId }),
  });
  if (!r.ok) throw new ApiError("Failed to attach question.", r.status);
}

export async function removeQuestionFromSection(
  quizId: string,
  sectionId: string,
  questionId: string,
): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/sections/${sectionId}/questions/${questionId}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new ApiError("Failed to remove question.", r.status);
}

export async function reorderSectionQuestions(
  quizId: string,
  sectionId: string,
  ids: string[],
): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/sections/${sectionId}/questions/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!r.ok) throw new ApiError("Failed to reorder questions.", r.status);
}

export type SectionAdvanceResult =
  | { type: "next"; section_index: number; section_meta: StartedAttemptSection; snapshots: QuizAttemptQuestion[] }
  | { type: "done"; result: { attempt_id: string; score: number; max_score: number; passed: boolean | null; submitted_at: string } };

export async function advanceQuizSection(
  attemptId: string,
  answers: { snapshot_id: string; student_answer: string | null; time_taken_seconds?: number | null }[],
): Promise<SectionAdvanceResult> {
  const r = await apiFetch(`${API_BASE_URL}/quiz-attempts/${attemptId}/sections/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to advance section.", r.status);
  }
  return (await r.json()) as SectionAdvanceResult;
}

export async function publishQuiz(quizId: string): Promise<Quiz> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/${quizId}/publish`, {
    method: "POST",
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to publish quiz.", r.status);
  }
  return (await r.json()) as Quiz;
}

// ── Lesson detail + progress ───────────────────────────────────

export type LessonDetail = {
  id: string;
  title: string;
  module_id: string;
  module_name: string;
  course_id: string;
  course_title: string;
  duration_minutes: number | null;
  notes_html: string | null;
  /** Extracted server-side — the raw YouTube URL is never returned. */
  video_id: string;
  order_index: number;
  module_quiz_id: string | null;
  prev_lesson_id: string | null;
  next_lesson_id: string | null;
  /** Whether this student has already completed the lesson (watched ≥ 80%). */
  is_complete?: boolean;
  /** Percentage watched in the most recent session, if returned by the API. */
  watched_percent?: number;
};

export async function getLessonById(lessonId: string): Promise<LessonDetail> {
  const r = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}`, { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to fetch lesson.", r.status);
  }
  return (await r.json()) as LessonDetail;
}

export async function patchLessonProgress(payload: {
  student_id: string;
  lesson_id: string;
  watched_percent: number;
}): Promise<{ id: string; is_complete: boolean; watched_percent: number }> {
  const r = await apiFetch(`${API_BASE_URL}/lesson-progress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to update progress.", r.status);
  }
  return (await r.json()) as { id: string; is_complete: boolean; watched_percent: number };
}

export type QuizAttempt = {
  id: string;
  quiz_id: string;
  student_id: string;
  attempt_number: number;
  score: number | null;
  max_score: number | null;
  started_at: string;
  submitted_at: string | null;
  is_complete: boolean;
  passed: boolean | null;
  counts_toward_grade: boolean;
};

export async function getQuizAttempts(quizId: string, studentId?: string): Promise<QuizAttempt[]> {
  const url = new URL(`${API_BASE_URL}/quiz-attempts`);
  url.searchParams.set("quiz_id", quizId);
  if (studentId) url.searchParams.set("student_id", studentId);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch quiz attempts.", r.status);
  return (await r.json()) as QuizAttempt[];
}

export type QuizAttemptQuestion = {
  snapshot_id: string;
  section_id?: string | null;
  question_type: string;
  content_html: string;
  correct_answer: string | null;
  tolerance: number | null;
  options: { id: string; option_text: string }[];
  children: {
    snapshot_id: string;
    section_id?: string | null;
    question_type: string;
    content_html: string;
    correct_answer: string | null;
    tolerance: number | null;
    options: { id: string; option_text: string }[];
  }[];
};

export type StartedAttemptSection = {
  section_id: string;
  title: string;
  order_index: number;
  duration_minutes: number | null;
  pass_threshold_percent: number | null;
};

export type StartedAttempt = {
  attempt_id: string;
  attempt_number: number;
  started_at: string;
  questions: QuizAttemptQuestion[];
  sections: StartedAttemptSection[];
  current_section_index?: number;
};

export async function startQuizAttempt(quizId: string): Promise<StartedAttempt> {
  const r = await apiFetch(`${API_BASE_URL}/quiz-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz_id: quizId }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to start quiz attempt.", r.status);
  }
  return (await r.json()) as StartedAttempt;
}

export async function submitQuizAttempt(
  attemptId: string,
  answers: { snapshot_id: string; student_answer: string | null; time_taken_seconds?: number | null }[],
): Promise<{ attempt_id: string; score: number; max_score: number; passed: boolean | null; submitted_at: string }> {
  const r = await apiFetch(`${API_BASE_URL}/quiz-attempts/${attemptId}/submit`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to submit quiz attempt.", r.status);
  }
  return await r.json() as { attempt_id: string; score: number; max_score: number; passed: boolean | null; submitted_at: string };
}

// ── Analytics — new endpoints ──────────────────────────────────

export type AttemptReviewQuestion = {
  snapshot_id: string;
  section_id: string | null;   // ← new
  question_type: string;
  content_html: string;
  student_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean | null;
  marks_awarded: number;
  time_taken_seconds: number | null;
  explanation_video_url: string | null;
  options: { id: string; option_text: string; is_correct: boolean }[];
  avg_time_seconds: number | null;
  batch_correct_count: number;
  batch_total_count: number;
};

export type AttemptReviewSection = {
  section_id: string;
  title: string;
  order_index: number;
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
};

export type AttemptReview = {
  attempt_id: string;
  quiz_id: string;
  score: number;
  max_score: number;
  passed: boolean | null;
  submitted_at: string;
  questions: AttemptReviewQuestion[];
  sections: AttemptReviewSection[];   // ← new
};

export async function getAttemptReview(attemptId: string): Promise<AttemptReview> {
  const r = await apiFetch(`${API_BASE_URL}/quiz-attempts/${attemptId}/review`, { cache: "no-store" });
  if (!r.ok) {
    const err = await r.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to load review.", r.status);
  }
  return (await r.json()) as AttemptReview;
}

export type WrongExplanation = {
  snapshot_id: string;
  content_html: string;
  explanation_video_url: string;
};

export async function getAttemptExplanations(attemptId: string): Promise<WrongExplanation[]> {
  const r = await apiFetch(`${API_BASE_URL}/quiz-attempts/${attemptId}/explanations`, { cache: "no-store" });
  if (!r.ok) return [];
  const data = await r.json() as { questions: WrongExplanation[] };
  return data.questions ?? [];
}

export async function logProctorEvent(attemptId: string, eventType: string): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/quiz-attempts/${attemptId}/proctor-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType }),
  });
  if (!r.ok) throw new ApiError("Failed to log proctor event.", r.status);
}

export type LeaderboardEntry = {
  rank: number;
  student_id: string;
  name: string;
  score_pct: number;
  correct_count: number;
  submitted_at: string;
};

export type QuizLeaderboard = {
  quiz_id: string;
  rankings: LeaderboardEntry[];
  viewer_rank: number | null;
};

export async function getQuizLeaderboard(quizId: string): Promise<QuizLeaderboard> {
  const r = await apiFetch(`${API_BASE_URL}/analytics/quizzes/${quizId}/leaderboard`, { cache: "no-store" });
  if (!r.ok) {
    const err = await r.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to load leaderboard.", r.status);
  }
  return (await r.json()) as QuizLeaderboard;
}

export type TopicStrengthRow = {
  subject: string;
  topic: string | null;
  correct: number;
  total: number;
  accuracy_pct: number;
};

export async function getTopicStrength(studentId: string): Promise<TopicStrengthRow[]> {
  const r = await apiFetch(`${API_BASE_URL}/analytics/students/${studentId}/topic-strength`, { cache: "no-store" });
  if (!r.ok) {
    const err = await r.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to load topic strength.", r.status);
  }
  return (await r.json()) as TopicStrengthRow[];
}

// ── Course Content API (modules + lessons) ─────────────────────

export type CourseLesson = {
  id: string;
  module_id: string;
  title: string;
  youtube_url: string;
  duration_minutes: number | null;
  notes_html: string | null;
  order_index: number;
};

export type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lessons: CourseLesson[];
  module_quiz: { id: string; title: string; published: boolean } | null;
};

export async function getCourseModules(courseId: string): Promise<CourseModule[]> {
  const r = await apiFetch(`${API_BASE_URL}/courses/${courseId}/modules`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to load modules.", r.status);
  return (await r.json()) as CourseModule[];
}

export async function createModule(courseId: string, title: string): Promise<CourseModule> {
  const r = await apiFetch(`${API_BASE_URL}/courses/${courseId}/modules`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to create module.", r.status); }
  return (await r.json()) as CourseModule;
}

export async function reorderModules(courseId: string, ids: string[]): Promise<void> {
  await apiFetch(`${API_BASE_URL}/courses/${courseId}/modules/reorder`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }), cache: "no-store",
  });
}

export async function updateModule(moduleId: string, title: string): Promise<CourseModule> {
  const r = await apiFetch(`${API_BASE_URL}/modules/${moduleId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to update module.", r.status); }
  return (await r.json()) as CourseModule;
}

export async function deleteModule(moduleId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/modules/${moduleId}`, { method: "DELETE", cache: "no-store" });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to delete module.", r.status); }
}

export async function createLesson(
  moduleId: string,
  payload: { title: string; youtube_url: string; duration_minutes?: number; notes_html?: string },
): Promise<CourseLesson> {
  const r = await apiFetch(`${API_BASE_URL}/modules/${moduleId}/lessons`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to create lesson.", r.status); }
  return (await r.json()) as CourseLesson;
}

export async function reorderLessons(moduleId: string, ids: string[]): Promise<void> {
  await apiFetch(`${API_BASE_URL}/modules/${moduleId}/lessons/reorder`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }), cache: "no-store",
  });
}

export async function updateLesson(
  lessonId: string,
  payload: { title?: string; youtube_url?: string; duration_minutes?: number | null; notes_html?: string | null },
): Promise<CourseLesson> {
  const r = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to update lesson.", r.status); }
  return (await r.json()) as CourseLesson;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}`, { method: "DELETE", cache: "no-store" });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to delete lesson.", r.status); }
}

// ── Resources API ──────────────────────────────────────────────

export type Resource = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: string | null;
  programme_type: string | null;
  created_at: string;
};

/**
 * Fetch all resources. Optionally filter by programme type.
 */
export async function getResources(programmeType?: string): Promise<Resource[]> {
  const url = new URL(`${API_BASE_URL}/resources`);
  if (programmeType) url.searchParams.set("programme_type", programmeType);

  const response = await apiFetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new ApiError("Failed to fetch resources.", response.status);
  }

  return (await response.json()) as Resource[];
}

/**
 * Create a new resource.
 */
export async function createResource(payload: {
  title: string;
  description?: string;
  url: string;
  type?: string;
  programme_type?: string;
  uploaded_by: string;
  role: string;
}): Promise<Resource> {
  const response = await apiFetch(`${API_BASE_URL}/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

    throw new ApiError(
      errorBody?.message ?? "Failed to create resource.",
      response.status,
    );
  }

  return (await response.json()) as Resource;
}

// ── User Management API ────────────────────────────────────────

export type SchoolOption = { id: string; name: string };

/**
 * Fetch all schools (id + name) for user-creation pickers.
 * Backed by GET /schools (gated by user_management.create).
 */
export async function fetchSchools(): Promise<SchoolOption[]> {
  const response = await apiFetch(`${API_BASE_URL}/schools`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError("Failed to fetch schools.", response.status);
  }

  return (await response.json()) as SchoolOption[];
}

/**
 * Create a single user.
 */
export async function createUser(payload: {
  name: string;
  email?: string;
  phone?: string;
  role: string;
  programme_type?: string;
  school_id?: string;
  state?: string;
  school_code?: string;
  roll_number?: string;
  district?: string;
  password?: string;
}): Promise<SafeUser> {
  const response = await apiFetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

    throw new ApiError(
      errorBody?.message ?? "Failed to create user.",
      response.status,
    );
  }

  return (await response.json()) as SafeUser;
}

export async function updateUser(
  userId: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    programme_type?: string;
    school_id?: string;
    state?: string;
    school_code?: string;
    roll_number?: string;
    district?: string;
  },
): Promise<SafeUser> {
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errorBody?.message ?? "Failed to update user.", response.status);
  }
  return (await response.json()) as SafeUser;
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/users/${userId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errorBody?.message ?? "Failed to delete user.", response.status);
  }
}

/**
 * Bulk upload users via CSV file.
 */
export async function bulkUploadUsers(
  file: File,
): Promise<{ created: number; skipped: number; errors: string[]; credentials: Array<{ name: string; rollNumber: string; tempPassword?: string }> }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch(`${API_BASE_URL}/users/bulk`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

    throw new ApiError(
      errorBody?.message ?? "Failed to upload users.",
      response.status,
    );
  }

  return (await response.json()) as {
    created: number;
    skipped: number;
    errors: string[];
    credentials: Array<{ name: string; rollNumber: string; tempPassword?: string }>;
  };
}

/**
 * Download CSV template for bulk user upload.
 */
export function getUserTemplateUrl(role?: string): string {
  if (role && role.trim()) {
    const params = new URLSearchParams({ role: role.trim() });
    return `${API_BASE_URL}/users/export/template?${params.toString()}`;
  }
  return `${API_BASE_URL}/users/export/template`;
}

// ── Announcements API ──────────────────────────────────────────

export type Announcement = {
  id: string;
  title: string;
  body: string;
  target_roles: string[];
  programme_type: string | null;
  created_at: string;
};

export async function getAnnouncements(role?: string): Promise<Announcement[]> {
  const params = new URLSearchParams();
  if (role) params.append("role", role);

  const url = `${API_BASE_URL}/announcements${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await apiFetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError("Failed to fetch announcements.", response.status);
  }

  return (await response.json()) as Announcement[];
}

export async function createAnnouncement(payload: {
  title: string;
  body: string;
  target_roles: string[];
  programme_type?: string;
  created_by: string;
  role: string;
}): Promise<Announcement> {
  const response = await apiFetch(`${API_BASE_URL}/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;
    throw new ApiError(
      errorBody?.message ?? "Failed to create announcement.",
      response.status,
    );
  }

  return (await response.json()) as Announcement;
}

// ── Doubts API ─────────────────────────────────────────────────

export type Doubt = {
  id: string;
  student_id: string;
  student_name: string | null;
  subject: string;
  body: string;
  status: "OPEN" | "ANSWERED";
  answer: string | null;
  created_at: string;
};

/**
 * Fetch doubts.
 * SUPER_ADMIN → all doubts.
 * STUDENT     → own doubts (requires student_id).
 */
export async function getDoubts(role: string, studentId?: string): Promise<Doubt[]> {
  const params = new URLSearchParams({ role });
  if (studentId) params.set("student_id", studentId);

  const response = await apiFetch(`${API_BASE_URL}/doubts?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError("Failed to fetch doubts.", response.status);
  }

  return (await response.json()) as Doubt[];
}

/**
 * Submit a new doubt (STUDENT only).
 */
export async function submitDoubt(payload: {
  student_id: string;
  subject: string;
  body: string;
  role: string;
}): Promise<Doubt> {
  const response = await apiFetch(`${API_BASE_URL}/doubts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;
    throw new ApiError(
      errorBody?.message ?? "Failed to submit doubt.",
      response.status,
    );
  }

  return (await response.json()) as Doubt;
}

// ── Bundles API ───────────────────────────────────────────────

export type Bundle = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  course_count: number;
  student_count: number;
};

export type BundleCourse = {
  id: string;
  title: string;
  programme_type: string;
  status: string;
  order_index: number;
};

export type BundleEnrolledStudent = {
  id: string;
  name: string;
  email: string;
  roll_number: string | null;
  enrolled_at: string;
};

export type BundleTest = {
  id: string;
  title: string;
  question_count: number;
  published: boolean;
  duration_minutes: number | null;
  max_attempts: number | null;
  order_index: number;
};

export type BundleDetail = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  courses: BundleCourse[];
  enrolled_students: BundleEnrolledStudent[];
  tests: BundleTest[];
};

export async function getBundles(studentId?: string): Promise<Bundle[]> {
  const url = new URL(`${API_BASE_URL}/bundles`);
  if (studentId) url.searchParams.set("student_id", studentId);
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch bundles.", r.status);
  return (await r.json()) as Bundle[];
}

export async function getBundleById(id: string): Promise<BundleDetail> {
  const r = await apiFetch(`${API_BASE_URL}/bundles/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to fetch bundle.", r.status);
  }
  return (await r.json()) as BundleDetail;
}

export async function createBundle(payload: {
  name: string;
  description?: string;
}): Promise<Bundle> {
  const r = await apiFetch(`${API_BASE_URL}/bundles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to create bundle.", r.status);
  }
  return (await r.json()) as Bundle;
}

export async function addCourseToBundle(
  bundleId: string,
  courseId: string,
): Promise<{ added: boolean; students_enrolled: number }> {
  const r = await apiFetch(`${API_BASE_URL}/bundles/${bundleId}/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: courseId }),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to add course to bundle.", r.status);
  }
  return (await r.json()) as { added: boolean; students_enrolled: number };
}

export async function removeCourseFromBundle(
  bundleId: string,
  courseId: string,
): Promise<{ removed: boolean }> {
  const r = await apiFetch(
    `${API_BASE_URL}/bundles/${bundleId}/courses/${courseId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to remove course from bundle.", r.status);
  }
  return (await r.json()) as { removed: boolean };
}

export async function reorderBundleCourses(
  bundleId: string,
  ids: string[],
): Promise<void> {
  const r = await apiFetch(`${API_BASE_URL}/bundles/${bundleId}/courses/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to reorder courses.", r.status);
  }
}

export async function enrolStudentInBundle(
  bundleId: string,
  studentId: string,
): Promise<{ enrolled: boolean; courses_enrolled: number }> {
  const r = await apiFetch(`${API_BASE_URL}/bundles/${bundleId}/enrol`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId }),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to enrol student in bundle.", r.status);
  }
  return (await r.json()) as { enrolled: boolean; courses_enrolled: number };
}

export async function getBundleEnrolledStudents(bundleId: string): Promise<BundleEnrolledStudent[]> {
  const r = await apiFetch(`${API_BASE_URL}/bundles/${bundleId}/enrol`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch bundle students.", r.status);
  return (await r.json()) as BundleEnrolledStudent[];
}

export async function removeStudentFromBundle(
  bundleId: string,
  studentId: string,
): Promise<{ removed: boolean }> {
  const r = await apiFetch(
    `${API_BASE_URL}/bundles/${bundleId}/enrol/${studentId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to remove student from bundle.", r.status);
  }
  return (await r.json()) as { removed: boolean };
}

export async function addTestToBundle(
  bundleId: string,
  quizId: string,
): Promise<{ added: boolean }> {
  const r = await apiFetch(`${API_BASE_URL}/bundles/${bundleId}/tests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz_id: quizId }),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to add test to bundle.", r.status);
  }
  return (await r.json()) as { added: boolean };
}

export async function removeTestFromBundle(
  bundleId: string,
  quizId: string,
): Promise<{ removed: boolean }> {
  const r = await apiFetch(
    `${API_BASE_URL}/bundles/${bundleId}/tests/${quizId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to remove test from bundle.", r.status);
  }
  return (await r.json()) as { removed: boolean };
}

export async function getAvailableQuizzes(): Promise<Omit<Quiz, "questions">[]> {
  const r = await apiFetch(`${API_BASE_URL}/quizzes/available`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch available quizzes.", r.status);
  return (await r.json()) as Omit<Quiz, "questions">[];
}

// ── Bulk Assign API ────────────────────────────────────────────

export type StudentForBulk = {
  id: string;
  name: string;
  roll_number: string | null;
  programme_type: string | null;
  state: string | null;
  district: string | null;
  school_name: string | null;
};

export type StudentFilters = {
  state?: string;
  district?: string;
  school_id?: string;
  programme_type?: string;
  search?: string;
};

export async function getStudentsForBulk(
  filters: StudentFilters,
): Promise<StudentForBulk[]> {
  const url = new URL(`${API_BASE_URL}/users/students`);
  if (filters.state)          url.searchParams.set("state",          filters.state);
  if (filters.district)       url.searchParams.set("district",       filters.district);
  if (filters.school_id)      url.searchParams.set("school_id",      filters.school_id);
  if (filters.programme_type) url.searchParams.set("programme_type", filters.programme_type);
  if (filters.search)         url.searchParams.set("search",         filters.search);

  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to fetch students.", r.status);
  }
  return (await r.json()) as StudentForBulk[];
}

export type EnrolledItems = {
  courses: { id: string; title: string; programme_type: string; lesson_count: number }[];
  bundles: { id: string; name: string; course_count: number }[];
};

export async function getEnrolledItemsForStudents(
  studentIds: string[],
): Promise<EnrolledItems> {
  if (!studentIds.length) return { courses: [], bundles: [] };
  const url = new URL(`${API_BASE_URL}/enrolments/enrolled-items`);
  url.searchParams.set("student_ids", studentIds.join(","));
  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to fetch enrolled items.", r.status);
  }
  return (await r.json()) as EnrolledItems;
}

export async function bulkRemove(payload: {
  student_ids: string[];
  course_ids?: string[];
  bundle_ids?: string[];
}): Promise<{ removed_courses: number; removed_bundles: number; not_enrolled: number }> {
  const r = await apiFetch(`${API_BASE_URL}/enrolments/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to bulk remove.", r.status);
  }
  return (await r.json()) as { removed_courses: number; removed_bundles: number; not_enrolled: number };
}

export async function bulkEnrol(payload: {
  student_ids: string[];
  course_ids?: string[];
  bundle_ids?: string[];
}): Promise<{ enrolled_courses: number; enrolled_bundles: number; skipped: number }> {
  const r = await apiFetch(`${API_BASE_URL}/enrolments/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to bulk enrol.", r.status);
  }
  return (await r.json()) as { enrolled_courses: number; enrolled_bundles: number; skipped: number };
}

// ── Student Report PDFs ────────────────────────────────────────
//
// The report endpoints are protected by the same bearer-token auth as the rest
// of the API. A plain `window.open` would NOT carry the Authorization header,
// so the PDF is fetched as a blob through `apiFetch` (which injects the token)
// and the resulting object URL is opened/downloaded by the caller.

export type StudentReportPdf = { blob: Blob; filename: string };

function extractFilename(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition");
  if (header) {
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return fallback;
}

/**
 * Download a course report PDF for a single student.
 * Backend: GET /reports/students/:studentId/pdf?scope=course&ref_id=<courseId>
 */
export async function downloadStudentCourseReportPdf(
  studentId: string,
  courseId: string,
): Promise<StudentReportPdf> {
  const url = new URL(`${API_BASE_URL}/reports/students/${studentId}/pdf`);
  url.searchParams.set("scope", "course");
  url.searchParams.set("ref_id", courseId);

  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to download course report.", r.status);
  }
  return { blob: await r.blob(), filename: extractFilename(r, "course-report.pdf") };
}

/**
 * Download the current-month period report PDF for a single student.
 * Backend: GET /reports/students/:studentId/period/pdf?type=MONTHLY
 */
export async function downloadStudentMonthlyReportPdf(
  studentId: string,
): Promise<StudentReportPdf> {
  const url = new URL(`${API_BASE_URL}/reports/students/${studentId}/period/pdf`);
  url.searchParams.set("type", "MONTHLY");

  const r = await apiFetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to download monthly report.", r.status);
  }
  return { blob: await r.blob(), filename: extractFilename(r, "monthly-report.pdf") };
}
