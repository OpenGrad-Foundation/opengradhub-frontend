import { API_BASE_URL, ApiError, apiFetch } from "./api";

export type TrackerFieldType = "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "url";
export type TrackerFieldSource = "profile" | "identity" | "input";
export type TrackerTargetType = "student" | "school" | "fellow";

// Human labels for auto-filled (profile) source paths — shown instead of the raw `student.name` key.
export const PROFILE_PATH_LABELS: Record<string, string> = {
  "student.name": "Student name",
  "student.category": "Student category",
  "student.district": "District",
  "student.contact": "Student contact",
  "school.name": "School name",
  "school.code": "School code",
  "fellow.name": "Staff name",
  "fellow.email": "Staff email",
};
export const profilePathLabel = (path: string): string => PROFILE_PATH_LABELS[path] ?? path;
export type TrackerCompletionStyle = "checklist" | "workflow";
export type TrackerPriority = "low" | "medium" | "high";

export type TrackerVisibleIf = {
  field: string;
  op: "eq" | "neq" | "in" | "nonEmpty";
  value?: unknown;
};

export type TrackerTemplate = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  target_type: TrackerTargetType;
  completion_style: TrackerCompletionStyle;
  workflow_statuses: string[] | null;
  done_status: string | null;
  deadline: string | null;
  recurrence_frequency: string | null;
  priority: TrackerPriority;
  status: "draft" | "active" | "archived";
  require_photo: boolean;
  require_location: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TrackerField = {
  id?: string;
  template_id?: string;
  field_key: string;
  label: string;
  field_type: TrackerFieldType;
  options: string[] | null;
  source: TrackerFieldSource;
  source_path: string | null;
  required: boolean;
  visible_if: TrackerVisibleIf | null;
  sort_order: number;
};

export type TrackerTemplateDetail = {
  template: TrackerTemplate;
  fields: TrackerField[];
};

export type TrackerCell = {
  field_key: string;
  label: string;
  value: unknown;
  locked: boolean;
  notSet: boolean;
};

export type TrackerGridRow = {
  record_id: string;
  status: string;
  cells: TrackerCell[];
  blocked: boolean;
  blocker: { id: string; text: string } | null;
  school_name: string | null;
  target_name: string | null;
  /** The row's target entity id (student/school/fellow user id). Present for student-target
   *  rows so a fellow can open the "Additional Student Details" form from a locked/not-set cell.
   *  Optional for backward-compatibility while the grid projection is updated to emit it. */
  target_id?: string | null;
  lifecycle: "done" | "blocked" | "overdue" | "not_started" | "in_progress";
};

export type TrackerGrid = {
  columns: TrackerField[];
  rows: TrackerGridRow[];
};

export type TrackerBlocker = {
  id: string;
  record_id: string;
  text: string;
  status: "open" | "cleared";
  raised_by: string;
  raised_at: string;
  cleared_by: string | null;
  cleared_at: string | null;
  escalated_to_zm_at: string | null;
  escalated_to_pm_at: string | null;
  template_id?: string | null;
  task_name?: string | null;
  target_type?: TrackerTargetType | null;
  target_name?: string | null;
};

export type TrackerSummaryRow = {
  fellow_id: string | null;
  fellow_name: string | null;
  done: number;
  pending: number;
  blocked: number;
  overdue: number;
};

export type TrackerRecurrence = "daily" | "weekly" | "monthly";

export type CreateTrackerTemplateInput = {
  code: string;
  name: string;
  description?: string;
  target_type: TrackerTargetType;
  completion_style: TrackerCompletionStyle;
  workflow_statuses?: string[];
  done_status?: string;
  deadline?: string;
  recurrence_frequency?: TrackerRecurrence;
  priority?: TrackerPriority;
  require_photo?: boolean;
  require_location?: boolean;
  status?: "draft" | "active" | "archived";
};

export type TrackerTemplatePatch = {
  name?: string;
  description?: string | null;
  deadline?: string | null;
  status?: "draft" | "active" | "archived";
  recurrence_frequency?: TrackerRecurrence | null;
  require_photo?: boolean;
  require_location?: boolean;
};

export type TrackerFieldPatch = {
  label?: string;
  required?: boolean;
  options?: string[] | null;
  sort_order?: number;
};

