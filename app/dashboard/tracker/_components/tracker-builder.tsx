"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addTrackerFields,
  assignTrackerDoers,
  createTrackerTemplate,
  updateTrackerTemplate,
  type TrackerCompletionStyle,
  type TrackerField,
  type TrackerFieldSource,
  type TrackerFieldType,
  type TrackerTargetType,
  type TrackerRecurrence,
  type TrackerPriority,
  profilePathLabel,
} from "@/lib/tracker-api";
import { useTrackerAssignable, useTrackerMyProgrammes } from "@/lib/queries/tracker";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { useProfilePaths } from "@/lib/queries/tracker";
import { useBatches } from "@/lib/queries/batches";
import { AudiencePicker } from "./audience-picker";
import { SchoolBatchPicker, type SchoolBatchPick } from "./school-batch-picker";
import { IN_CHARGE_LOWER, IN_CHARGE_LOWER_PLURAL, IN_CHARGE_PLURAL } from "@/lib/labels";

// Fallback mirror of the backend PROFILE_ALLOWLIST (src/tracker/tracker.constants.ts),
// used only when GET /tracker/profile-paths fails. The API is the source of truth and
// additionally returns dynamic `student.custom.*` paths for PM-defined student fields.
const FELLOW_PATHS = ["fellow.name", "fellow.email"] as const;
const STUDENT_PATHS = ["student.name", "student.category", "student.district", "student.contact", "school.name", "school.code"] as const;
const SCHOOL_PATHS: readonly string[] = []; // school projection not wired yet
const pathsFor = (t: TrackerTargetType): readonly string[] =>
  t === "fellow" ? FELLOW_PATHS : t === "student" ? STUDENT_PATHS : SCHOOL_PATHS;
const sourcesFor = (t: TrackerTargetType): TrackerFieldSource[] =>
  pathsFor(t).length ? ["input", "profile"] : ["input"];

const FIELD_TYPES: TrackerFieldType[] = ["text", "number", "date", "select", "multiselect", "boolean", "url"];

type DraftColumn = {
  label: string;
  field_type: TrackerFieldType;
  optionsText: string;
  source: TrackerFieldSource;
  source_path: string;
  required: boolean;
};

