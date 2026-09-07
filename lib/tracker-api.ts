import { API_BASE_URL, ApiError, apiFetch } from "./api";
import { ZONE } from "./labels";
import type { RecordLifecycle } from "./tracker-status";

export type TrackerFieldType = "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "url";
export type TrackerFieldSource = "profile" | "identity" | "input";
export type TrackerTargetType = "student" | "school" | "fellow";

// Human labels for auto-filled (profile) source paths — shown instead of the raw `student.name` key.
export const PROFILE_PATH_LABELS: Record<string, string> = {
  "student.name": "Student name",
  "student.category": "Student category",
  "student.district": ZONE,
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
  /** Legacy per-record live location capture. Superseded by require_geo_verification
   *  and no longer offered when authoring; existing tasks keep working. */
  require_location: boolean;
  require_geo_verification: boolean;
  /** Shared with the government / funding officials seated in this task's programme. */
  partner_visible?: boolean;
  /** Which programme owns this task type. Null for org-only tasks — and a task with no
   *  programme can never be shared externally, because partners are seated per programme. */
  programme_id?: string | null;
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
  /** The row's school id. School-visit verification is shared per school, so rows are
   *  matched to a verification by id — names are not unique. Optional while older
   *  cached grid payloads (which predate it) are still in play. */
  school_id?: string | null;
  target_name: string | null;
  /** The row's target entity id (student/school/fellow user id). Present for student-target
   *  rows so a fellow can open the "Additional Student Details" form from a locked/not-set cell.
   *  Optional for backward-compatibility while the grid projection is updated to emit it. */
  target_id?: string | null;
  /** The row's geography, taken from its school. Null on a fellow-target grid, which
   *  has no school — the geography filters are not offered there. */
  state?: string | null;
  district?: string | null;
  /** Evidence the row actually holds. What the template REQUIRES lives on the template,
   *  so "missing proof" is the two read together. Optional for the same
   *  independent-deploy reason as school_id above. */
  has_photo_proof?: boolean;
  has_location_proof?: boolean;
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
  require_geo_verification?: boolean;
  /** Which programme owns this task type. Omitted = derived from the author. */
  programme_id?: string | null;
  status?: "draft" | "active" | "archived";
};

