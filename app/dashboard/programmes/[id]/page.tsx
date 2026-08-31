"use client";
import { ZONE, ZONE_LOWER, roleLabel } from "@/lib/labels";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  ApiError, fetchSchools, getBatchImpact,
  type BatchImpact, type ProgrammeContentKind, type ProgrammeLevel,
  type ProgrammeOverview, type ProgrammeStudent, type SchoolOption,
} from "@/lib/api";
import {
  useAssignableBatches, useAssignableContent, useEligibleProgrammeMembers, useProgramme,
  useProgrammeBatches, useProgrammeContent, useProgrammeMembers, useProgrammeSchools,
  useProgrammeOverview, useProgrammeStudents,
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
import { SearchMultiPicker } from "@/components/SearchMultiPicker";

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
  EDITOR: "Can edit the courses, assignments and resources this programme already owns.",
  VIEWER: "Read-only. No student data.",
};

/**
 * The hub is a workspace, not a report, so it is tabbed rather than a single
 * stacked scroll. The old page rendered all five sections at once, which meant
 * every visit fetched members, content, schools and batches even when the
 * operator came to do one thing — and put the destructive Archive control
 * directly under the batch table.
 *
 * Tabs also make the roster affordable: students are only fetched once that tab
 * is opened.
 */
const TABS = [
  { key: "people",   label: "People" },
  { key: "students", label: "Students" },
  { key: "analytics", label: "Analytics" },
  { key: "schools",  label: "Schools" },
  { key: "batches",  label: "Batches" },
  { key: "content",  label: "Content" },
  { key: "settings", label: "Settings" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    border: "none",
    borderRadius: "10px",
    background: active ? "rgba(10,190,98,0.12)" : "transparent",
    color: active ? "#046b45" : "rgba(3,72,82,0.65)",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { has, isSuperAdmin } = usePermissions();
  const canEdit = has(PERM.programmes.edit);
  const canManageMembers = has(PERM.programmes.manage_members);

  const { data: programme, isLoading, error } = useProgramme(id);
  const [tab, setTab] = useState<TabKey>("people");
  const [banner, setBanner] = useState<Banner | null>(null);
  const notify: Notify = (message, tone = "error") =>
    setBanner(message === null ? null : { text: message, tone });

  // Only an OWNER (or a super admin, whom the API lets through) can actually
  // write. Showing the controls to anyone else just produces 403s.
  const isOwner = programme?.my_level === "OWNER";
  // `has("*")` was never a permission — it only ever returned true because
  // usePermissions short-circuited on the SUPER_ADMIN role code. With that
  // wildcard gone it would be permanently false, so the real permission is named
  // instead. A super admin holds it explicitly, so nothing changes for them.
  const mayAdminister = canEdit && (isOwner || isSuperAdmin);

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

      <div
        role="tablist"
        aria-label="Programme sections"
        style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid rgba(3,72,82,0.08)", paddingBottom: 8 }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            style={tabStyle(tab === t.key)}
            onClick={() => { setTab(t.key); notify(null); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <PeopleSection
          programmeId={id}
          canManage={canManageMembers && (isOwner || isSuperAdmin)}
          onError={notify}
        />
      )}
      {tab === "students" && <StudentsSection programmeId={id} />}
      {tab === "analytics" && <AnalyticsSection programmeId={id} />}
      {tab === "schools" && <SchoolsSection programmeId={id} canManage={mayAdminister} onError={notify} />}
      {tab === "batches" && <BatchesSection programmeId={id} canManage={mayAdminister} onError={notify} />}
      {tab === "content" && <ContentSection programmeId={id} canManage={mayAdminister} onError={notify} />}
      {tab === "settings" && (
        mayAdminister
          ? <DangerSection programmeId={id} status={programme.status} onError={notify} />
          : <div style={noticeStyle}>Only an owner of this programme can change its settings.</div>
      )}
    </div>
  );
}

// ── people ───────────────────────────────────────────────────────────────────