const emptyColumn = (defaultPath: string): DraftColumn => ({
  label: "",
  field_type: "text",
  optionsText: "",
  source: "input",
  source_path: defaultPath,
  required: false,
});

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
}
function prettyState(s: string | null): string {
  if (!s) return "";
  return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

/** Seeds the builder with an audience the author already picked elsewhere — e.g. the
 *  "Assign task" button on a team member's task list. Only read on mount, so callers
 *  remount the builder (via `key`) to change it. */
export type TrackerAssignPrefill = {
  targetType: TrackerTargetType;
  /** Target ids to pre-check in the audience picker. */
  ids: string[];
  /** Human name of the pre-selected target, shown as a hint above the picker. */
  label?: string;
};

/** What the Task Target means for the people picked below. Students are never doers. */
const DOER_HINT: Record<TrackerTargetType, string> = {
  fellow: `Each person you pick below fills in one entry of their own.`,
  school: `Each person you pick below fills in one entry per school they look after.`,
  student: `Each person you pick below fills in one entry per student they look after. Students do not see or do this task.`,
};
/** The bottom picker always answers "who fills this in?" with the same staff list,
 *  whatever the Task Target — the target only decides how many entries a pick becomes. */
const AUDIENCE_HINT = `${IN_CHARGE_PLURAL} or zonal managers you manage. Leave empty to assign later.`;

export function TrackerBuilder({
  canAuthor,
  canShareExternally = false,
  onCreated,
  prefill,
}: {
  canAuthor: boolean;
  /**
   * May this author share a task outside the organisation? A permission of its
   * own (tracker.share_external, migration 124) because tracker.author includes
   * Zonal Managers, and authoring a task is not the same decision as publishing
   * its proof photographs to a funder.
   *
   * Passed in rather than read from a hook here: this component is rendered bare
   * in tests, and reaching for auth inside it would drag Clerk into every one of
   * them. The page above already knows.
   *
   * Defaults to false — if a caller forgets to pass it, the control that shares
   * data outside the building is the one that stays hidden.
   */
  canShareExternally?: boolean;
  /** Called with the new task's id once it is created (and assigned) so the caller can
   *  open that task instead of leaving the author on an empty form. */
  onCreated?: (templateId: string) => void;
  prefill?: TrackerAssignPrefill;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<TrackerTargetType>(prefill?.targetType ?? "fellow");
  const [completionStyle, setCompletionStyle] = useState<TrackerCompletionStyle>("checklist");
  const [statusesText, setStatusesText] = useState("");
  const [doneStatus, setDoneStatus] = useState("");
  const [deadline, setDeadline] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [priority, setPriority] = useState<TrackerPriority>("medium");
  const [recurrence, setRecurrence] = useState<"" | TrackerRecurrence>("");
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [requireGeo, setRequireGeo] = useState(false);
  const [partnerVisible, setPartnerVisible] = useState(false);
  const [programmeId, setProgrammeId] = useState("");

  // Which programme this task type belongs to. The server derives it from the
  // author's membership when we send nothing, and refuses outright when the author
  // sits in more than one ("say which one this task type is for") — so an author in
  // two programmes could not create a task at all from this form. The picker exists
  // to answer that question before it becomes an error.
  const myProgrammes = useTrackerMyProgrammes(canAuthor);
  const programmeOpts = myProgrammes.data ?? [];
  // A single seat needs no choosing, so it is applied rather than asked. Derived,
  // not written into state by an effect: the list arrives asynchronously, and an
  // effect would let one render see an empty value the submit path could read.
  const effectiveProgrammeId = programmeId || (programmeOpts.length === 1 ? programmeOpts[0].id : "");
  const mustPickProgramme = programmeOpts.length > 1 && !programmeId;
  // No seat means no programme, which is a valid task type — it just can never be
  // shared outside the organisation, because partners are seated per programme.
  const canAttachProgramme = programmeOpts.length > 0;

  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [columns, setColumns] = useState<DraftColumn[]>([emptyColumn(pathsFor(prefill?.targetType ?? "fellow")[0] ?? "")]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(prefill?.ids ?? []));
  // Programme → Schools → Batches cascade. Empty schools = every school in reach; empty
  // batches = every student in reach (student tasks only). Each picked person gets the
  // entries inside these that they reach.
  const [schoolIds, setSchoolIds] = useState<string[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const allBatches = useBatches("ACTIVE").data;
  const reachSchools = useTrackerAssignable("school", canAuthor).data;
  const schoolOpts = useMemo(
    () => (reachSchools ?? [])
      .filter((s) => !effectiveProgrammeId || s.programmes.some((p) => p.id === effectiveProgrammeId))
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [reachSchools, effectiveProgrammeId],
  );
  const batchOpts = useMemo(() => {
    const inProgramme = new Set(schoolOpts.map((s) => s.id));
    return (allBatches ?? [])
      .filter((b) => !effectiveProgrammeId || b.programme_id === effectiveProgrammeId
        || (!b.programme_id && b.school_id != null && inProgramme.has(b.school_id)))
      .map((b) => ({ id: b.id, name: b.name, schoolId: b.school_id, memberCount: b.member_count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBatches, effectiveProgrammeId, schoolOpts]);
  // Ticking a school puts its in-charge under "Who fills this in?" — the usual answer —
  // and unticking takes them back out, unless another ticked school still needs them.
  // Only people added this way are ever removed; a hand-picked person stays.
  const staff = useTrackerAssignable("fellow", canAuthor).data;
  const [autoPicked, setAutoPicked] = useState<Set<string>>(new Set());
  function inChargesOf(pick: SchoolBatchPick): Set<string> {
    const covered = new Set(pick.schoolIds);
    for (const id of pick.batchIds) {
      const sid = (allBatches ?? []).find((b) => b.id === id)?.school_id;
      if (sid) covered.add(sid);
    }
    return new Set((staff ?? [])
      .filter((t) => t.role === "FELLOW" && (t.schools ?? []).some((s) => covered.has(s.id)))
      .map((t) => t.id));
  }
  function onPick(next: SchoolBatchPick) {
    setSchoolIds(next.schoolIds);
    setBatchIds(next.batchIds);
    if (targetType === "fellow") return;
    const want = inChargesOf(next);
    setSelectedIds((cur) => {
      const out = new Set([...cur].filter((id) => !autoPicked.has(id) || want.has(id)));
      want.forEach((id) => out.add(id));
      return out;
    });
    setAutoPicked(want);
  }
  const onProgramme = (v: string) => { setProgrammeId(v); onPick({ schoolIds: [], batchIds: [] }); };
  // Every school the pick touches, whole or through one of its batches — narrows the people list.
  const coveredSchoolIds = useMemo(() => {
    const out = new Set(schoolIds);
    for (const id of batchIds) { const sid = batchOpts.find((b) => b.id === id)?.schoolId; if (sid) out.add(sid); }
    return [...out];
  }, [schoolIds, batchIds, batchOpts]);

  const submittingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // Source of truth for auto-fill paths: GET /tracker/profile-paths (static allow-list +
  // dynamic student.custom.* fields). Falls back to the hardcoded mirror if the request fails.
  const profilePathsQuery = useProfilePaths(targetType, canAuthor);
  const apiPaths = profilePathsQuery.data?.paths ?? [];
  const profilePaths: string[] = apiPaths.length ? apiPaths.map((p) => p.path) : [...pathsFor(targetType)];
  const pathLabel = (p: string): string => apiPaths.find((x) => x.path === p)?.label ?? profilePathLabel(p);
  const sources: TrackerFieldSource[] = profilePaths.length ? ["input", "profile"] : ["input"];
  const targetWord = targetType === "school" ? "schools" : targetType === "student" ? "students" : "staff";

  if (!canAuthor) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-5 text-center">
        <p className="text-sm font-medium text-red-800">Creating tasks needs manager access.</p>
      </div>
    );
  }

  const setColumn = (i: number, patch: Partial<DraftColumn>) =>
    setColumns((cols) => cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  // Flipping a field to "Auto-filled" must land on a path valid for the current target —
  // otherwise the select shows the first option but state keeps a stale path (e.g. fellow.name
  // on a student task), which the backend rejects via the allow-list on submit.
  function onSourceChange(i: number, source: TrackerFieldSource) {
    setColumn(i, {
      source,
      ...(source === "profile" && !profilePaths.includes(columns[i]?.source_path ?? "")
        ? { source_path: profilePaths[0] ?? "" }
        : {}),
    });
  }

  // Picks survive a target switch on purpose: they are people, not entries, and the
  // same people qualify for every target.
  function onTargetChange(next: TrackerTargetType) {
    setTargetType(next);
    if (next !== "student") setBatchIds([]);
    if (next === "fellow") { setSchoolIds([]); setAutoPicked(new Set()); }
    const validPaths = pathsFor(next);
    const validSources = sourcesFor(next);
    setColumns((cols) =>
      cols.map((c) => {
        const source = validSources.includes(c.source) ? c.source : "input";
        // Always re-anchor to a valid path so a stale path can't survive a target switch.
        const source_path = validPaths.length && !validPaths.includes(c.source_path) ? validPaths[0] : c.source_path;
        return { ...c, source, source_path };
      }),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return; // guard: async setBusy can't stop a fast double-click
    submittingRef.current = true;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const statuses = statusesText.split(",").map((s) => s.trim()).filter(Boolean);
      if (completionStyle === "workflow") {
        if (statuses.length === 0) throw new Error("Add at least one step.");
        if (!statuses.includes(doneStatus.trim())) throw new Error("The 'done' step must be one of the steps.");
      }

      const used = new Set<string>();
      const fields: TrackerField[] = columns
        .filter((c) => c.label.trim())
        .map((c, idx) => {
          let key = slug(c.label);
          let n = 2;
          while (used.has(key)) key = `${slug(c.label)}_${n++}`;
          used.add(key);
          return {
            field_key: key,
            label: c.label.trim(),
            field_type: c.field_type,
            options:
              c.field_type === "select" || c.field_type === "multiselect"
                ? c.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
                : null,
            source: c.source,
            // Coerce to a target-valid path (matches what the dropdown displays) so a stale
            // path never reaches the backend allow-list.
            source_path:
              c.source === "profile"
                ? profilePaths.includes(c.source_path) ? c.source_path : profilePaths[0] ?? null
                : null,
            required: c.required,
            visible_if: null,
            sort_order: idx,
          };
        });
      for (const f of fields) {
        if ((f.field_type === "select" || f.field_type === "multiselect") && (!f.options || f.options.length === 0))
          throw new Error(`"${f.label}" needs at least one choice.`);
      }

      if (mustPickProgramme)
        throw new Error("Choose which programme this task type is for.");
      if (recurrence && startsOn && endsOn && endsOn < startsOn)
        throw new Error("The end date must be on or after the start date.");

      // Code is an internal unique key — auto-derived from the name so authors only type a name.
      const autoCode = `${slug(name)}-${Date.now().toString(36)}`.toUpperCase();
      const { id } = await createTrackerTemplate({
        code: autoCode,
        name: name.trim(),
        description: description.trim() || undefined,
        target_type: targetType,
        completion_style: completionStyle,
        workflow_statuses: completionStyle === "workflow" ? statuses : undefined,
        done_status: completionStyle === "workflow" ? doneStatus.trim() : undefined,
        // A repeating task is due within each period, so it takes a start/end window instead.
        deadline: !recurrence && deadline ? deadline : undefined,
        starts_on: recurrence && startsOn ? startsOn : undefined,
        ends_on: recurrence && endsOn ? endsOn : undefined,
        priority,
        recurrence_frequency: recurrence || undefined,
        require_photo: requirePhoto,
        require_geo_verification: requireGeo && targetType !== "fellow",
        // Omitted, not null, when there is nothing to send: the server's own
        // derivation is the right answer for a single-seat author, and passing an
        // explicit null would be a different instruction.
        programme_id: effectiveProgrammeId || undefined,
        status: saveAsDraft ? "draft" : "active",
      });
      if (fields.length > 0) await addTrackerFields(id, { fields });

      // Sharing stays a PATCH after the fact, not part of the create.
      //
      // The create route has no partner_visible field, and giving it one would put
      // the "may you share outside the organisation" check — which is a different
      // permission from authoring, deliberately (migration 124) — in two places.
      // The picker above means the precondition it enforces (a task type must have
      // a programme) is now knowable before submit rather than only in the reply.
      if (partnerVisible && canShareExternally && effectiveProgrammeId)
        await updateTrackerTemplate(id, { partner_visible: true });

      const doerIds = Array.from(selectedIds);
      let assigned = 0;
      let skipped = 0;
      if (doerIds.length > 0)
        ({ created: assigned, skipped } = await assignTrackerDoers(id, doerIds, {
          schoolIds: targetType === "fellow" ? [] : schoolIds,
          batchIds: targetType === "student" ? batchIds : [],
        }));

      await invalidate("tracker");
      const visibility = saveAsDraft ? " Saved as a draft — publish it to make it visible." : "";
      // Same condition as the PATCH above, not just `partnerVisible` — a ticked box
      // on a task that ended up with no programme was never shared, and saying so
      // would be the one lie this feature cannot afford.
      const shared = partnerVisible && canShareExternally && effectiveProgrammeId
        ? " Shared with this programme's government and funding officials." : "";
      // Skipped = people the server gave nothing to (out of reach, not a valid doer, or
      // every entry already taken). Said out loud: a quiet "Created" read as if everyone got it.
      const notAssigned = skipped > 0 ? ` ${skipped} of the ${doerIds.length} people picked could not be assigned.` : "";
      // A staff task assigns people; a school / student task assigns entries to people.
      const assignedText = !assigned ? "."
        : targetType === "fellow" ? ` and assigned to ${assigned} staff.`
        : ` and assigned ${assigned} ${targetWord.replace(/s$/, "")} ${assigned === 1 ? "entry" : "entries"}.`;
      const message = `Created "${name.trim()}"` + assignedText + notAssigned + visibility + shared;
      setName(""); setDescription(""); setStatusesText(""); setDoneStatus(""); setDeadline(""); setPriority("medium"); setRecurrence("");
      setStartsOn(""); setEndsOn(""); setSchoolIds([]); setBatchIds([]); setAutoPicked(new Set());
      setRequirePhoto(false); setRequireGeo(false); setSaveAsDraft(false);
      setPartnerVisible(false);
      setProgrammeId("");
      setColumns([emptyColumn(profilePaths[0] ?? "")]);
      setSelectedIds(new Set());
      if (onCreated) {
        // The form unmounts on navigation, so the confirmation has to survive as a toast.
        toast.success(message);
        onCreated(id);
      } else {
        setResult(message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task.");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const inputClass =
    "h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
  const filterClass =
    "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Where the task runs, top to bottom: Programme → Task Target → Schools → Batches. The picks
          narrow which entries each person below receives, and the "Who fills this in?"
          list to the people covering them. */}
      <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5">
        {canAttachProgramme && (
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Programme
            <select value={effectiveProgrammeId} onChange={(e) => onProgramme(e.target.value)} className={inputClass}>
              {/* Only offered when there is a real choice to make. With one seat the
                  value is already applied, and an "unassigned" option would invite
                  an author to opt out of something they cannot opt back into. */}
              {programmeOpts.length > 1 && <option value="">Choose a programme…</option>}
              {programmeOpts.map((pr) => (
                <option key={pr.id} value={pr.id}>{pr.name}</option>
              ))}
            </select>
            <span className="text-xs font-normal text-gray-500">
              Decides who can see this task type, and which officials it can be shared with. It cannot be changed later.
            </span>
          </label>
        )}
        {/* Target sits here, above the pickers it controls, so the form reads top to
            bottom: a staff task has no schools, and only a student task has batches. */}
        {/* Granularity, not doer. Staff always fill the tracker in — students never do —
            so the question is what each entry is about, and the helper line says who
            ends up filling it for that choice. */}
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Task Target
            <select value={targetType} onChange={(e) => onTargetChange(e.target.value as TrackerTargetType)} className={inputClass}>
              <option value="fellow">Staff ({IN_CHARGE_LOWER_PLURAL} or zonal managers) — one entry each</option>
              <option value="school">A school — one entry per school</option>
              <option value="student">A student — one entry per student</option>
            </select>
          </label>
          <p className="text-xs text-gray-500">{DOER_HINT[targetType]}</p>
        </div>
        {targetType !== "fellow" && (
          <SchoolBatchPicker
            schools={schoolOpts}
            batches={batchOpts}
            showBatches={targetType === "student"}
            value={{ schoolIds, batchIds }}
            onChange={onPick}
          />
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
          Task name
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly Report" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>
        {!recurrence && (
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Due date
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as TrackerPriority)} className={inputClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Repeats
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as "" | TrackerRecurrence)} className={inputClass}>
            <option value="">One-time</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
        {recurrence && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Starts on (optional)
              <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Ends on (optional)
              <input type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} className={inputClass} />
            </label>
            <p className="-mt-2 text-xs text-gray-500 sm:col-span-2">
              {startsOn || endsOn
                ? `Repeats ${recurrence === "daily" ? "every day" : recurrence === "weekly" ? "every week" : "every month"}${startsOn ? ` from ${startsOn}` : ""}${endsOn ? ` until ${endsOn}` : ""}. Nothing new is created after the end date; past entries stay as history.`
                : "Leave both empty to start today and repeat until you archive the task."}
            </p>
          </div>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          How is it completed?
          <select value={completionStyle} onChange={(e) => setCompletionStyle(e.target.value as TrackerCompletionStyle)} className={inputClass}>
            <option value="checklist">Tick when done</option>
            <option value="workflow">Move through steps</option>
          </select>
        </label>
        {completionStyle === "workflow" && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Steps (comma-separated)
              <input value={statusesText} onChange={(e) => setStatusesText(e.target.value)} placeholder="applied, paid, done" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Which step means done?
              <input value={doneStatus} onChange={(e) => setDoneStatus(e.target.value)} placeholder="done" className={inputClass} />
            </label>
          </>
        )}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-sm font-medium text-gray-700">Proof of visit</span>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={requirePhoto} onChange={(e) => setRequirePhoto(e.target.checked)} />
            Require a photo before it can be marked done
          </label>
          {/* Geo verification needs a single school to measure against, which a staff
              task does not have — a fellow may cover several. */}
          {targetType !== "fellow" && (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={requireGeo} onChange={(e) => setRequireGeo(e.target.checked)} />
                Verify school visit using photo location metadata
              </label>
              <p className="ml-6 text-xs text-gray-500">
                The {IN_CHARGE_LOWER} uploads one photo taken at the school with their phone camera; we read the
                location saved inside it. One photo covers all entries for that school in each period.
                This checks verified photo metadata, which can be edited — it is evidence, not proof of
                physical presence.
              </p>
            </>
          )}
        </div>


        {/* Sharing outside the organisation.
            Its own block, phrased as a warning rather than a setting, because it
            is the only control on this page whose effect leaves the building. The
            copy names exactly what a partner would receive — the same list the
            server exposes — since "share with partners" reads as a summary and
            this is not something to summarise. */}
        {canShareExternally && (
        <div className="flex flex-col gap-2 sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <span className="text-sm font-medium text-amber-900">Share outside the organisation</span>
          <label className="flex items-start gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              className="mt-1"
              checked={partnerVisible}
              disabled={!effectiveProgrammeId}
              onChange={(e) => setPartnerVisible(e.target.checked)}
            />
            <span>
              Let government and funding officials seated in this programme follow this task
            </span>
          </label>
          {/* Disabled rather than hidden, with the reason stated. The control
              vanishing would leave an author who expected to share wondering
              whether the feature exists; this tells them what to fix. */}
          {!effectiveProgrammeId && (
            <p className="ml-6 text-xs text-amber-800">
              {canAttachProgramme
                ? "Choose a programme above first — officials are seated per programme."
                : "You are not seated in a programme, so there are no officials to share this with."}
            </p>
          )}
          {partnerVisible && effectiveProgrammeId && (
            <p className="ml-6 text-xs text-amber-800">
              They will see every record of this task: the school, the {IN_CHARGE_LOWER} who
              last updated it, what they filled in, whether it is late or blocked, and —
              where this task requires them — the proof photographs and their GPS
              coordinates. Only officials already seated in this programme, and only this
              task. You can switch it off again, but anything already downloaded stays
              downloaded.
            </p>
          )}
        </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-950">What to fill in</h3>
          <button type="button" onClick={() => setColumns((c) => [...c, emptyColumn(profilePaths[0] ?? "")])} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add field
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">Optional. Leave empty for a simple tick-when-done task.</p>
        <div className="flex flex-col gap-3">
          {columns.map((col, i) => (
            <div key={i} className="grid items-end gap-2 rounded-md border border-gray-100 bg-gray-50/60 p-3 md:grid-cols-5">
              <input value={col.label} onChange={(e) => setColumn(i, { label: e.target.value })} placeholder="Field label" className={inputClass} />
              <select value={col.field_type} onChange={(e) => setColumn(i, { field_type: e.target.value as TrackerFieldType })} className={inputClass}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={col.source} onChange={(e) => onSourceChange(i, e.target.value as TrackerFieldSource)} className={inputClass}>
                {sources.map((s) => <option key={s} value={s}>{s === "profile" ? "Auto-filled" : "You enter"}</option>)}
              </select>
              {col.source === "profile" ? (
                <select value={col.source_path} onChange={(e) => setColumn(i, { source_path: e.target.value })} className={inputClass}>
                  {apiPaths.length > 0 ? (
                    <>
                      <optgroup label="Standard Details">
                        {apiPaths.filter(p => !p.custom).map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
                      </optgroup>
                      {apiPaths.some(p => p.custom) && (
                        <optgroup label="Additional Details">
                          {apiPaths.filter(p => p.custom).map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    profilePaths.map((p) => <option key={p} value={p}>{pathLabel(p)}</option>)
                  )}
                </select>
              ) : (col.field_type === "select" || col.field_type === "multiselect") ? (
                <input value={col.optionsText} onChange={(e) => setColumn(i, { optionsText: e.target.value })} placeholder="choices: a, b" className={inputClass} />
              ) : (
                <div />
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={col.required} onChange={(e) => setColumn(i, { required: e.target.checked })} /> Required
                </label>
                <button type="button" onClick={() => setColumns((c) => c.filter((_, idx) => idx !== i))} aria-label="Remove field" className="text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-950">Who fills this in?</h3>
        <p className="mb-2 text-xs text-gray-500">{AUDIENCE_HINT}</p>
        {prefill?.label && (
          <p className="mb-2 text-xs text-gray-500">
            Pre-selected <span className="font-semibold text-gray-700">{prefill.label}</span>. Add or remove anyone below.
          </p>
        )}
        <AudiencePicker
          canAuthor={canAuthor}
          selected={selectedIds}
          onChange={setSelectedIds}
          programmeId={effectiveProgrammeId || undefined}
          schoolIds={targetType === "fellow" ? undefined : coveredSchoolIds}
        />
      </section>

      {error && <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {result && <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saveAsDraft ? "Save draft" : "Create & publish"}
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={saveAsDraft} onChange={(e) => setSaveAsDraft(e.target.checked)} />
          Save as draft (hidden from {IN_CHARGE_LOWER_PLURAL} until published)
        </label>
      </div>
    </form>
  );
}
