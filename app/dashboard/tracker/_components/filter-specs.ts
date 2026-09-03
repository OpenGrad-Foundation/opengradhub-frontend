import type { FilterDef } from "@/lib/filters";
import { fieldFilterDefs } from "@/lib/filters/field-spec";
import type { PartnerFacets, TrackerFacets, TrackerField, TrackerGridRow, TrackerMyTask } from "@/lib/tracker-api";
import { IN_CHARGE, ZONE } from "@/lib/labels";
import { TASK_STATE_META, TASK_STATE_ORDER } from "@/lib/tracker-status";

/**
 * What each tracker surface can be filtered by.
 *
 * Screen labels come from lib/labels.ts — the product renamed District to Zone and
 * Fellow to School In-Charge on screen only. The wire keys below deliberately keep
 * the backend's vocabulary (`district`, `fellowId`), which is the rule that file
 * states: never build a request from a label string.
 */

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS = TASK_STATE_ORDER.map((s) => ({ value: s, label: TASK_STATE_META[s].label }));

/**
 * The partner surface's five states.
 *
 * The wire values are the backend's own lifecycle vocabulary, which is finer than
 * the internal 4-state task rollup — the partner list rolls a task up to exactly
 * one of these, so the control has to offer all five.
 */
const PARTNER_STATUS_OPTIONS = [
  { value: "done", label: "Done" },
  { value: "in_progress", label: "In progress" },
  { value: "not_started", label: "Not started" },
  { value: "overdue", label: "Overdue" },
  { value: "blocked", label: "Blocked" },
];

const EMPTY_FACETS: TrackerFacets = { states: [], zones: [], zms: [], incharges: [], schools: [] };

/**
 * All Tasks: executed on the SERVER, because the endpoint paginates. None of these
 * defs carry a `match` — filtering the fetched page in the browser would leave the
 * total and the status cards describing a different set than the list.
 */
export function allTasksFilterSpec(facets: TrackerFacets = EMPTY_FACETS): FilterDef<never>[] {
  return [
    { key: "q", urlKey: "q", apiKey: "q", label: "Search", kind: "text" },
    { key: "priority", urlKey: "priority", apiKey: "priority", label: "Priority", kind: "select", options: PRIORITY_OPTIONS },
    { key: "status", urlKey: "status", apiKey: "status", label: "Status", kind: "select", options: STATUS_OPTIONS },
    { key: "state", urlKey: "state", apiKey: "state", label: "State", kind: "select", options: facets.states },
    { key: "zone", urlKey: "zone", apiKey: "district", label: ZONE, kind: "select", options: facets.zones },
    {
      key: "zm", urlKey: "zm", apiKey: "zmId", label: "Zonal Manager", kind: "select", options: facets.zms,
      // A ZM's whole scope is one ZM's subtree, so the control would offer exactly
      // one choice and filter nothing.
      visibleFor: ({ role }) => role !== "ZONAL_MANAGER",
    },
    { key: "incharge", urlKey: "incharge", apiKey: "fellowId", label: IN_CHARGE, kind: "select", options: facets.incharges },
    { key: "school", urlKey: "school", apiKey: "schoolId", label: "School", kind: "select", options: facets.schools },
    { key: "due", urlKey: "due", apiKey: "due", label: "Due", kind: "daterange" },
    { key: "issued", urlKey: "issued", apiKey: "issued", label: "Issued", kind: "daterange" },
    { key: "noproof", urlKey: "noproof", apiKey: "noProof", label: "Missing photo/location proof", kind: "toggle" },
  ];
}

/**
 * Fellow Tracker (the partner surface): executed on the SERVER, like All Tasks.
 *
 * Deliberately NOT the same list as the internal one. There is no Zonal Manager or
 * School In-Charge control, because an outside official drills by place rather than
 * by staff member — a funder does not need the management hierarchy to answer "how
 * is this district doing", and publishing it to everyone ever seated in a programme
 * is not a thing that can be taken back.
 *
 * `Period` is here and not on the internal list: the partner view shows ALL history,
 * so an official needs a way to ask about one month.
 */
export function partnerFilterSpec(facets: PartnerFacets | undefined): FilterDef<never>[] {
  const f = facets ?? { programmes: [], states: [], zones: [], schools: [], periods: [] };
  return [
    { key: "q", urlKey: "q", apiKey: "q", label: "Search", kind: "text" },
    { key: "programme", urlKey: "programme", apiKey: "programmeId", label: "Programme", kind: "select", options: f.programmes },
    { key: "status", urlKey: "status", apiKey: "status", label: "Status", kind: "select", options: PARTNER_STATUS_OPTIONS },
    { key: "state", urlKey: "state", apiKey: "state", label: "State", kind: "select", options: f.states },
    { key: "zone", urlKey: "zone", apiKey: "district", label: ZONE, kind: "select", options: f.zones },
    { key: "school", urlKey: "school", apiKey: "schoolId", label: "School", kind: "select", options: f.schools },
    { key: "period", urlKey: "period", apiKey: "period", label: "Period", kind: "select", options: f.periods },
    { key: "issued", urlKey: "issued", apiKey: "issued", label: "Issued", kind: "daterange" },
    { key: "evidence", urlKey: "evidence", apiKey: "hasEvidence", label: "Has photo or location", kind: "toggle" },
  ];
}