/**
 * Staff order, broadest first. The hub groups people by ROLE rather than by
 * membership level because that is the question an operator actually arrives
 * with — "who runs this programme, and who is on the ground" — and because the
 * programme-root design makes the role the thing that decides reach.
 *
 * Roles are read from the data, so a role added later still renders; this list
 * only fixes the order of the ones we know about.
 */
const ROLE_ORDER = ["SUPER_ADMIN", "PROGRAM_MANAGER", "ZONAL_MANAGER", "FELLOW"];

function roleRank(role: string): number {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
}

function PeopleSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: Notify }) {
  const { data: members = [], isLoading } = useProgrammeMembers(programmeId);
  const setMember = useSetProgrammeMember();
  const removeMember = useRemoveProgrammeMember();

  const [adding, setAdding] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
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

  // Grouped by role, broadest first, names alphabetical inside each group.
  const grouped = useMemo(() => {
    const by = new Map<string, typeof members>();
    for (const m of members) by.set(m.role, [...(by.get(m.role) ?? []), m]);
    return [...by.entries()]
      .sort(([a], [b]) => roleRank(a) - roleRank(b) || a.localeCompare(b))
      .map(([role, rows]) => [role, [...rows].sort((x, y) => x.name.localeCompare(y.name))] as const);
  }, [members]);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ ...titleStyle, fontSize: 17 }}>People</h2>
        {canManage && !adding && (
          <button style={secondaryButton} onClick={() => setAdding(true)}>Add member</button>
        )}
      </div>

      {canManage && adding && (
        <div style={{ ...cardStyle, padding: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label style={formLabelStyle}>Staff members</label>
            <SearchMultiPicker
              options={candidates.map((u) => ({
                id: u.user_id,
                label: u.name,
                sublabel: [u.role, u.email].filter(Boolean).join(" · "),
              }))}
              value={picks}
              onChange={setPicks}
              isLoading={loadingStaff}
              disabled={Boolean(staffError)}
              placeholder="Search staff by name, role or email…"
              emptyText="No staff left to add."
            />
            {/* An empty picker is indistinguishable from a failed one unless
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
            <div style={{ fontSize: 11, color: "rgba(3,72,82,0.5)", marginTop: 6 }}>
              {LEVEL_HELP[level]}
              {picks.length > 1 ? ` Applies to all ${picks.length} selected.` : ""}
            </div>
          </div>
          <button
            style={{ ...primaryButton, opacity: picks.length === 0 || setMember.isPending ? 0.6 : 1 }}
            disabled={picks.length === 0 || setMember.isPending}
            onClick={() => run(async () => {
              // Sequential on purpose: each add is its own authority check, and
              // a partial success must say exactly who failed.
              const failed: string[] = [];
              for (const userId of picks) {
                try {
                  await setMember.mutateAsync({ id: programmeId, userId, level });
                } catch {
                  const who = candidates.find((c) => c.user_id === userId);
                  failed.push(who?.name ?? userId);
                }
              }
              if (failed.length > 0) {
                setPicks(picks.filter((p) => failed.includes(candidates.find((c) => c.user_id === p)?.name ?? p)));
                throw new ApiError(
                  `Added ${picks.length - failed.length} of ${picks.length} — failed: ${failed.join(", ")}.`,
                  400,
                );
              }
              setPicks([]); setAdding(false);
            })}
          >
            {setMember.isPending ? "Adding…" : picks.length > 1 ? `Add ${picks.length}` : "Add"}
          </button>
          <button style={secondaryButton} onClick={() => { setAdding(false); setPicks([]); }}>Cancel</button>
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
              <tr><td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={4}>No one is on this programme yet.</td></tr>
            )}
            {grouped.map(([role, rows]) => (
              <Fragment key={role}>
                <tr style={{ background: "rgba(3,72,82,0.03)", borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                  <td style={{ ...tdStyle, ...labelStyle, paddingTop: 10, paddingBottom: 10 }} colSpan={canManage ? 4 : 3}>
                    {roleLabel(role)} · {rows.length}
                  </td>
                </tr>
                {rows.map((m) => (
              <tr key={m.user_id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                <td style={tdStyle}>
                  {m.name}
                  {m.email && <div style={{ fontSize: 12, color: "rgba(3,72,82,0.5)" }}>{m.email}</div>}
                </td>
                <td style={tdStyle}>{roleLabel(m.role)}</td>
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
              </Fragment>
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

// ── analytics ────────────────────────────────────────────────────────────────

function statCard(label: string, value: string, hint?: string) {
  return (
    <div key={label} style={{ ...cardStyle, padding: "16px 18px", minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 26, fontWeight: 700, color: "#034852" }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: "rgba(3,72,82,0.5)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/**
 * Programme-level numbers.
 *
 * The activity figures come from the immutable programme stamped on each fact
 * when it was written, NOT from the student's current programme. That is the
 * difference between "how did this programme do last term" and "how are the
 * people who happen to be in it today doing" — and only the first is stable when
 * someone transfers. Said on screen, because a number nobody can interpret is
 * worse than no number.
 */
function AnalyticsSection({ programmeId }: { programmeId: string }) {
  const { data, isLoading, error } = useProgrammeOverview(programmeId);

  if (isLoading) return <div style={{ color: "rgba(3,72,82,0.6)" }}>Loading…</div>;
  if (error || !data) return <div style={errorStyle}>Failed to load programme overview.</div>;

  const o: ProgrammeOverview = data;
  const contentTotal = o.content.courses + o.content.assignments + o.content.resources;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ ...titleStyle, fontSize: 17 }}>Analytics</h2>

      <div>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Reach</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {statCard("Students", String(o.students))}
          {statCard("Schools", String(o.schools))}
          {statCard("Batches", String(o.batches))}
          {statCard("Staff", String(o.staff))}
        </div>
      </div>

      <div>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Content owned</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {statCard("Courses", String(o.content.courses))}
          {statCard("Assignments", String(o.content.assignments))}
          {statCard("Resources", String(o.content.resources))}
        </div>
        {contentTotal === 0 && (
          <div style={{ ...noticeStyle, marginTop: 10 }}>
            This programme owns no content yet. Until it does, its members see an empty
            Quizzes tab — assign courses on the Content tab.
          </div>
        )}
      </div>

      <div>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Activity</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {statCard("Quiz attempts", String(o.activity.attempts))}
          {statCard("Average score", o.activity.avg_score === null ? "—" : `${o.activity.avg_score}%`,
            o.activity.avg_score === null ? "no completed attempts yet" : undefined)}
          {statCard("Attendance marks", String(o.activity.attendance_marks))}
          {statCard("Tracker records", String(o.activity.tracker_records))}
        </div>
        <div style={{ ...noticeStyle, marginTop: 10 }}>
          Activity counts what happened <strong>in this programme</strong>, recorded at the
          time. A student who transfers takes their future work with them and leaves their
          history here, so these figures do not change retrospectively.
        </div>
      </div>
    </section>
  );
}

// ── students ─────────────────────────────────────────────────────────────────

/**
 * The programme's roster, read-only.
 *
 * There is no "add student" control here on purpose. A student joins a
 * programme by having `users.programme_id` set, or by being enrolled in one of
 * its batches — both of which happen in User management and Batches. Offering a
 * third way in here would create a fourth answer to "which programme is this
 * student in", which is the ambiguity the programme-root work exists to remove.
 *
 * `via` is shown because the two routes are not equivalent: a PROGRAMME student
 * belongs to it, whereas a BATCH student is reached through an owned batch and
 * would stop being reachable if that batch moved.
 */
function StudentsSection({ programmeId }: { programmeId: string }) {
  const { data: students = [], isLoading, error } = useProgrammeStudents(programmeId);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (s: ProgrammeStudent) =>
        s.name.toLowerCase().includes(needle) ||
        (s.roll_number ?? "").toLowerCase().includes(needle) ||
        (s.school_name ?? "").toLowerCase().includes(needle),
    );
  }, [students, q]);

  const viaBatch = students.filter((s: ProgrammeStudent) => s.via === "BATCH").length;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ ...titleStyle, fontSize: 17 }}>Students</h2>
        {students.length > 0 && (
          <input
            style={{ ...inputStyle, width: 260 }}
            placeholder="Search name, roll number or school"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
      </div>

      {error && <div style={errorStyle}>Failed to load students.</div>}

      {!isLoading && students.length > 0 && (
        <div style={noticeStyle}>
          {students.length} student{students.length === 1 ? "" : "s"}
          {viaBatch > 0 && <> · {viaBatch} reached through a batch rather than being assigned to this programme</>}
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(3,72,82,0.03)" }}>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Roll number</th>
              <th style={thStyle}>School</th>
              <th style={thStyle}>Reached via</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td style={tdStyle} colSpan={4}>Loading…</td></tr>}
            {!isLoading && students.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={4}>
                  No students yet. A student joins by being assigned to this programme in
                  User management, or by being enrolled in one of its batches.
                </td>
              </tr>
            )}
            {!isLoading && students.length > 0 && filtered.length === 0 && (
              <tr><td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={4}>No student matches “{q}”.</td></tr>
            )}
            {filtered.map((s: ProgrammeStudent) => (
              <tr key={s.user_id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                <td style={tdStyle}>
                  {s.name}
                  {s.status !== "ACTIVE" && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "rgba(3,72,82,0.45)" }}>
                      {s.status}
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 13 }}>{s.roll_number ?? "—"}</td>
                <td style={tdStyle}>{s.school_name ?? "—"}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                      background: s.via === "PROGRAMME" ? "rgba(10,190,98,0.12)" : "rgba(3,72,82,0.07)",
                      color: s.via === "PROGRAMME" ? "#046b45" : "rgba(3,72,82,0.7)",
                    }}
                    title={
                      s.via === "PROGRAMME"
                        ? "Assigned to this programme directly."
                        : "Reached through one of this programme's batches. Moving that batch would end it."
                    }
                  >
                    {s.via === "PROGRAMME" ? "Programme" : "Batch"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── content ──────────────────────────────────────────────────────────────────

const KINDS: Array<{ key: ProgrammeContentKind; label: string; one: string; row: string }> = [
  { key: "courses", label: "Courses", one: "course", row: "Course" },
  { key: "assignments", label: "Assignments", one: "assignment", row: "Assignment" },
  { key: "resources", label: "Resources", one: "resource", row: "Resource" },
];

const KIND_ROW_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.row])) as Record<
  ProgrammeContentKind,
  string
