import { API_BASE_URL, ApiError, apiFetch } from "./api";

export type TrackerFieldType = "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "url";
export type TrackerFieldSource = "profile" | "identity" | "input";
export type TrackerTargetType = "student" | "school" | "fellow";
export type TrackerCompletionStyle = "checklist" | "workflow";

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
  status: "draft" | "active" | "archived";
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
};

export type TrackerSummaryRow = {
  fellow_id: string | null;
  done: number;
  pending: number;
  blocked: number;
  overdue: number;
};

export type CreateTrackerTemplateInput = {
  code: string;
  name: string;
  description?: string;
  target_type: TrackerTargetType;
  completion_style: TrackerCompletionStyle;
  workflow_statuses?: string[];
  done_status?: string;
  deadline?: string;
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
  return (await res.json()) as T;
}

function jsonInit(method: "POST" | "PATCH", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function getTrackerTemplates() {
  return trackerJson<TrackerTemplate[]>("/tracker/templates");
}

export function getTrackerTemplate(id: string) {
  return trackerJson<TrackerTemplateDetail>(`/tracker/templates/${encodeURIComponent(id)}`);
}

export function createTrackerTemplate(input: CreateTrackerTemplateInput) {
  return trackerJson<{ id: string }>("/tracker/templates", jsonInit("POST", input));
}

export function addTrackerFields(templateId: string, input: AddTrackerFieldsInput) {
  return trackerJson<void>(`/tracker/templates/${encodeURIComponent(templateId)}/fields`, jsonInit("POST", input));
}

export function assignTrackerTargets(templateId: string, targetIds: string[]) {
  return trackerJson<{ created: number; skipped: number }>(
    `/tracker/templates/${encodeURIComponent(templateId)}/assign`,
    jsonInit("POST", { targetIds }),
  );
}

export function getTrackerGrid(templateId: string) {
  return trackerJson<TrackerGrid>(`/tracker/templates/${encodeURIComponent(templateId)}/grid`);
}

export function saveTrackerBatch(edits: TrackerBatchEdit[]) {
  return trackerJson<{ saved: number }>("/tracker/records/batch", jsonInit("POST", { edits }));
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

export type TrackerAssignable = { id: string; name: string; state: string | null };

export function getTrackerAssignable(targetType: TrackerTargetType) {
  return trackerJson<TrackerAssignable[]>(`/tracker/assignable?targetType=${encodeURIComponent(targetType)}`);
}
