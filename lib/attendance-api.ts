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
  /** Observed span of the extracted marks — null until anything readable exists. */
  period_start: string | null;
  period_end: string | null;
  status: "PENDING_REVIEW" | "COMMITTED" | "DISCARDED";
  model: string | null;
  created_at: string;
};

export type UploadDetail = UploadSummary & {
  grid: GridRow[];
  unmatched: ExtractedRow[];
  /** The month this upload resolves to: the reviewer's override, or the inferred one. */
  month: string | null;
  override_month: string | null;
  /** REMAP re-dated the model's columns; SELECT scoped to a month already covered. */
  override_mode: "REMAP" | "SELECT" | null;
  /** Columns lost to a re-date because the day doesn't exist in the target month. */
  dropped_days: number;
  /**
   * What may be committed — the whole allowed month, clamped server-side.
   * Deliberately wider than the observed span so a missed date can be added.
   */
  allowed_start: string | null;
  allowed_end: string | null;
  min_date: string;
  max_date: string;
  dropped_invalid: number;
  dropped_other_month: number;
  other_months: string[];
  tie_broken: boolean;
  /** Set when the draft is empty because extraction failed, not because the sheet was blank. */
  extraction_error: string | null;
};

export type CommitEntry = { student_id: string; date: string; present: boolean };

/** Mirror of the backend REGISTER_TEMPLATE_V2 shape — values always come from the server. */
export type RegisterDescriptor = {
  version: number;
  page: { w: number; h: number };
  margin: number;
  fiducial: { tl: number; other: number };
  qr: { x: number; y: number; size: number };
  header: {
    titleY: number;
    monthComb: { x: number; y: number; boxW: number; boxH: number; gap: number; yySkip: number };
  };
  table: {
    x: number; y: number; rowH: number; headerH: number;
    codeW: number; nameW: number; dateColW: number;
    comb: { boxW: number; boxH: number; gap: number; slashGap: number; yOffset: number };
    mark: { box: number; gap: number };
  };
};

export type SheetPage = {
  page: number;
  row_range: [number, number];
  qr_content: string;
  students: { short_code: string; name: string }[];
};

export type SheetData = {
  school_name: string;
  /** Null when the sheet leaves the month blank for the school to write in. */
  month: string | null;
  students: { short_code: string; name: string }[];
  descriptor: RegisterDescriptor;
  template_version: number;
  pages: SheetPage[];
};

export type RegisterGapRow = {
  school_id: string;
  school_name: string;
  /** Latest month with committed entries. Null = never submitted. */
  last_month: string | null;
  /** Months from last_month to due_month. Null = never. <= 0 = a later month exists. */
  months_behind: number | null;
};

export type RegisterGapsView = {
  due_month: string;
  total: number;
  submitted: number;
  behind_total: number;
  /** Capped server-side; behind_total carries the real count. */
  schools: RegisterGapRow[];
};

export type SchoolRegisterView = {
  school_name: string;
  month: string | null;
  available_months: string[];
  dates: string[];
  students: {
    student_id: string;
    name: string;
    present: number;
    total: number;
    marks: Record<string, boolean>;
  }[];
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

/** `month` is optional — the printed sheet leaves it blank for the school. */
export async function getSheetData(schoolId: string, month?: string | null): Promise<SheetData> {
  const params = new URLSearchParams({ school_id: schoolId });
  if (month) params.set("month", month);
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers/sheet?${params}`));
}

/**
 * The period is inferred from the sheet, so only the school is sent. The field
 * is still named `image` server-side; PDFs and spreadsheets use it too.
 */
export async function uploadRegister(args: { school_id: string; image: File }): Promise<UploadDetail> {
  const form = new FormData();
  form.append("school_id", args.school_id);
  form.append("image", args.image);
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers`, { method: "POST", body: form }));
}

/** Corrects the month the model read off the sheet; returns the updated draft. */
export async function setRegisterMonth(id: string, month: string): Promise<UploadDetail> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers/${id}/month`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month }),
  }));
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

/** Schools owing a register for the last completed month — the dashboard widget. */
export async function getRegisterGaps(): Promise<RegisterGapsView> {
  return json(await apiFetch(`${API_BASE_URL}/attendance/registers/gaps`));
}

/** Committed register attendance for one school — the school detail page panel. */
export async function getSchoolRegister(
  schoolId: string,
  month?: string | null,
): Promise<SchoolRegisterView> {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  const qs = params.toString();
  return json(await apiFetch(
    `${API_BASE_URL}/attendance/schools/${encodeURIComponent(schoolId)}/register${qs ? `?${qs}` : ""}`,
  ));
}

// ── Public (token link page — deliberately NO auth header) ──────────────────

export async function getPublicAttendance(token: string): Promise<PublicLinkView> {
  return json(await fetch(`${API_BASE_URL}/public/attendance/${encodeURIComponent(token)}`));
}

export async function markPublicAttendance(token: string): Promise<{ attended: true }> {
  return json(await fetch(`${API_BASE_URL}/public/attendance/${encodeURIComponent(token)}/mark`, { method: "POST" }));
}
