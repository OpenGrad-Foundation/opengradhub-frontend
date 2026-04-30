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
  status: string;
  email: string | null;
  phone: string | null;
  created_at: string;
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

// ── Courses API ────────────────────────────────────────────────

export type Course = {
  id: string;
  title: string;
  description: string | null;
  programme_type: string;
  cover_image_url: string | null;
  locking_mode: string;
  access_type: string;
  created_at: string;
};

/**
 * Fetch all active courses. Optionally filter by programme type.
 */
export async function getCourses(programmeType?: string): Promise<Course[]> {
  const url = new URL(`${API_BASE_URL}/courses`);
  if (programmeType) url.searchParams.set("programme_type", programmeType);

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new ApiError("Failed to fetch courses.", response.status);
  }

  return (await response.json()) as Course[];
}

/**
 * Create a new course (DRAFT by default).
 */
export async function createCourse(payload: {
  title: string;
  description?: string;
  programme_type: string;
  locking_mode?: string;
  access_type?: string;
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

    throw new ApiError(
      errorBody?.message ?? "Failed to create course.",
      response.status,
    );
  }

  return (await response.json()) as Course;
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
  email: string;
  phone?: string;
  role: string;
  programme_type?: string;
  school_id?: string;
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
): Promise<{ created: number; skipped: number; errors: string[] }> {
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
  };
}

/**
 * Download CSV template for bulk user upload.
 */
export function getUserTemplateUrl(): string {
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