export type TrackerTemplatePatch = {
  name?: string;
  description?: string | null;
  deadline?: string | null;
  status?: "draft" | "active" | "archived";
  recurrence_frequency?: TrackerRecurrence | null;
  priority?: TrackerPriority;
  require_photo?: boolean;
  require_location?: boolean;
  require_geo_verification?: boolean;
  /**
   * Share this task type with the government and funding officials seated in its
   * programme. The server refuses `true` on a task type that has no programme.
   */
  partner_visible?: boolean;
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

/** The programmes the caller may attach a new task type to. Empty means they are
 *  seated in none — the builder then shows no picker and the task type is created
 *  without a programme, which is a valid state. */
export function getTrackerMyProgrammes() {
  return trackerJson<TrackerTargetProgramme[]>("/tracker/my-programmes");
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

export function assignTrackerTargets(templateId: string, targetIds: string[], batchId?: string) {
  return trackerJson<{ created: number; skipped: number }>(
    `/tracker/templates/${encodeURIComponent(templateId)}/assign`,
    jsonInit("POST", batchId ? { targetIds, batchId } : { targetIds }),
  );
}

export function getTrackerGrid(templateId: string, fellowId?: string) {
  const q = fellowId ? `?fellowId=${encodeURIComponent(fellowId)}` : "";
  return trackerJson<TrackerGrid>(`/tracker/templates/${encodeURIComponent(templateId)}/grid${q}`);
}

export function saveTrackerBatch(edits: TrackerBatchEdit[]) {
  return trackerJson<{ saved: number }>("/tracker/records/batch", jsonInit("POST", { edits }));
}

/** Fill someone else's rows in their name. A separate endpoint, not a flag: the server
 *  guards it with tracker.fill.override and records the reason in the row's history. */
export function saveTrackerBatchOnBehalf(reason: string, edits: TrackerBatchEdit[]) {
  return trackerJson<{ saved: number }>("/tracker/records/batch/override", jsonInit("POST", { reason, edits }));
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
  /**
   * The ACTIVE programmes this target belongs to.
   *
   * The real entity, not the old `programme` string — that was `users.programme`,
   * the legacy free-text UG/PG track, which is NULL for most staff and so fed a
   * filter that never rendered. A staff member or school can be in several; a
   * student has at most one. Always an array, never absent.
   */
  programmes: TrackerTargetProgramme[];
  school_id?: string | null;
  school_name?: string | null;
};

export type TrackerTargetProgramme = { id: string; name: string };

export function getTrackerAssignable(targetType: TrackerTargetType, batchId?: string) {
  const q = `targetType=${encodeURIComponent(targetType)}${batchId ? `&batchId=${encodeURIComponent(batchId)}` : ""}`;
  return trackerJson<TrackerAssignable[]>(`/tracker/assignable?${q}`);
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
  /** Filtering matches on id, never on a school NAME — names are not unique.
   *  Optional, like the grid's own school_id: the frontend and backend deploy
   *  independently (Netlify / Railway), so a browser can be talking to a server
   *  that predates these fields. Absent must read as "unknown", not crash. */
  school_id?: string | null;
  require_photo?: boolean;
  require_location?: boolean;
  has_photo_proof?: boolean;
  has_location_proof?: boolean;
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
  /** Geography of the record's school. `district` is what the UI calls a Zone. */
  state?: string; district?: string;
  /** Org position of the record's doer. */
  zmId?: string; fellowId?: string; schoolId?: string;
  dueFrom?: string; dueTo?: string;
  issuedFrom?: string; issuedTo?: string;
  noProof?: boolean;
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

/** Filter dropdown options for the caller's scope, in one request. */
export type TrackerFacet = { value: string; label: string };
export type TrackerFacets = {
  states: TrackerFacet[];
  zones: TrackerFacet[];
  zms: TrackerFacet[];
  incharges: TrackerFacet[];
  schools: TrackerFacet[];
};

export function getTrackerFacets() {
  return trackerJson<TrackerFacets>("/tracker/facets");
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
  params: {
    level: TrackerDrillLevel; parentId?: string; q?: string;
    status?: TrackerTaskState; page?: number; limit?: number;
  },
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
  | "proof_location_captured"
  // Mirrors tracker-events.ts on the server. These three and extension_granted were already
  // being emitted and simply fell through describeEvent's default, showing the raw code.
  | "geo_verification_recorded"
  | "geo_verification_rejected"
  | "geo_verification_overridden"
  | "extension_granted"
  | "filled_on_behalf";

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

// ── School-visit geo verification ──────────────────────────────────────────────
// One verification is collected per task + period + school + doer, and covers EVERY
// row for that school. It is derived from the EXIF metadata of a photo taken with the
// phone's own camera — the browser is never asked for location permission.

/** Why an upload could not be used as evidence. Mirrors the backend's reason codes. */
export type GeoRejectionReason =
  | "no_gps"
  | "no_capture_time"
  | "accuracy_too_poor"
  | "outside_period"
  | "school_not_configured"
  | "unreadable"
  | "too_large";

export type TrackerGeoVerification = {
  id: string;
  school_id: string;
  status: "verified" | "outside_radius";
  /** Passed the geofence, or a supervisor overrode it. This is what unlocks completion. */
  accepted: boolean;
  distance_m: number;
  radius_m: number;
  accuracy_m: number | null;
  exif_captured_at: string;
  uploaded_at: string;
  /** Metadata-stripped thumbnail. The EXIF-bearing original is fetched separately. */
  preview_url: string | null;
  override_by: string | null;
  override_at: string | null;
  override_reason: string | null;
};

export function getTemplateGeoVerifications(templateId: string, periodKey?: string) {
  const qs = periodKey ? `?period_key=${encodeURIComponent(periodKey)}` : "";
  return trackerJson<TrackerGeoVerification[]>(
    `/tracker/templates/${encodeURIComponent(templateId)}/geo-verifications${qs}`,
  );
}

export async function getRecordGeoVerification(
  recordId: string,
): Promise<TrackerGeoVerification | null> {
  // A row with no verification yet comes back as a 200 with an EMPTY body (Nest
  // serialises a `null` return that way), which trackerJson maps to undefined.
  // React Query rejects undefined outright, so the absence is normalised to null.
  const res = await trackerJson<TrackerGeoVerification | null | undefined>(
    `/tracker/records/${encodeURIComponent(recordId)}/geo-verification`,
  );
  return res ?? null;
}

/**
 * Upload the visit photo, RAW.
 *
 * The file is sent exactly as the camera wrote it: any client-side resize or canvas
 * re-encode would strip the EXIF this whole feature reads. The server parses the
 * metadata, computes the distance and decides the verdict.
 */
export async function uploadGeoVerification(
  templateId: string,
  schoolId: string,
  file: File,
): Promise<TrackerGeoVerification> {
  const form = new FormData();
  form.append("photo", file, file.name || "visit.jpg");
  form.append("school_id", schoolId);
  const res = await apiFetch(
    `${API_BASE_URL}/tracker/templates/${encodeURIComponent(templateId)}/geo-verifications`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string; reason?: GeoRejectionReason }
      | null;
    throw new GeoUploadError(body?.message ?? "Could not verify that photo.", body?.reason, res.status);
  }
  return (await res.json()) as TrackerGeoVerification;
}

/** Carries the machine-readable reason so the panel can render the right state. */
export class GeoUploadError extends ApiError {
  readonly reason?: GeoRejectionReason;
  constructor(message: string, reason: GeoRejectionReason | undefined, status: number) {
    super(message, status);
    this.reason = reason;
  }
}

export function overrideGeoVerification(verificationId: string, reason: string) {
  return trackerJson<TrackerGeoVerification>(
    `/tracker/geo-verifications/${encodeURIComponent(verificationId)}/override`,
    jsonInit("POST", { reason }),
  );
}

/** Presigned URL for the EXIF-bearing original — supervisor review only. */
export function getGeoVerificationOriginal(verificationId: string) {
  return trackerJson<{ url: string }>(
    `/tracker/geo-verifications/${encodeURIComponent(verificationId)}/original`,
  );
}

// ── Earlier occurrences of a recurring task ───────────────────────────────────

export type TrackerPeriodHistoryEntry = {
  record_id: string;
  period_key: string;
  status: string;
  /**
   * A past period is done or MISSED — missed meaning a row existed and never
   * reached done. Periods that were never created are absent rather than shown
   * as gaps: nobody was asked, so nobody missed anything.
   */
  lifecycle: "done" | "missed";
  updated_at: string;
  updated_by_name: string | null;
  geo: {
    id: string;
    status: "verified" | "outside_radius";
    accepted: boolean;
    distance_m: number;
    radius_m: number;
    exif_captured_at: string;
    preview_url: string | null;
  } | null;
};

export type TrackerPeriodHistoryPage = {
  entries: TrackerPeriodHistoryEntry[];
  /** Feed back as `before` for the next (older) page; null when exhausted. */
  next_cursor: string | null;
};

/**
 * `studentId` switches to the student-profile route. Same payload, different gate:
 * the tracker route authorises against the record's doer, the profile route against
 * the student, which is the question a profile page is actually asking.
 */
export function getRecordPeriodHistory(
  recordId: string,
  limit?: number,
  before?: string,
  studentId?: string,
) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  if (before) qs.set("before", before);
  const suffix = qs.toString() ? `?${qs}` : "";
  const path = studentId
    ? `/tracker/students/${encodeURIComponent(studentId)}/records/${encodeURIComponent(recordId)}/periods`
    : `/tracker/records/${encodeURIComponent(recordId)}/periods`;
  return trackerJson<TrackerPeriodHistoryPage>(`${path}${suffix}`);
}

// ── The tracker, read from one student's side ─────────────────────────────────
// Everything recorded ABOUT a student, for their profile page. The tracker's own
// surfaces cut the same data by who DOES the work.

export type TrackerStudentTask = {
  template_id: string;
  template_name: string;
  description: string | null;
  priority: string;
  completion_style: "checklist" | "workflow";
  /** Ordered workflow steps, so the UI can show "step 2 of 3". Null for checklists. */
  workflow_statuses: string[] | null;
  done_status: string | null;
  deadline: string | null;
  recurrence_frequency: "daily" | "weekly" | "monthly" | null;
  record_id: string;
  period_key: string;
  /** Raw record status: a workflow step name, or not_started/in_progress/done. */
  status: string;
  lifecycle: RecordLifecycle;
  /** Null for a directly-assigned row; set when the row came from a batch. */
  batch_id: string | null;
  batch_name: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
  blocker: { text: string; raised_at: string } | null;
  /** What was filled in for this student. Profile-derived cells are excluded server-side. */
  cells: TrackerCell[];
};

export type TrackerStudentTasksResponse = {
  student_id: string;
  tasks: TrackerStudentTask[];
};

export function getStudentTrackerTasks(studentId: string) {
  return trackerJson<TrackerStudentTasksResponse>(
    `/tracker/students/${encodeURIComponent(studentId)}/tasks`,
  );
}

// ── Deadline extensions ───────────────────────────────────────────────────────
// An overdue record cannot be completed by anyone. Only a dated extension from a
// manager above the doer reopens it, and only until that date.

export type TrackerExtension = {
  id: string;
  record_id: string;
  /** New last day, inclusive. */
  extended_to: string;
  reason: string;
  granted_by: string;
  granted_by_name: string | null;
  granted_at: string;
  /** Still covering the row today; a lapsed grant stays visible as history. */
  active: boolean;
};

export function getRecordExtensions(recordId: string) {
  return trackerJson<TrackerExtension[]>(
    `/tracker/records/${encodeURIComponent(recordId)}/extensions`,
  );
}

export function grantExtension(recordId: string, extendedTo: string, reason: string) {
  return trackerJson<TrackerExtension>(
    `/tracker/records/${encodeURIComponent(recordId)}/extension`,
    jsonInit("POST", { extended_to: extendedTo, reason }),
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
// A manager's download of one task: every record they can see, its filled values, the
// evidence attached to it and a rollup of its audit trail. `history` adds the full
// event-by-event log, which arrives as a zip because that is a second file.

export type TaskExportFile = { blob: Blob; filename: string };

export async function fetchTaskExport(
  templateId: string,
  opts: { history?: boolean; ownerId?: string },
): Promise<TaskExportFile> {
  const url = new URL(`${API_BASE_URL}/tracker/templates/${encodeURIComponent(templateId)}/export`);
  if (opts.history) url.searchParams.set("history", "1");
  if (opts.ownerId) url.searchParams.set("ownerId", opts.ownerId);

  const r = await apiFetch(url.toString());
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(err?.message ?? "Could not export this task.", r.status);
  }
  const disposition = r.headers.get("content-disposition");
  const match = disposition ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition) : null;
  const fallback = opts.history ? "tracker-task-export.zip" : "tracker-task-records.csv";
  return { blob: await r.blob(), filename: match?.[1] ? decodeURIComponent(match[1]) : fallback };
}

// ── the partner view ─────────────────────────────────────────────────────────
//
// A separate, deliberately small client for the surface government and funding
// officials read. It mirrors the internal tracker's shapes — a paginated page with
// stateCounts, a facets call, a task-scoped drill — because the two surfaces are
// read the same way, and diverging would mean maintaining two mental models.

export type PartnerLifecycle = "done" | "blocked" | "overdue" | "not_started" | "in_progress";

/** Where records with no school live. Staff tasks are about a person, not a place. */
export const PARTNER_NO_PLACE = "__no_place__";

export type PartnerFacets = {
  programmes: TrackerFacetOption[];
  states: TrackerFacetOption[];
  zones: TrackerFacetOption[];
  schools: TrackerFacetOption[];
  periods: TrackerFacetOption[];
};
export type TrackerFacetOption = { value: string; label: string };

export type PartnerTaskRow = {
  template_id: string;
  name: string;
  description: string | null;
  target_type: TrackerTargetType;
  programme_id: string;
  programme_name: string;
  deadline: string | null;
  priority: TrackerPriority;
  total: number; done: number; blocked: number; overdue: number;
  not_started: number; in_progress: number;
  photo_count: number;
  rolled_state: PartnerLifecycle;
};

export type PartnerTasksPage = {
  rows: PartnerTaskRow[];
  total: number; page: number; limit: number;
  stateCounts: Record<PartnerLifecycle, number>;
};

export type PartnerBreakdownRow = {
  key: string; label: string;
  total: number; done: number; blocked: number; overdue: number;
};

export type PartnerRecord = {
  id: string;
  status: string;
  lifecycle: PartnerLifecycle;
  period_key: string | null;
  school_name: string | null;
  school_district: string | null;
  school_state: string | null;
  student_name: string | null;
  /** NOT "completed by": tracker_records has no completion columns, only updated_by. */
  last_updated_by: string | null;
  updated_at: string;
  photo_count: number;
  geo_count: number;
};

export type PartnerRecordsPage = {
  rows: PartnerRecord[]; total: number; page: number; limit: number;
};

export type PartnerProof = {
  id: string;
  kind: string;
  /** A short-lived signed URL, or null for a location-only proof. */
  url: string | null;
  lat: number | null; lng: number | null; accuracy_m: number | null;
  captured_at: string | null;
};

function partnerQs(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function getPartnerTasks(params: Record<string, unknown> = {}) {
  return trackerJson<PartnerTasksPage>(`/tracker/partner/tasks${partnerQs(params)}`);
}

export function getPartnerFacets() {
  return trackerJson<PartnerFacets>("/tracker/partner/facets");
}

export function getPartnerBreakdown(
  templateId: string,
  params: Record<string, unknown> & { level: string },
) {
  return trackerJson<PartnerBreakdownRow[]>(
    `/tracker/partner/tasks/${encodeURIComponent(templateId)}/breakdown${partnerQs(params)}`);
}

export function getPartnerRecords(templateId: string, params: Record<string, unknown> = {}) {
  return trackerJson<PartnerRecordsPage>(
    `/tracker/partner/tasks/${encodeURIComponent(templateId)}/records${partnerQs(params)}`);
}

export function getPartnerProofs(recordId: string) {
  return trackerJson<PartnerProof[]>(
    `/tracker/partner/records/${encodeURIComponent(recordId)}/proofs`);
}
