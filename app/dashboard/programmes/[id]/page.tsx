"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  ApiError, fetchSchools, getBatchImpact,
  type BatchImpact, type ProgrammeContentKind, type ProgrammeLevel,
  type SchoolOption,
} from "@/lib/api";
import {
  useAssignableBatches, useAssignableContent, useEligibleProgrammeMembers, useProgramme,
  useProgrammeBatches, useProgrammeContent, useProgrammeMembers, useProgrammeSchools,
} from "@/lib/queries/programmes";
import {
  useAssignProgrammeContent, useAttachProgrammeBatch, useAttachProgrammeSchool,
  useDetachProgrammeBatch, useDetachProgrammeSchool, useReleaseProgrammeContent,
  useRemoveProgrammeMember, useSetProgrammeMember, useUpdateProgramme,
} from "@/lib/mutations/programmes";
import {
  cardStyle, errorStyle, formLabelStyle, inputStyle, labelStyle, levelBadge,
  linkBtnStyle, noticeStyle, primaryButton, secondaryButton, tdStyle, thStyle, titleStyle,
} from "../styles";

const LEVELS: ProgrammeLevel[] = ["OWNER", "EDITOR", "VIEWER"];

/**
 * Not every message worth showing is a failure. Attaching content that another
 * programme also uses SUCCEEDS — it just grants less than the operator may
 * expect — and rendering that in the red error box read as "this did not work".
 */
type BannerTone = "error" | "info";
type Banner = { text: string; tone: BannerTone };
type Notify = (message: string | null, tone?: BannerTone) => void;

/**
 * What each level means, stated in the UI so it is not folklore.
 * Mirrors the backend: level gates writes; VIEWER is deliberately read-only and
 * carries no roster PII or grades.
 */
const LEVEL_HELP: Record<ProgrammeLevel, string> = {
  // OWNER is the only level that administers the programme itself — members,
  // schools, batches, and which content the programme owns.
  OWNER: "Manages members, schools, batches, and which content this programme owns.",
  // EDITOR edits content but cannot decide what the programme owns. Saying
  // "manages the programme's content" implied the latter, which it never had.
  EDITOR: "Can edit the courses and assignments this programme already owns.",
  VIEWER: "Read-only. No student data.",
};

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { has } = usePermissions();
  const canEdit = has(PERM.programmes.edit);
  const canManageMembers = has(PERM.programmes.manage_members);

  const { data: programme, isLoading, error } = useProgramme(id);
  const [banner, setBanner] = useState<Banner | null>(null);
  const notify: Notify = (message, tone = "error") =>
    setBanner(message === null ? null : { text: message, tone });

  // Only an OWNER (or a super admin, whom the API lets through) can actually
  // write. Showing the controls to anyone else just produces 403s.
  const isOwner = programme?.my_level === "OWNER";
  const mayAdminister = canEdit && (isOwner || has("*"));

  if (isLoading) return <div style={{ color: "rgba(3,72,82,0.6)" }}>Loading…</div>;
  if (error || !programme) {
    return (
      <div style={errorStyle}>
        {error instanceof ApiError && error.status === 404
          ? "Programme not found, or you are not a member of it."
          : "Failed to load programme."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <button style={{ ...linkBtnStyle, alignSelf: "flex-start" }} onClick={() => router.push("/dashboard/programmes")}>
        ← All programmes
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={labelStyle}>{programme.kind}{programme.state ? ` · ${programme.state}` : ""}</div>
          <h1 style={titleStyle}>
            {programme.name}
            {programme.status === "ARCHIVED" && (
              <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 600, color: "rgba(3,72,82,0.45)" }}>
                Archived
              </span>
            )}
          </h1>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(3,72,82,0.5)", marginTop: 4 }}>
            {programme.code}
          </div>
        </div>
        {programme.my_level && <span style={levelBadge(programme.my_level)}>{programme.my_level}</span>}
      </div>

      {programme.status === "ARCHIVED" && (
        <div style={noticeStyle}>
          This programme is archived. Editors cannot edit its content while it stays
          archived. Owners keep administrative access, so this can be undone below.
        </div>
      )}
      {banner && (
        <div style={banner.tone === "error" ? errorStyle : noticeStyle}>{banner.text}</div>
      )}

      <MembersSection
        programmeId={id}
        canManage={canManageMembers && (isOwner || has("*"))}
        onError={notify}
      />
      <ContentSection programmeId={id} canManage={mayAdminister} onError={notify} />
      <SchoolsSection programmeId={id} canManage={mayAdminister} onError={notify} />
      <BatchesSection programmeId={id} canManage={mayAdminister} onError={notify} />
      {mayAdminister && <DangerSection programmeId={id} status={programme.status} onError={notify} />}
    </div>
  );
}