/**
 * My Tasks: executed in the BROWSER, and in two stages.
 *
 * The endpoint returns one row per RECORD, which the list then groups into one row
 * per task. Filters therefore split by what they are about: school, date and proof
 * describe a record and must run BEFORE grouping; priority and status describe the
 * task and must run after, against the rolled-up state. Running them in one pass
 * would make "blocked" mean "has a blocked record" in some places and "is a blocked
 * task" in others.
 */
export const myTasksRecordFilterSpec: FilterDef<TrackerMyTask>[] = [
  {
    key: "school", urlKey: "school", apiKey: "schoolId", label: "School", kind: "select",
    match: (task, value) => task.school_id === value,
  },
  {
    key: "issued", urlKey: "issued", apiKey: "issued", label: "Issued", kind: "daterange",
    match: (task, value) => withinDay(task.issued_at, value as { from?: string; to?: string }),
  },
  {
    key: "noproof", urlKey: "noproof", apiKey: "noProof", label: "Missing photo/location proof", kind: "toggle",
    match: (task) =>
      (task.require_photo === true && task.has_photo_proof !== true)
      || (task.require_location === true && task.has_location_proof !== true),
  },
];

/** Task-level filters, applied to the grouped rows. */
export type GroupedTaskShape = {
  priority: string;
  state: string;
  deadline: string | null;
};

export const myTasksGroupFilterSpec: FilterDef<GroupedTaskShape>[] = [
  {
    key: "priority", urlKey: "priority", apiKey: "priority", label: "Priority", kind: "select",
    options: PRIORITY_OPTIONS,
    match: (task, value) => task.priority === value,
  },
  {
    key: "status", urlKey: "status", apiKey: "status", label: "Status", kind: "select",
    options: STATUS_OPTIONS,
    match: (task, value) => task.state === value,
  },
  {
    key: "due", urlKey: "due", apiKey: "due", label: "Due", kind: "daterange",
    match: (task, value) => {
      const { from, to } = value as { from?: string; to?: string };
      if (!task.deadline) return false;
      const d = task.deadline.slice(0, 10);
      return (!from || d >= from) && (!to || d <= to);
    },
  },
];

/** An ISO timestamp inside an inclusive day range. */
function withinDay(iso: string | null, range: { from?: string; to?: string }): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

/**
 * One task's grid: executed in the BROWSER, because getGrid hands over every scoped
 * row at once. That is also what lets the value filters read the RESOLVED cells, so
 * a profile-sourced column filters exactly like a typed answer.
 *
 * The built-ins come first, then one def per column of the template.
 */
export function gridFilterSpec(
  rows: TrackerGridRow[],
  columns: TrackerField[],
  template: { require_photo?: boolean; require_location?: boolean },
): FilterDef<TrackerGridRow>[] {
  const options = (pick: (r: TrackerGridRow) => string | null | undefined,
                   labelOf: (r: TrackerGridRow) => string | null | undefined) => {
    const byValue = new Map<string, string>();
    for (const r of rows) {
      const value = pick(r);
      if (value) byValue.set(value, labelOf(r) ?? value);
    }
    return [...byValue].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const schools = options((r) => r.school_id, (r) => r.school_name);
  const states = options((r) => r.state, (r) => r.state);
  const zones = options((r) => r.district, (r) => r.district);
  const wantsProof = template.require_photo === true || template.require_location === true;

  // Grid params are namespaced `g.*` because the grid shares its URL with the task
  // lists: an un-namespaced `q` or `status` would leak between tabs, so switching to
  // My Tasks would silently inherit the row search you left on a grid.
  const builtIns: FilterDef<TrackerGridRow>[] = [
    {
      // No `match`: status is applied after the others, so the cards can count the
      // set the remaining filters admit.
      key: "status", urlKey: "g.status", apiKey: "status", label: "Status", kind: "select",
      options: STATUS_OPTIONS,
    },
    {
      key: "q", urlKey: "g.q", apiKey: "q", label: "Search", kind: "text",
      match: (row, value) => {
        const q = String(value).toLowerCase();
        return (row.target_name ?? "").toLowerCase().includes(q)
          || (row.school_name ?? "").toLowerCase().includes(q)
          || row.cells.some((c) => String(c.value ?? "").toLowerCase().includes(q));
      },
    },
  ];

  // A control with one choice filters nothing, so it is not offered.
  if (schools.length > 1) {
    builtIns.push({
      key: "school", urlKey: "g.school", apiKey: "schoolId", label: "School", kind: "select",
      options: schools, match: (row, value) => row.school_id === value,
    });
  }
  if (states.length > 1) {
    builtIns.push({
      key: "state", urlKey: "g.state", apiKey: "state", label: "State", kind: "select",
      options: states, match: (row, value) => row.state === value,
    });
  }
  if (zones.length > 1) {
    builtIns.push({
      key: "zone", urlKey: "g.zone", apiKey: "district", label: ZONE, kind: "select",
      options: zones, match: (row, value) => row.district === value,
    });
  }
  if (wantsProof) {
    builtIns.push({
      key: "noproof", urlKey: "g.noproof", apiKey: "noProof",
      label: "Missing photo/location proof", kind: "toggle",
      match: (row) =>
        (template.require_photo === true && row.has_photo_proof !== true)
        || (template.require_location === true && row.has_location_proof !== true),
    });
  }

  return [...builtIns, ...fieldFilterDefs(columns)];
}