export type AddTrackerFieldsInput = { fields: TrackerField[] };
export type TrackerBatchEdit = { record_id: string; values?: Record<string, unknown>; status?: string };

async function trackerJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message ?? "Tracker request failed.";
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  // Void endpoints (clear blocker, add/update/delete field, update template) return an
  // empty body with a 200/201; res.json() would throw on that, so parse defensively.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function jsonInit(method: "POST" | "PATCH" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function getTrackerTemplates(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return trackerJson<TrackerTemplate[]>(`/tracker/templates${qs}`);
}

export function getTrackerTemplate(id: string) {
  return trackerJson<TrackerTemplateDetail>(`/tracker/templates/${encodeURIComponent(id)}`);
}

export function createTrackerTemplate(input: CreateTrackerTemplateInput) {
  return trackerJson<{ id: string }>("/tracker/templates", jsonInit("POST", input));
}

export function deleteTrackerTemplate(id: string) {
  return trackerJson<void>(`/tracker/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function addTrackerFields(templateId: string, input: AddTrackerFieldsInput) {
  return trackerJson<void>(`/tracker/templates/${encodeURIComponent(templateId)}/fields`, jsonInit("POST", input));
}

export function updateTrackerTemplate(id: string, patch: TrackerTemplatePatch) {
  return trackerJson<void>(`/tracker/templates/${encodeURIComponent(id)}`, jsonInit("PATCH", patch));
}

export function updateTrackerField(templateId: string, fieldId: string, patch: TrackerFieldPatch) {
  return trackerJson<void>(
    `/tracker/templates/${encodeURIComponent(templateId)}/fields/${encodeURIComponent(fieldId)}`,
    jsonInit("PATCH", patch),
  );
}

export function deleteTrackerField(templateId: string, fieldId: string) {
  return trackerJson<void>(
    `/tracker/templates/${encodeURIComponent(templateId)}/fields/${encodeURIComponent(fieldId)}`,
    { method: "DELETE" },
  );
}

export function assignTrackerTargets(templateId: string, targetIds: string[]) {
  return trackerJson<{ created: number; skipped: number }>(
    `/tracker/templates/${encodeURIComponent(templateId)}/assign`,
    jsonInit("POST", { targetIds }),
  );
}

export function getTrackerGrid(templateId: string, fellowId?: string) {
  const q = fellowId ? `?fellowId=${encodeURIComponent(fellowId)}` : "";
  return trackerJson<TrackerGrid>(`/tracker/templates/${encodeURIComponent(templateId)}/grid${q}`);
}

export function saveTrackerBatch(edits: TrackerBatchEdit[]) {
  return trackerJson<{ saved: number }>("/tracker/records/batch", jsonInit("POST", { edits }));
}

export type TrackerProofPhoto = { id: string; url: string; created_at: string; created_by: string };
export type TrackerProofLocation = { lat: number; lng: number; accuracy_m: number | null; captured_at: string };
export type TrackerProofs = { photos: TrackerProofPhoto[]; location: TrackerProofLocation | null };

export function getTrackerProofs(recordId: string) {
  return trackerJson<TrackerProofs>(`/tracker/records/${encodeURIComponent(recordId)}/proofs`);
}

export async function uploadProofPhoto(recordId: string, file: Blob): Promise<{ id: string }> {
  const form = new FormData();
  // Filename hints the extension; the backend derives the real ext from mime.
  form.append("photo", file, "proof.jpg");
  // NOTE: do NOT set Content-Type — the browser sets the multipart boundary.
  const res = await apiFetch(`${API_BASE_URL}/tracker/records/${encodeURIComponent(recordId)}/proofs/photo`, {
    method: "POST", body: form, cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Photo upload failed.";
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as { id: string };
}

export function captureProofLocation(recordId: string, body: { lat: number; lng: number; accuracy_m?: number }) {
  return trackerJson<{ ok: true }>(
    `/tracker/records/${encodeURIComponent(recordId)}/proofs/location`, jsonInit("POST", body));
}

export function deleteProofPhoto(recordId: string, proofId: string) {
  return trackerJson<{ ok: true }>(
    `/tracker/records/${encodeURIComponent(recordId)}/proofs/${encodeURIComponent(proofId)}`, { method: "DELETE" });
}

export function raiseTrackerBlocker(recordId: string, text: string) {
  return trackerJson<{ id: string }>(
    `/tracker/records/${encodeURIComponent(recordId)}/blocker`,
    jsonInit("POST", { text }),
  );
}

export function clearTrackerBlocker(blockerId: string) {
  return trackerJson<void>(`/tracker/blockers/${encodeURIComponent(blockerId)}/clear`, { method: "POST" });
}

export function getTrackerMineBlockers() {
  return trackerJson<TrackerBlocker[]>("/tracker/blockers/mine");
}

export function getTrackerQueueBlockers() {
  return trackerJson<TrackerBlocker[]>("/tracker/blockers/queue");
}

export function getTrackerSummary(templateId: string) {
  return trackerJson<TrackerSummaryRow[]>(`/tracker/templates/${encodeURIComponent(templateId)}/summary`);
}

export type TrackerOverview = {
  totals: { done: number; pending: number; blocked: number; overdue: number };
  perTask: Array<{ template_id: string; name: string; done: number; pending: number; blocked: number; overdue: number }>;
};

export function getTrackerOverview() {
  return trackerJson<TrackerOverview>("/tracker/summary/overview");
}

export type TrackerAssignable = {
  id: string;
  name: string;
  state: string | null;
  /** For a user (staff) target: the member's role code, e.g. FELLOW / ZONAL_MANAGER — lets the
   *  picker group and label ZMs vs fellows. Absent for school / student targets. */
  role?: string | null;
  district?: string | null;
  programme?: string | null;
  school_id?: string | null;
  school_name?: string | null;
};

export function getTrackerAssignable(targetType: TrackerTargetType) {
  return trackerJson<TrackerAssignable[]>(`/tracker/assignable?targetType=${encodeURIComponent(targetType)}`);
}

export type TrackerMyTask = {
  record_id: string;
  template_id: string;
  name: string;
  target_name: string | null;
  school_name: string | null;
  issued_at: string;
  deadline: string | null;
  target_type: TrackerTargetType;
  priority: TrackerPriority;
  status: string;
  blocked: boolean;
  lifecycle: "done" | "blocked" | "overdue" | "not_started" | "in_progress";
};

export function getTrackerMyTasks() {
  return trackerJson<TrackerMyTask[]>("/tracker/my-tasks");
}

export type TrackerFellowSummary = TrackerAssignable & { total: number; done: number; pending: number; last_nudged_all_at: string | null; };

export function getTrackerFellows() {
  return trackerJson<TrackerFellowSummary[]>("/tracker/fellows");
}

export function getTrackerFellowTasks(fellowId: string) {
  return trackerJson<TrackerMyTask[]>(`/tracker/fellows/${encodeURIComponent(fellowId)}/tasks`);
}

// --- PM/Admin: All Tasks + ZM roster ---------------------------------------

export type TrackerAllTasksFilters = {
  doerType?: "zm" | "fellow"; zmId?: string; fellowId?: string;
  state?: string; district?: string; priority?: TrackerPriority;
  status?: "done" | "pending" | "overdue" | "blocked";
  q?: string; groupBy?: "zm" | "fellow"; page?: number; limit?: number;
};

export type TrackerAllTaskRow = {
  template_id: string; task_name: string;
  doer_id: string | null; doer_name: string | null;
  doer_role: "FELLOW" | "ZONAL_MANAGER" | null;
  zm_id: string | null; zm_name: string | null;
  state: string | null; district: string | null;
  priority: TrackerPriority; deadline: string | null;
  total: number; done: number; blocked: number; overdue: number; pending: number;
  rolled_state: "done" | "pending" | "overdue" | "blocked";
  last_nudged_at: string | null;
};

export type TrackerAllTasksPage = {
  rows: TrackerAllTaskRow[]; total: number; page: number; limit: number;
  stateCounts: { done: number; pending: number; blocked: number; overdue: number };
  groupCounts?: Array<{ key: string; label: string; count: number }>;
};

export type TrackerZmRosterRow = {
  id: string; name: string; state: string | null;
  own_total: number; own_done: number; own_pending: number; fellow_count: number;
};

export function getTrackerAllTasks(f: TrackerAllTasksFilters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return trackerJson<TrackerAllTasksPage>(`/tracker/all-tasks${qs ? `?${qs}` : ""}`);
}

export function getTrackerZms() {
  return trackerJson<TrackerZmRosterRow[]>("/tracker/zms");
}

export function getTrackerZmFellows(zmId: string) {
  return trackerJson<TrackerFellowSummary[]>(`/tracker/zms/${encodeURIComponent(zmId)}/fellows`);
}

export type TrackerFellowSchoolRow = {
  id: string; name: string; state: string | null; district: string | null;
};

export function getTrackerFellowSchools(fellowId: string) {
  return trackerJson<TrackerFellowSchoolRow[]>(`/tracker/fellows/${encodeURIComponent(fellowId)}/schools`);
}

export type TrackerSchoolStudentRow = {
  id: string; name: string; programme: string | null;
};

export function getTrackerSchoolStudents(schoolId: string) {
  return trackerJson<TrackerSchoolStudentRow[]>(`/tracker/schools/${encodeURIComponent(schoolId)}/students`);
}

export type TrackerPmRosterRow = {
  id: string; name: string; zm_count: number;
};

export function getTrackerPms() {
  return trackerJson<TrackerPmRosterRow[]>("/tracker/pms");
}

export function getTrackerPmZms(pmId: string) {
  return trackerJson<TrackerZmRosterRow[]>(`/tracker/pms/${encodeURIComponent(pmId)}/zms`);
}

// --- Task-first list + task-scoped org drill (redesigned All Tasks tab) --------

export type TrackerTaskState = "done" | "pending" | "overdue" | "blocked";

export type TrackerTaskSummaryFilters = {
  q?: string; priority?: TrackerPriority; status?: TrackerTaskState;
  page?: number; limit?: number;
};

export type TrackerTaskSummaryRow = {
  template_id: string; name: string; target_type: TrackerTargetType;
  priority: TrackerPriority; deadline: string | null;
  total: number; done: number; blocked: number; overdue: number; pending: number;
  rolled_state: TrackerTaskState;
};

export type TrackerTaskSummaryPage = {
  rows: TrackerTaskSummaryRow[]; total: number; page: number; limit: number;
  stateCounts: { done: number; pending: number; blocked: number; overdue: number };
};

export function getTrackerTaskSummary(f: TrackerTaskSummaryFilters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return trackerJson<TrackerTaskSummaryPage>(`/tracker/all-tasks/summary${qs ? `?${qs}` : ""}`);
}

export type TrackerDrillLevel = "zm" | "fellow" | "school" | "student";

export type TrackerBreakdownRow = {
  id: string; name: string; child_count: number;
  total: number; done: number; blocked: number; overdue: number; pending: number;
  rolled_state: TrackerTaskState; record_id: string | null;
};

export type TrackerBreakdownPage = {
  rows: TrackerBreakdownRow[]; total: number; page: number; limit: number;
};

export function getTrackerTaskBreakdown(
  templateId: string,
  params: { level: TrackerDrillLevel; parentId?: string; q?: string; page?: number; limit?: number },
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  return trackerJson<TrackerBreakdownPage>(
    `/tracker/all-tasks/${encodeURIComponent(templateId)}/breakdown?${p.toString()}`,
  );
}

export type TrackerEventType =
  | "record_created"
  | "status_changed"
  | "values_changed"
  | "blocker_raised"
  | "blocker_cleared"
  | "blocker_escalated"
  | "blocker_comment"
  | "proof_photo_added"
  | "proof_photo_removed"
  | "proof_location_captured";

export type TrackerEvent = {
  id: string;
  event_type: TrackerEventType;
  actor_id: string | null;
  actor_name: string | null;
  detail: Record<string, unknown>;
  at: string;
  record_id: string | null;
};

export function getTrackerRecordHistory(recordId: string) {
  return trackerJson<TrackerEvent[]>(`/tracker/records/${encodeURIComponent(recordId)}/history`);
}

export function getTrackerTemplateHistory(templateId: string) {
  return trackerJson<TrackerEvent[]>(`/tracker/templates/${encodeURIComponent(templateId)}/history`);
}

export type TrackerBlockerThread = {
  blocker: {
    id: string;
    text: string;
    status: "open" | "cleared";
    raised_by: string;
    raised_by_name: string | null;
    raised_at: string;
    cleared_at: string | null;
    escalated_to_zm_at: string | null;
    escalated_to_pm_at: string | null;
    record_id: string;
    template_id: string | null;
    task_name: string | null;
    target_type: TrackerTargetType | null;
    target_name: string | null;
  };
  events: TrackerEvent[];
};

export function getBlockerThread(blockerId: string) {
  return trackerJson<TrackerBlockerThread>(`/tracker/blockers/${encodeURIComponent(blockerId)}/thread`);
}

export function addBlockerComment(blockerId: string, text: string) {
  return trackerJson<{ ok: true }>(`/tracker/blockers/${encodeURIComponent(blockerId)}/comment`, jsonInit("POST", { text }));
}

export function nudgeTracker(body: { doerId: string; templateId?: string }) {
  return trackerJson<{ sent: boolean; nextAllowedAt: string }>("/tracker/nudges", jsonInit("POST", body));
}

// --- Additional Student Details (Fellow Tracker) ---------------------------
// PM-defined dynamic student attributes (e.g. Date of Birth, Aadhaar URL) that
// Fellows fill per student and templates auto-fill via `student.custom.<field_key>`.

export type TrackerStudentFieldStatus = "active" | "archived";

export type TrackerStudentFieldDef = {
  id: string;
  field_key: string;
  label: string;
  field_type: TrackerFieldType;
  options: string[] | null;
  required: boolean;
  sort_order: number;
  status: TrackerStudentFieldStatus;
  created_at: string;
  updated_at: string;
};

export type TrackerStudentDetail = {
  field: TrackerStudentFieldDef;
  value: unknown | null;
  updated_at: string | null;
};

export type TrackerStudentDetailsResponse = {
  student_id: string;
  details: TrackerStudentDetail[];
};

export type TrackerProfilePath = {
  path: string;
  label: string;
  custom: boolean;
};

export type CreateStudentFieldInput = {
  label: string;
  field_type: TrackerFieldType;
  options?: string[] | null;
  required?: boolean;
  sort_order?: number;
};

export type StudentFieldPatch = {
  label?: string;
  options?: string[] | null;
  required?: boolean;
  sort_order?: number;
  status?: TrackerStudentFieldStatus;
};

export type SaveStudentDetailsResult = { student_id: string; saved: string[] };

/**
 * Thrown when the save-details endpoint returns a 400 with per-field validation
 * errors. `fieldErrors` maps `field_key` → human message so the form can render
 * each error next to its input.
 */
export class StudentDetailsValidationError extends ApiError {
  readonly fieldErrors: Record<string, string>;
  constructor(message: string, status: number, fieldErrors: Record<string, string>) {
    super(message, status);
    this.name = "StudentDetailsValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function listStudentFields(status?: TrackerStudentFieldStatus) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return trackerJson<{ fields: TrackerStudentFieldDef[] }>(`/tracker/student-fields${qs}`);
}

export function createStudentField(input: CreateStudentFieldInput) {
  return trackerJson<{ field: TrackerStudentFieldDef }>("/tracker/student-fields", jsonInit("POST", input));
}

export function updateStudentField(id: string, patch: StudentFieldPatch) {
  return trackerJson<{ field: TrackerStudentFieldDef }>(
    `/tracker/student-fields/${encodeURIComponent(id)}`,
    jsonInit("PATCH", patch),
  );
}

export function deleteStudentField(id: string) {
  return trackerJson<void>(
    `/tracker/student-fields/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function getStudentDetails(
studentId: string) {
  return trackerJson<TrackerStudentDetailsResponse>(
    `/tracker/students/${encodeURIComponent(studentId)}/details`,
  );
}

export async function saveStudentDetails(
  studentId: string,
  values: Record<string, unknown>,
): Promise<SaveStudentDetailsResult> {
  const res = await apiFetch(
    `${API_BASE_URL}/tracker/students/${encodeURIComponent(studentId)}/details`,
    jsonInit("PUT", { values }),
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[]; errors?: Record<string, string> }
      | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message ?? "Could not save student details.";
    if (res.status === 400 && body?.errors && typeof body.errors === "object") {
      throw new StudentDetailsValidationError(message, res.status, body.errors);
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as SaveStudentDetailsResult;
}

export function listProfilePaths(target: TrackerTargetType) {
  return trackerJson<{ paths: TrackerProfilePath[] }>(
    `/tracker/profile-paths?target=${encodeURIComponent(target)}`,
  );
}