>;

/**
 * What the programme owns, and what owning it grants.
 *
 * Two things are deliberately explicit rather than implied:
 *
 *  - `editable: false` is shown, not hidden. A course a foreign programme also
 *    teaches is owned here but the resolver fails closed on it, so members get
 *    no edit rights. A row that looks granted and is not is worse than a
 *    warning.
 *  - Courses, assignments and resources appear; quizzes and bundles do not.
 *    Those two carry the same ownership column but nothing reads it, so
 *    offering them would report a grant that does not exist.
 *  - Resources are the strictest of the three. One is offered here only when it
 *    targets batches this programme has claimed. A resource aimed at a whole
 *    school never qualifies, because hosting a school is not the same as owning
 *    its students, so no programme can be said to bound who it reaches.
 */
function ContentSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: Notify }) {
  const { data: owned = [], isLoading } = useProgrammeContent(programmeId);
  const assign = useAssignProgrammeContent();
  const release = useReleaseProgrammeContent();

  const [kind, setKind] = useState<ProgrammeContentKind>("courses");
  const [search, setSearch] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
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
        Courses, assignments and resources this programme owns. OWNERs and EDITORs can edit them;
        student data is never included.
      </div>

      {canManage && (
        <div style={{ ...cardStyle, padding: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 150px" }}>
            <label style={formLabelStyle}>Type</label>
            <select
              style={inputStyle}
              value={kind}
              onChange={(e) => { setKind(e.target.value as ProgrammeContentKind); setPicks([]); setSearch(""); }}
            >
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 320px" }}>
            <label style={formLabelStyle}>Add to programme</label>
            {/* Server-search mode: typing re-queries the assignable list (the
                server caps at 50), and picks made under one query survive the
                next — the picker caches every option it has seen. */}
            <SearchMultiPicker
              options={assignable.map((c) => ({ id: c.id, label: c.title }))}
              value={picks}
              onChange={setPicks}
              onQueryChange={setSearch}
              isLoading={loadingPick}
              placeholder={`Search ${kind} by title…`}
              emptyText={`Nothing available to add. Only unassigned ${kind} you created or were invited to manage are offered.`}
            />
          </div>
          <button
            style={{ ...primaryButton, opacity: picks.length === 0 || assign.isPending ? 0.6 : 1 }}
            disabled={picks.length === 0 || assign.isPending}
            onClick={() => run(async () => {
              // Sequential on purpose: each assign is its own double gate, and
              // a partial success must say exactly what failed.
              const failed: string[] = [];
              let shared = 0;
              for (const resourceId of picks) {
                try {
                  const r = await assign.mutateAsync({ id: programmeId, kind, resourceId });
                  if (!r.editable) shared += 1;
                } catch {
                  failed.push(resourceId);
                }
              }
              setPicks(failed);
              // Assigned but not editable is a real outcome, not a failure —
              // say so at the moment it happens rather than leaving the admin
              // to notice a grey badge later.
              if (shared > 0) {
                onError(
                  `${shared} added but another programme also uses ${shared === 1 ? "it" : "them"} — members get ownership, not edit rights.`,
                  "info",
                );
              }
              if (failed.length > 0) {
                throw new ApiError(
                  `Added ${picks.length - failed.length} of ${picks.length} — the rest stay selected, try again.`,
                  400,
                );
              }
            })}
          >
            {assign.isPending ? "Adding…" : picks.length > 1 ? `Add ${picks.length}` : "Add"}
          </button>
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
                <td style={tdStyle}>{KIND_ROW_LABEL[c.kind] ?? c.kind}</td>
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
  const [picks, setPicks] = useState<string[]>([]);

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
            <label style={formLabelStyle}>Attach schools</label>
            <SearchMultiPicker
              options={candidates.map((s) => ({
                id: s.id,
                label: s.name,
                sublabel: [s.code, s.district, s.state].filter(Boolean).join(" · ") || undefined,
              }))}
              value={picks}
              onChange={setPicks}
              placeholder={`Search schools by name, code or ${ZONE_LOWER}…`}
              emptyText="No schools left to attach."
            />
          </div>
          <button
            style={{ ...primaryButton, opacity: picks.length === 0 || attach.isPending ? 0.6 : 1 }}
            disabled={picks.length === 0 || attach.isPending}
            onClick={() => run(async () => {
              const failed: string[] = [];
              for (const schoolId of picks) {
                try {
                  await attach.mutateAsync({ id: programmeId, schoolId });
                } catch {
                  failed.push(candidates.find((c) => c.id === schoolId)?.name ?? schoolId);
                }
              }
              setPicks([]);
              if (failed.length > 0) {
                throw new ApiError(
                  `Attached ${picks.length - failed.length} of ${picks.length} — failed: ${failed.join(", ")}.`,
                  400,
                );
              }
            })}
          >
            {attach.isPending ? "Attaching…" : picks.length > 1 ? `Attach ${picks.length}` : "Attach"}
          </button>
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(3,72,82,0.03)" }}>
            <tr>
              <th style={thStyle}>School</th>
              <th style={thStyle}>{ZONE}</th>
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

  const [picks, setPicks] = useState<string[]>([]);
  const [impact, setImpact] = useState<BatchImpact[] | null>(null);
  // Separate from `impact === null`, which also means "not checked yet". Folding
  // the two together made a failed check render nothing — neither the amber
  // warning nor the green all-clear — so the user pressed Attach blind, which is
  // the exact thing this preview exists to prevent.
  const [impactFailed, setImpactFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  // Look up the consequence as soon as batches are chosen, so the warning is on
  // screen before Attach is pressed rather than after. The preview covers the
  // WHOLE selection: attaching three batches at once has the union of their
  // costs, and a warning that described only one of them would understate it.
  useEffect(() => {
    setImpact(null);
    setImpactFailed(false);
    if (picks.length === 0) return;
    let cancelled = false;
    setChecking(true);
    Promise.allSettled(picks.map((b) => getBatchImpact(programmeId, b)))
      .then((results) => {
        if (cancelled) return;
        // allSettled, not all: one failed lookup must not hide the impacts that
        // did come back — it downgrades the notice, it does not erase it.
        const byCourse = new Map<string, BatchImpact>();
        for (const r of results) {
          if (r.status === "fulfilled") {
            // Two picked batches can teach the same course; name it once.
            for (const c of r.value) byCourse.set(c.course_id, c);
          }
        }
        setImpact([...byCourse.values()]);
        setImpactFailed(results.some((r) => r.status === "rejected"));
      })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [programmeId, picks]);

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
              <label style={formLabelStyle}>Add batches</label>
              <SearchMultiPicker
                options={assignable.map((b) => ({
                  id: b.id,
                  label: b.name,
                  sublabel: [
                    b.school_name,
                    b.course_count ? `${b.course_count} course${b.course_count === 1 ? "" : "s"}` : null,
                  ].filter(Boolean).join(" · ") || undefined,
                }))}
                value={picks}
                onChange={setPicks}
                isLoading={loadingPick}
                placeholder="Search batches by name or school…"
                emptyText="No unassigned batches at this programme's schools."
              />
            </div>
            <button
              style={{ ...primaryButton, opacity: picks.length === 0 || attach.isPending ? 0.6 : 1 }}
              disabled={picks.length === 0 || attach.isPending}
              onClick={() => run(async () => {
                // The server reports what each attach actually cost. Discarding
                // it meant a no-op and a batch that revoked five courses looked
                // identical.
                const failed: string[] = [];
                let noop = 0;
                let revoked = 0;
                for (const batchId of picks) {
                  try {
                    const r = await attach.mutateAsync({ id: programmeId, batchId });
                    if (!r.attached) noop += 1;
                    revoked += r.revokes_edit_on;
                  } catch {
                    failed.push(assignable.find((b) => b.id === batchId)?.name ?? batchId);
                  }
                }
                setPicks([]);
                if (revoked > 0) {
                  onError(
                    `Batches added. ${revoked} course${revoked === 1 ? "" : "s"} owned by another programme ${revoked === 1 ? "is" : "are"} now shared, so their editors lost edit rights.`,
                    "info",
                  );
                } else if (noop > 0 && failed.length === 0) {
                  onError(
                    `${noop === picks.length ? "Already attached" : `${noop} already attached`} to this programme.`,
                    "info",
                  );
                }
                if (failed.length > 0) {
                  throw new ApiError(
                    `Attached ${picks.length - failed.length} of ${picks.length} — failed: ${failed.join(", ")}.`,
                    400,
                  );
                }
              })}
            >
              {attach.isPending ? "Adding…" : picks.length > 1 ? `Add ${picks.length}` : "Add"}
            </button>
          </div>

          {checking && (
            <div style={{ fontSize: 12, color: "rgba(3,72,82,0.5)" }}>Checking impact…</div>
          )}
          {impact !== null && impact.length > 0 && (
            <div style={{ ...noticeStyle, borderColor: "#f59e0b", background: "rgba(245,158,11,0.06)" }}>
              <strong>This removes edit rights from another programme.</strong>{" "}
              {picks.length === 1 ? "This batch teaches" : "These batches teach"} {impact.length} course
              {impact.length === 1 ? "" : "s"} owned elsewhere.
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
          {impact !== null && impact.length === 0 && picks.length > 0 && !checking && !impactFailed && (
            <div style={{ fontSize: 12, color: "#067a45" }}>
              No side effects — {picks.length === 1 ? "this batch teaches" : "these batches teach"} nothing
              another programme owns.
            </div>
          )}
          {impactFailed && !checking && (
            <div style={{ ...noticeStyle, borderColor: "#f59e0b", background: "rgba(245,158,11,0.06)" }}>
              Could not check what attaching {picks.length === 1 ? "this batch" : "every selected batch"} would
              affect. Adding {picks.length === 1 ? "it" : "them"} may still remove edit rights from another
              programme.
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
