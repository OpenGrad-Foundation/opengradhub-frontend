import type {
  CurrentUserResponse,
  SignInPayload,
  SignInResponse,
  SignUpPayload,
  SignUpResponse,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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
  const response = await fetch(`${API_BASE_URL}/users/me`, {
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new ApiError("Failed to fetch users.", response.status);
  }

  return (await response.json()) as SafeUser[];
}

/**
 * Fetch a single user by ID (mock-friendly — no auth required).
 */
export async function getMe(id: string): Promise<SafeUser> {
  const response = await fetch(`${API_BASE_URL}/users/me?id=${encodeURIComponent(id)}`, {
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
  caller_role: string;
  caller_id: string;
  role?: string;
  programme_type?: string;
  status?: string;
  school_id?: string;
  zone?: string;
  from?: string;
  to?: string;
};

function buildAnalyticsParams(filters: AnalyticsStudentFilters) {
  const params = new URLSearchParams({
    caller_role: filters.caller_role,
    caller_id: filters.caller_id,
  });

  if (filters.role) params.set("role", filters.role);
  if (filters.programme_type) params.set("programme_type", filters.programme_type);
  if (filters.status) params.set("status", filters.status);
  if (filters.school_id) params.set("school_id", filters.school_id);
  if (filters.zone) params.set("zone", filters.zone);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return params;
}

export async function getAnalyticsSchools(
  callerRole: string,
  callerId: string,
): Promise<AnalyticsSchool[]> {
  const params = new URLSearchParams({ caller_role: callerRole, caller_id: callerId });
  const response = await fetch(`${API_BASE_URL}/analytics/schools?${params.toString()}`);

  if (!response.ok) {
    throw new ApiError("Failed to fetch schools.", response.status);
  }

  return (await response.json()) as AnalyticsSchool[];
}

export async function getAnalyticsStudents(
  filters: AnalyticsStudentFilters,
): Promise<AnalyticsStudent[]> {
  const params = buildAnalyticsParams(filters);
  const response = await fetch(`${API_BASE_URL}/analytics/students?${params.toString()}`);

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
  const response = await fetch(
    `${API_BASE_URL}/analytics/students/export?${params.toString()}`,
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
  if (programmeType) url.searchParams.set("programme_type", programmeType);
  if (studentId) url.searchParams.set("student_id", studentId);
  if (createdBy) url.searchParams.set("created_by", createdBy);
  if (allStatuses) url.searchParams.set("all_statuses", "true");

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new ApiError("Failed to fetch courses.", response.status);
  }

  return (await response.json()) as Course[];
}

/**
 * Enrol a student in a course.
 */
export async function assignCourse(
  studentId: string,
  courseId: string,
  assignedBy: string,
): Promise<{ id: string; student_id: string; course_id: string; enrolled_at: string }> {
  const response = await fetch(`${API_BASE_URL}/enrolments`, {
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
  const response = await fetch(`${API_BASE_URL}/users/${studentId}/enrolments`, {
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

export async function getStudentCourses(studentId: string): Promise<StudentCourse[]> {
  const r = await fetch(`${API_BASE_URL}/students/${studentId}/courses`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch student courses.", r.status);
  return (await r.json()) as StudentCourse[];
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
};

export async function getCourseOverview(courseId: string, studentId: string): Promise<ModuleWithProgress[]> {
  const url = new URL(`${API_BASE_URL}/courses/${courseId}/overview`);
  url.searchParams.set("student_id", studentId);
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch course overview.", r.status);
  return (await r.json()) as ModuleWithProgress[];
}

/**
 * Create a new course (DRAFT by default).
 */
export async function getCourseById(id: string): Promise<Course> {
  const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
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
  role: string;
}): Promise<Course> {
  const response = await fetch(`${API_BASE_URL}/courses`, {
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
  const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
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
  created_by?: string;
  options?: CreateOptionPayload[];
  children?: CreateChildPayload[];
};

export type QuestionFilters = {
  bank?: boolean;
  question_type?: string;
  programme_type?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
};

export async function getQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
  const url = new URL(`${API_BASE_URL}/questions`);
  if (filters.bank) url.searchParams.set("bank", "true");
  if (filters.question_type) url.searchParams.set("question_type", filters.question_type);
  if (filters.programme_type) url.searchParams.set("programme_type", filters.programme_type);
  if (filters.subject) url.searchParams.set("subject", filters.subject);
  if (filters.topic) url.searchParams.set("topic", filters.topic);
  if (filters.difficulty) url.searchParams.set("difficulty", filters.difficulty);
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new ApiError("Failed to fetch questions.", response.status);
  return (await response.json()) as Question[];
}

export async function createQuestion(payload: CreateQuestionPayload): Promise<Question> {
  const response = await fetch(`${API_BASE_URL}/questions`, {
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
  const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
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
  const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
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

export async function getLiveClasses(callerId: string, callerRole: string): Promise<LiveClass[]> {
  const url = new URL(`${API_BASE_URL}/live-classes`);
  url.searchParams.set("caller_id", callerId);
  url.searchParams.set("caller_role", callerRole);
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch live classes.", r.status);
  return (await r.json()) as LiveClass[];
}

export async function getNextLiveClass(studentId: string): Promise<LiveClass | null> {
  const url = new URL(`${API_BASE_URL}/live-classes/next`);
  url.searchParams.set("studentId", studentId);
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json() as LiveClass | null;
  return data ?? null;
}

export async function joinLiveClass(
  liveClassId: string,
  studentId: string,
): Promise<{ meeting_url: string; live_class_id: string }> {
  const r = await fetch(`${API_BASE_URL}/live-classes/${liveClassId}/join`, {
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
  caller_id: string;
  caller_role: string;
}): Promise<LiveClass> {
  const r = await fetch(`${API_BASE_URL}/live-classes`, {
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
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) return [];
  return (await r.json()) as Notification[];
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const url = new URL(`${API_BASE_URL}/notifications/unread-count`);
  url.searchParams.set("recipientId", recipientId);
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) return 0;
  const data = await r.json() as { count: number };
  return data.count;
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
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

export async function getAssignments(callerId: string, callerRole: string): Promise<Assignment[]> {
  const url = new URL(`${API_BASE_URL}/assignments`);
  url.searchParams.set("caller_id", callerId);
  url.searchParams.set("caller_role", callerRole);
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch assignments.", r.status);
  return (await r.json()) as Assignment[];
}

export async function getAssignmentById(id: string, studentId?: string): Promise<Assignment> {
  const url = new URL(`${API_BASE_URL}/assignments/${id}`);
  if (studentId) url.searchParams.set("student_id", studentId);
  const r = await fetch(url.toString(), { cache: "no-store" });
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
  caller_id: string;
  caller_role: string;
}): Promise<Assignment> {
  const r = await fetch(`${API_BASE_URL}/assignments`, {
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
  const r = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submit`, {
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
  const r = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submissions`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch submissions.", r.status);
  return (await r.json()) as Submission[];
}

export async function patchSubmission(
  assignmentId: string,
  submissionId: string,
  payload: { score?: number; feedback?: string; status?: string; graded_by?: string },
): Promise<Submission> {
  const r = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submissions/${submissionId}`, {
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
};

export async function getQuizzes(params: { module_id?: string; quiz_type?: string } = {}): Promise<Omit<Quiz, "questions">[]> {
  const url = new URL(`${API_BASE_URL}/quizzes`);
  if (params.module_id) url.searchParams.set("module_id", params.module_id);
  if (params.quiz_type) url.searchParams.set("quiz_type", params.quiz_type);
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch quizzes.", r.status);
  return (await r.json()) as Omit<Quiz, "questions">[];
}

export async function getQuizById(id: string): Promise<Quiz> {
  const r = await fetch(`${API_BASE_URL}/quizzes/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to fetch quiz.", r.status);
  }
  return (await r.json()) as Quiz;
}

export async function createQuiz(payload: CreateQuizPayload): Promise<Quiz> {
  const r = await fetch(`${API_BASE_URL}/quizzes`, {
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
  },
): Promise<Quiz> {
  const r = await fetch(`${API_BASE_URL}/quizzes/${id}`, {
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
  const r = await fetch(`${API_BASE_URL}/quizzes/${quizId}/questions`, {
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

export async function addQuizQuestionFromBank(
  quizId: string,
  questionId: string,
): Promise<Question> {
  const r = await fetch(`${API_BASE_URL}/quizzes/${quizId}/questions/from-bank`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId }),
    cache: "no-store",
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Failed to copy from bank.", r.status);
  }
  return (await r.json()) as Question;
}

export async function reorderQuizQuestions(quizId: string, ids: string[]): Promise<void> {
  const r = await fetch(`${API_BASE_URL}/quizzes/${quizId}/questions/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    cache: "no-store",
  });
  if (!r.ok) throw new ApiError("Failed to reorder questions.", r.status);
}

export async function removeQuizQuestion(quizId: string, questionId: string): Promise<void> {
  const r = await fetch(`${API_BASE_URL}/quizzes/${quizId}/questions/${questionId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!r.ok) throw new ApiError("Failed to remove question.", r.status);
}

export async function publishQuiz(quizId: string): Promise<Quiz> {
  const r = await fetch(`${API_BASE_URL}/quizzes/${quizId}/publish`, {
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
  const r = await fetch(`${API_BASE_URL}/lessons/${lessonId}`, { cache: "no-store" });
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
  const r = await fetch(`${API_BASE_URL}/lesson-progress`, {
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
};

export async function getQuizAttempts(quizId: string, studentId: string): Promise<QuizAttempt[]> {
  const url = new URL(`${API_BASE_URL}/quiz-attempts`);
  url.searchParams.set("quiz_id", quizId);
  url.searchParams.set("student_id", studentId);
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to fetch quiz attempts.", r.status);
  return (await r.json()) as QuizAttempt[];
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
  const r = await fetch(`${API_BASE_URL}/courses/${courseId}/modules`, { cache: "no-store" });
  if (!r.ok) throw new ApiError("Failed to load modules.", r.status);
  return (await r.json()) as CourseModule[];
}

export async function createModule(courseId: string, title: string): Promise<CourseModule> {
  const r = await fetch(`${API_BASE_URL}/courses/${courseId}/modules`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to create module.", r.status); }
  return (await r.json()) as CourseModule;
}

export async function reorderModules(courseId: string, ids: string[]): Promise<void> {
  await fetch(`${API_BASE_URL}/courses/${courseId}/modules/reorder`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }), cache: "no-store",
  });
}

export async function updateModule(moduleId: string, title: string): Promise<CourseModule> {
  const r = await fetch(`${API_BASE_URL}/modules/${moduleId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to update module.", r.status); }
  return (await r.json()) as CourseModule;
}

export async function deleteModule(moduleId: string): Promise<void> {
  const r = await fetch(`${API_BASE_URL}/modules/${moduleId}`, { method: "DELETE", cache: "no-store" });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to delete module.", r.status); }
}

export async function createLesson(
  moduleId: string,
  payload: { title: string; youtube_url: string; duration_minutes?: number; notes_html?: string },
): Promise<CourseLesson> {
  const r = await fetch(`${API_BASE_URL}/modules/${moduleId}/lessons`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to create lesson.", r.status); }
  return (await r.json()) as CourseLesson;
}

export async function reorderLessons(moduleId: string, ids: string[]): Promise<void> {
  await fetch(`${API_BASE_URL}/modules/${moduleId}/lessons/reorder`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }), cache: "no-store",
  });
}

export async function updateLesson(
  lessonId: string,
  payload: { title?: string; youtube_url?: string; duration_minutes?: number | null; notes_html?: string | null },
): Promise<CourseLesson> {
  const r = await fetch(`${API_BASE_URL}/lessons/${lessonId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), cache: "no-store",
  });
  if (!r.ok) { const e = await r.json().catch(() => null) as { message?: string } | null; throw new ApiError(e?.message ?? "Failed to update lesson.", r.status); }
  return (await r.json()) as CourseLesson;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const r = await fetch(`${API_BASE_URL}/lessons/${lessonId}`, { method: "DELETE", cache: "no-store" });
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

  const response = await fetch(url.toString(), { cache: "no-store" });

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
  const response = await fetch(`${API_BASE_URL}/resources`, {
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
  const response = await fetch(`${API_BASE_URL}/users`, {
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

/**
 * Bulk upload users via CSV file.
 */
export async function bulkUploadUsers(
  file: File,
): Promise<{ created: number; skipped: number; errors: string[]; credentials: Array<{ name: string; rollNumber: string; tempPassword?: string }> }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/users/bulk`, {
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

  const response = await fetch(url, {
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
  const response = await fetch(`${API_BASE_URL}/announcements`, {
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

  const response = await fetch(`${API_BASE_URL}/doubts?${params.toString()}`, {
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
  const response = await fetch(`${API_BASE_URL}/doubts`, {
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