// ── members ──────────────────────────────────────────────────────────────────

function MembersSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: Notify }) {
  const { data: members = [], isLoading } = useProgrammeMembers(programmeId);
  const setMember = useSetProgrammeMember();
  const removeMember = useRemoveProgrammeMember();

  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [level, setLevel] = useState<ProgrammeLevel>("EDITOR");

  // Gated on programme ownership, not on user_management.view. Using GET /users
  // here meant only a SUPER_ADMIN ever saw candidates: PROGRAM_MANAGER holds
  // programmes.manage_members but not user_management.view, so the picker 403'd
  // for exactly the role that staffs programmes — and the error was swallowed,
  // leaving an empty dropdown with no explanation.
  //
  // The endpoint already excludes students and existing members, so the filter
  // that used to live here is gone: one answer, on the server.
  const {
    data: candidates = [],
    isLoading: loadingStaff,
    error: staffError,
  } = useEligibleProgrammeMembers(programmeId, adding);

  async function run(fn: () => Promise<unknown>) {
    onError(null);
    try { await fn(); } catch (e) {
      onError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ ...titleStyle, fontSize: 17 }}>Members</h2>
        {canManage && !adding && (
          <button style={secondaryButton} onClick={() => setAdding(true)}>Add member</button>
        )}
      </div>

      {canManage && adding && (
        <div style={{ ...cardStyle, padding: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <label style={formLabelStyle}>Staff member</label>
            <select
              style={inputStyle}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              disabled={loadingStaff || Boolean(staffError)}
            >
              <option value="">
                {loadingStaff
                  ? "Loading staff…"
                  : staffError
                    ? "Could not load staff"
                    : candidates.length === 0
                      ? "No staff left to add"
                      : "Select…"}
              </option>
              {candidates.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} — {u.role}{u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
            {/* An empty dropdown is indistinguishable from a failed one unless
                the failure is said out loud. */}
            {staffError && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>
                {staffError instanceof ApiError
                  ? staffError.message
                  : "Failed to load staff."}
              </div>
            )}
          </div>
          <div style={{ flex: "0 1 200px" }}>
            <label style={formLabelStyle}>Level</label>
            <select style={inputStyle} value={level} onChange={(e) => setLevel(e.target.value as ProgrammeLevel)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <div style={{ fontSize: 11, color: "rgba(3,72,82,0.5)", marginTop: 6 }}>{LEVEL_HELP[level]}</div>
          </div>
          <button
            style={{ ...primaryButton, opacity: !pick || setMember.isPending ? 0.6 : 1 }}
            disabled={!pick || setMember.isPending}
            onClick={() => run(async () => {
              await setMember.mutateAsync({ id: programmeId, userId: pick, level });
              setPick(""); setAdding(false);
            })}
          >
            Add
          </button>
          <button style={secondaryButton} onClick={() => { setAdding(false); setPick(""); }}>Cancel</button>
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(3,72,82,0.03)" }}>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Level</th>
              {canManage && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td style={tdStyle} colSpan={4}>Loading…</td></tr>}
            {!isLoading && members.length === 0 && (
              <tr><td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={4}>No members yet.</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.user_id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                <td style={tdStyle}>
                  {m.name}
                  {m.email && <div style={{ fontSize: 12, color: "rgba(3,72,82,0.5)" }}>{m.email}</div>}
                </td>
                <td style={tdStyle}>{m.role}</td>
                <td style={tdStyle}>
                  {canManage ? (
                    <select
                      style={{ ...inputStyle, padding: "6px 10px", width: "auto" }}
                      value={m.level}
                      onChange={(e) => run(() => setMember.mutateAsync({
                        id: programmeId, userId: m.user_id, level: e.target.value as ProgrammeLevel,
                      }))}
                    >
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  ) : <span style={levelBadge(m.level)}>{m.level}</span>}
                </td>
                {canManage && (
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      style={{ ...linkBtnStyle, color: "#b91c1c" }}
                      onClick={() => run(() => removeMember.mutateAsync({ id: programmeId, userId: m.user_id }))}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && (
        <div style={{ fontSize: 12, color: "rgba(3,72,82,0.55)" }}>
          A programme always keeps at least one OWNER — removing the last one is refused.
          Students cannot be members; they belong to a programme through their profile.
        </div>
      )}
    </section>
  );
}

// ── content ──────────────────────────────────────────────────────────────────

const KINDS: Array<{ key: ProgrammeContentKind; label: string; one: string }> = [
  { key: "courses", label: "Courses", one: "course" },
  { key: "assignments", label: "Assignments", one: "assignment" },
];

/**
 * What the programme owns, and what owning it grants.
 *
 * Two things are deliberately explicit rather than implied:
 *
 *  - `editable: false` is shown, not hidden. A course a foreign programme also
 *    teaches is owned here but the resolver fails closed on it, so members get
 *    no edit rights. A row that looks granted and is not is worse than a
 *    warning.
 *  - Only courses and assignments appear. Quizzes and bundles carry the same
 *    ownership column but nothing reads it, so offering them would report a
 *    grant that does not exist.
 */
function ContentSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: Notify }) {
  const { data: owned = [], isLoading } = useProgrammeContent(programmeId);
  const assign = useAssignProgrammeContent();
  const release = useReleaseProgrammeContent();

  const [kind, setKind] = useState<ProgrammeContentKind>("courses");
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState("");
  const { data: assignable = [], isLoading: loadingPick } =
    useAssignableContent(programmeId, kind, search, canManage);

  async function run(fn: () => Promise<unknown>) {
    onError(null);
    try { await fn(); } catch (e) {
      onError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  const notEditable = owned.filter((c) => !c.editable).length;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ ...titleStyle, fontSize: 17 }}>Content</h2>
      <div style={{ fontSize: 13, color: "rgba(3,72,82,0.6)", marginTop: -6 }}>
        Courses and assignments this programme owns. OWNERs and EDITORs can edit them;
        student data is never included.
      </div>

      {canManage && (
        <div style={{ ...cardStyle, padding: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 150px" }}>
            <label style={formLabelStyle}>Type</label>
            <select
              style={inputStyle}
              value={kind}
              onChange={(e) => { setKind(e.target.value as ProgrammeContentKind); setPick(""); }}
            >
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <div style={{ flex: "0 1 220px" }}>
            <label style={formLabelStyle}>Search</label>
            <input
              style={inputStyle}
              value={search}
              placeholder="Filter by title…"
              onChange={(e) => { setSearch(e.target.value); setPick(""); }}
            />
          </div>
          <div style={{ flex: "1 1 300px" }}>
            <label style={formLabelStyle}>Add to programme</label>
            <select style={inputStyle} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{loadingPick ? "Loading…" : "Select…"}</option>
              {assignable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <button
            style={{ ...primaryButton, opacity: !pick || assign.isPending ? 0.6 : 1 }}
            disabled={!pick || assign.isPending}
            onClick={() => run(async () => {
              const r = await assign.mutateAsync({ id: programmeId, kind, resourceId: pick });
              setPick("");
              // Assigned but not editable is a real outcome, not a failure —
              // say so at the moment it happens rather than leaving the admin
              // to notice a grey badge later.
              if (!r.editable) {
                onError(
                  "Added, but another programme also uses it — members get ownership, not edit rights.",
                  "info",
                );
              }
            })}
          >
            Add
          </button>
        </div>
      )}

      {canManage && assignable.length === 0 && !loadingPick && !search && (
        <div style={{ fontSize: 12, color: "rgba(3,72,82,0.5)" }}>
          Nothing available to add. The picker lists only unassigned {kind} you created
          or were invited to manage.
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(3,72,82,0.03)" }}>
            <tr>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Created by</th>
              <th style={thStyle}>Members can edit</th>
              {canManage && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td style={tdStyle} colSpan={5}>Loading…</td></tr>}
            {!isLoading && owned.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={5}>
                  This programme owns nothing yet, so membership grants no edit rights.
                </td>
              </tr>
            )}
            {owned.map((c) => (
              <tr key={`${c.kind}:${c.id}`} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                <td style={tdStyle}>{c.title}</td>
                <td style={tdStyle}>{c.kind === "courses" ? "Course" : "Assignment"}</td>
                <td style={tdStyle}>{c.created_by_name ?? "—"}</td>
                <td style={tdStyle}>
                  {c.editable
                    ? <span style={{ color: "#047857", fontWeight: 600 }}>Yes</span>
                    : <span style={{ color: "#b45309" }} title="Another programme also uses this, so editing stays with its creator.">
                        No — shared
                      </span>}
                </td>
                {canManage && (
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      style={{ ...linkBtnStyle, color: "#b91c1c" }}
                      onClick={() => run(() => release.mutateAsync({ id: programmeId, kind: c.kind, resourceId: c.id }))}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notEditable > 0 && (
        <div style={{ fontSize: 12, color: "rgba(3,72,82,0.6)" }}>
          {notEditable} item(s) are owned but shared with another programme. Editing those
          stays with their creator — that is deliberate, so one programme cannot change
          material another programme&apos;s students are sitting.
        </div>
      )}
    </section>
  );
}

// ── schools ──────────────────────────────────────────────────────────────────

function SchoolsSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: Notify }) {
  const { data: attached = [], isLoading } = useProgrammeSchools(programmeId);
  const attach = useAttachProgrammeSchool();
  const detach = useDetachProgrammeSchool();
  const [all, setAll] = useState<SchoolOption[]>([]);
  const [pick, setPick] = useState("");

  useEffect(() => {
    if (!canManage) return;
    fetchSchools().then(setAll).catch(() => setAll([]));
  }, [canManage]);

  const attachedIds = useMemo(() => new Set(attached.map((s) => s.school_id)), [attached]);
  const candidates = all.filter((s) => !attachedIds.has(s.id));

  async function run(fn: () => Promise<unknown>) {
    onError(null);
    try { await fn(); } catch (e) {
      onError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ ...titleStyle, fontSize: 17 }}>Schools</h2>

      {canManage && (
        <div style={{ ...cardStyle, padding: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <label style={formLabelStyle}>Attach a school</label>
            <select style={inputStyle} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Select…</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.district ? ` — ${s.district}` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            style={{ ...primaryButton, opacity: !pick || attach.isPending ? 0.6 : 1 }}
            disabled={!pick || attach.isPending}
            onClick={() => run(async () => {
              await attach.mutateAsync({ id: programmeId, schoolId: pick });
              setPick("");
            })}
          >
            Attach
          </button>
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(3,72,82,0.03)" }}>
            <tr>
              <th style={thStyle}>School</th>
              <th style={thStyle}>District</th>
              <th style={thStyle}>State</th>
              {canManage && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td style={tdStyle} colSpan={4}>Loading…</td></tr>}
            {!isLoading && attached.length === 0 && (
              <tr><td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={4}>No schools attached.</td></tr>
            )}
            {attached.map((s) => (
              <tr key={s.school_id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{s.district ?? "—"}</td>
                <td style={tdStyle}>{s.state ?? "—"}</td>
                {canManage && (
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      style={{ ...linkBtnStyle, color: "#b91c1c" }}
                      onClick={() => run(() => detach.mutateAsync({ id: programmeId, schoolId: s.school_id }))}
                    >
                      Detach
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && (
        <div style={{ fontSize: 12, color: "rgba(3,72,82,0.55)" }}>
          A school can host several programmes. Attaching one does not make its students
          members — detaching is refused while batches here still belong to this programme.
        </div>
      )}
    </section>
  );
}

// ── batches ──────────────────────────────────────────────────────────────────

/**
 * programme > school > batch, the middle level.
 *
 * Unlike content, attaching a batch grants nobody anything — nothing reads
 * batches.programme_id for authority. It makes the batch a CONSUMER, and the
 * closure check treats a batch in this programme as foreign to a course another
 * programme owns. So attaching can REVOKE that programme's editors' rights on
 * their own course. The impact preview runs before the click, not after.
 *
 * Only batches at a school this programme already hosts can be offered: the 088
 * composite FK rejects anything else, so listing them would only produce errors.
 */
function BatchesSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: Notify }) {
  const { data: attached = [], isLoading } = useProgrammeBatches(programmeId);
  const { data: assignable = [], isLoading: loadingPick } =
    useAssignableBatches(programmeId, canManage);
  const attach = useAttachProgrammeBatch();
  const detach = useDetachProgrammeBatch();

  const [pick, setPick] = useState("");
  const [impact, setImpact] = useState<BatchImpact[] | null>(null);
  // Separate from `impact === null`, which also means "not checked yet". Folding
  // the two together made a failed check render nothing — neither the amber
  // warning nor the green all-clear — so the user pressed Attach blind, which is
  // the exact thing this preview exists to prevent.
  const [impactFailed, setImpactFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  // Look up the consequence as soon as a batch is chosen, so the warning is on
  // screen before Attach is pressed rather than after.
  useEffect(() => {
    setImpact(null);
    setImpactFailed(false);
    if (!pick) return;
    let cancelled = false;
    setChecking(true);
    getBatchImpact(programmeId, pick)
      .then((r) => { if (!cancelled) setImpact(r); })
      .catch(() => { if (!cancelled) setImpactFailed(true); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [programmeId, pick]);

  async function run(fn: () => Promise<unknown>) {
    onError(null);
    try { await fn(); } catch (e) {
      onError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ ...titleStyle, fontSize: 17 }}>Batches</h2>
      <div style={{ fontSize: 13, color: "rgba(3,72,82,0.6)", marginTop: -6 }}>
        Batches belonging to this programme. Only batches at a school this programme hosts
        can be added — attach the school first.
      </div>

      {canManage && (
        <div style={{ ...cardStyle, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px" }}>
              <label style={formLabelStyle}>Add a batch</label>
              <select style={inputStyle} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">
                  {loadingPick
                    ? "Loading…"
                    : assignable.length === 0
                      ? "No unassigned batches at this programme's schools"
                      : "Select…"}
                </option>
                {assignable.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.school_name ? ` — ${b.school_name}` : ""}
                    {b.course_count ? ` (${b.course_count} course${b.course_count === 1 ? "" : "s"})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              style={{ ...primaryButton, opacity: !pick || attach.isPending ? 0.6 : 1 }}
              disabled={!pick || attach.isPending}
              onClick={() => run(async () => {
                const r = await attach.mutateAsync({ id: programmeId, batchId: pick });
                setPick("");
                // The server reports what the attach actually cost. Discarding
                // it meant a no-op and a batch that revoked five courses looked
                // identical.
                if (!r.attached) {
                  onError("That batch already belongs to this programme.", "info");
                } else if (r.revokes_edit_on > 0) {
                  onError(
                    `Batch added. ${r.revokes_edit_on} course${r.revokes_edit_on === 1 ? "" : "s"} owned by another programme ${r.revokes_edit_on === 1 ? "is" : "are"} now shared, so their editors lost edit rights.`,
                    "info",
                  );
                }
              })}
            >
              Add
            </button>
          </div>

          {checking && (
            <div style={{ fontSize: 12, color: "rgba(3,72,82,0.5)" }}>Checking impact…</div>
          )}
          {impact !== null && impact.length > 0 && (
            <div style={{ ...noticeStyle, borderColor: "#f59e0b", background: "rgba(245,158,11,0.06)" }}>
              <strong>This removes edit rights from another programme.</strong> This batch
              teaches {impact.length} course{impact.length === 1 ? "" : "s"} owned elsewhere.
              Once the batch belongs here those courses are shared across programmes, so
              their owners keep ownership and lose editing:
              <ul style={{ margin: "8px 0 0 18px" }}>
                {impact.map((c) => (
                  <li key={c.course_id}>
                    {c.title} <span style={{ opacity: 0.7 }}>— {c.owner_programme}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {impact !== null && impact.length === 0 && pick && !checking && (
            <div style={{ fontSize: 12, color: "#067a45" }}>
              No side effects — this batch teaches nothing another programme owns.
            </div>
          )}
          {impactFailed && !checking && (
            <div style={{ ...noticeStyle, borderColor: "#f59e0b", background: "rgba(245,158,11,0.06)" }}>
              Could not check what attaching this batch would affect. Adding it may still
              remove edit rights from another programme.
            </div>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(3,72,82,0.03)" }}>
            <tr>
              <th style={thStyle}>Batch</th>
              <th style={thStyle}>School</th>
              <th style={thStyle}>Courses</th>
              <th style={thStyle}>Status</th>
              {canManage && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td style={tdStyle} colSpan={5}>Loading…</td></tr>}
            {!isLoading && attached.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={5}>
                  No batches in this programme yet.
                </td>
              </tr>
            )}
            {attached.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                <td style={tdStyle}>{b.name}</td>
                <td style={tdStyle}>{b.school_name ?? "—"}</td>
                <td style={tdStyle}>{b.course_count}</td>
                <td style={tdStyle}>{b.status ?? "—"}</td>
                {canManage && (
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      style={{ ...linkBtnStyle, color: "#b91c1c" }}
                      onClick={() => run(() => detach.mutateAsync({ id: programmeId, batchId: b.id }))}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── archive ──────────────────────────────────────────────────────────────────

function DangerSection({
  programmeId, status, onError,
}: { programmeId: string; status: "ACTIVE" | "ARCHIVED"; onError: Notify }) {
  const update = useUpdateProgramme();
  const archived = status === "ARCHIVED";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      <h2 style={{ ...titleStyle, fontSize: 17 }}>{archived ? "Restore" : "Archive"}</h2>
      <div style={{ ...cardStyle, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "rgba(3,72,82,0.7)", maxWidth: 560, lineHeight: 1.6 }}>
          {archived
            ? "Restoring makes the programme active again and restores every member's level."
            : "Archiving keeps the programme and its members on record, but immediately revokes what membership grants. Reversible."}
        </div>
        <button
          style={archived ? primaryButton : { ...secondaryButton, color: "#b91c1c", borderColor: "rgba(185,28,28,0.3)" }}
          disabled={update.isPending}
          onClick={async () => {
            onError(null);
            try {
              await update.mutateAsync({ id: programmeId, payload: { status: archived ? "ACTIVE" : "ARCHIVED" } });
            } catch (e) {
              onError(e instanceof ApiError ? e.message : "Failed to update programme.");
            }
          }}
        >
          {archived ? "Restore programme" : "Archive programme"}
        </button>
      </div>
    </section>
  );
}
