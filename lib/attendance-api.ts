/**
 * Attendance tab API layer — typed wrappers over apiFetch (authed) and plain
 * fetch (public token endpoints, no auth header on purpose).
 * Types mirror opengradhub-backend/src/attendance service return shapes.
 */
import { API_BASE_URL, apiFetch, ApiError } from "./api";

// ── Types (mirror backend) ────────────────────────────────────────────────────

export type LinkRow = {
  id: string;
  live_class_id: string;
  school_id: string;
  school_name: string;
  token: string;
  attended_at: string | null;
  attended_via: "LINK" | "STAFF" | null;
  origin: "DERIVED" | "MANUAL";
};

export type PublicLinkView = {
  class_title: string;
  scheduled_at: string;
  duration_minutes: number;
  school_name: string;
  attended: boolean;
  window_open: boolean;
};

export type GridRow = {
  student_id: string;
  short_code: string;
  name: string;
  marks: Record<string, boolean | null>;
};

export type ExtractedRow = {
  short_code: string | null;
  name: string | null;
  marks: Record<string, boolean | null>;
};

export type UploadSummary = {
  id: string;
  school_id: string;
  school_name: string;
  period_start: string;
  period_end: string;
  status: "PENDING_REVIEW" | "COMMITTED" | "DISCARDED";
  model: string | null;
  created_at: string;
};

export type UploadDetail = UploadSummary & {
  grid: GridRow[];
  unmatched: ExtractedRow[];
};

export type CommitEntry = { student_id: string; date: string; present: boolean };

export type SheetData = {
  school_name: string;
  month: string;
  students: { short_code: string; name: string }[];
};

export type SchoolSummaryRow = {
  school_id: string;
  school_name: string;
  link_attended: number;
  link_total: number;
  register_present: number;
  register_total: number;
};

export type MyAttendanceStats = {
  register: {
    percent: number | null;
    months: { month: string; present: number; total: number }[];
  };
  school_links: { attended: number; total: number };
  quizzes: {
    assigned: number;
    completed: number;
    items: { id: string; title: string; completed: boolean }[];
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch { /* keep default */ }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// ── Authed: stream 1 (links) ─────────────────────────────────────────────────

export async function getClassLinks(classId: string): Promise<LinkRow[]> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/live-classes/${classId}/links`));
}

export async function generateClassLinks(classId: string): Promise<{ added: number; removed: number }> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/live-classes/${classId}/links/generate`, { method: "POST" }));
}

export async function addSchoolLink(classId: string, schoolId: string): Promise<LinkRow> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/live-classes/${classId}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ school_id: schoolId }),
  }));
}

export async function removeLink(linkId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/attendance/links/${linkId}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
}

export async function overrideLink(linkId: string, attended: boolean): Promise<LinkRow> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/links/${linkId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attended }),
  }));
}

export async function regenerateLink(linkId: string): Promise<LinkRow> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/links/${linkId}/regenerate`, { method: "POST" }));
}

// ── Authed: stream 2 (registers) ─────────────────────────────────────────────

export async function getSheetData(schoolId: string, month: string): Promise<SheetData> {
  return json(await apiFetch(
    `${API_BASE_URL}/attendance/registers/sheet?school_id=${encodeURIComponent(schoolId)}&month=${encodeURIComponent(month)}`,
  ));
}

export async function uploadRegister(args: {
  school_id: string;
  period_start: string;
  period_end: string;
  image: File;
}): Promise<UploadDetail> {
  const form = new FormData();
  form.append("school_id", args.school_id);
  form.append("period_start", args.period_start);
  form.append("period_end", args.period_end);
  form.append("image", args.image);
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers`, { method: "POST", body: form }));
}

export async function listRegisterUploads(filters: { school_id?: string; status?: string }): Promise<UploadSummary[]> {
  const params = new URLSearchParams();
  if (filters.school_id) params.set("school_id", filters.school_id);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers${qs ? `?${qs}` : ""}`));
}

export async function getRegisterUpload(id: string): Promise<UploadDetail> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers/${id}`));
}

export async function commitRegister(id: string, entries: CommitEntry[]): Promise<UploadDetail> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers/${id}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  }));
}

export async function discardRegister(id: string): Promise<{ status: "DISCARDED" }> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers/${id}/discard`, { method: "POST" }));
}

export async function retryRegisterExtraction(id: string): Promise<UploadDetail> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers/${id}/retry`, { method: "POST" }));
}

// ── Authed: stats ────────────────────────────────────────────────────────────

export async function getAttendanceSummary(): Promise<{ schools: SchoolSummaryRow[] }> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/summary`));
}

export async function getMyAttendance(): Promise<MyAttendanceStats> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/me`));
}

// ── Public (token link page — deliberately NO auth header) ──────────────────

export async function getPublicAttendance(token: string): Promise<PublicLinkView> {
  return json(await fetch(`${API_BASE_URL}/public/attendance/${encodeURIComponent(token)}`));
}

export async function markPublicAttendance(token: string): Promise<{ attended: true }> {
  return json(await fetch(`${API_BASE_URL}/public/attendance/${encodeURIComponent(token)}/mark`, { method: "POST" }));
}
