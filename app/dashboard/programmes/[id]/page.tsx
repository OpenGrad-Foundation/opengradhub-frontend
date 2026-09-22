"use client";

import { BatchImpactNotice, mergeBatchImpacts } from "@/components/programme-batch-impact";
import { IN_CHARGE, ROLE_LABELS, ZONE, ZONE_LOWER, roleLabel } from "@/lib/labels";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { usePermissions, usePermission, useAnyPermission } from "@/hooks/use-permission";
import { useCurrentUser } from "@/lib/queries/current-user";
import { PERM, programmeCapabilities, STUDENT_PROFILE_PERMISSIONS } from "@/lib/permissions";
import {
  ApiError, fetchSchools, getBatchImpact,
  type BatchImpact, type ProgrammeContentKind,
  type ProgrammeOverview, type ProgrammeStudent, type SchoolOption,
  type ProgrammeReachVia, type ProgrammeSchool, type ProgrammeMember,
} from "@/lib/api";
import {
  useAssignableBatches, useAssignableContent, useEligibleProgrammeMembers, useProgramme,
  useProgrammeBatches, useProgrammeContent, useProgrammeMembers, useProgrammeSchools,
  useProgrammeOverview, useProgrammeStudents, useEligibleProgrammeStudents,
} from "@/lib/queries/programmes";
import {
  useAssignProgrammeContent, useAttachProgrammeBatch, useAttachProgrammeSchool,
  useDetachProgrammeBatch, useDetachProgrammeSchool, useReleaseProgrammeContent,
  useAddProgrammeMember, useAddProgrammeStudents, useRemoveProgrammeMember, useUpdateProgramme,
} from "@/lib/mutations/programmes";
import { ArrowLeft, Search, UserPlus } from "lucide-react";
import { Tabs } from "../../_components/Tabs";
import cat from "../../_components/catalogue.module.css";
import workspace from "@/components/dashboard/workspace.module.css";
import ui from "../programmes.module.css";
import { SearchMultiPicker } from "@/components/SearchMultiPicker";
import { EntityLink } from "../_components/entity-link";
import { useRowNavigation } from "../_components/use-row-navigation";
import { readProgrammeState, updateProgrammeUrl, withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { BackLink } from "@/components/back-link";

/**
 * Not every message worth showing is a failure. Attaching content that another
 * programme also uses SUCCEEDS — it just grants less than the operator may
 * expect — and rendering that in the red error box read as "this did not work".
 */
type BannerTone = "error" | "info";
type Banner = { text: string; tone: BannerTone };
type Notify = (message: string | null, tone?: BannerTone) => void;

/** Table links read as text, not as a second brand colour competing with the primary button. */
const LINK: React.CSSProperties = { color: "var(--color-text)", fontWeight: 600 };

/**
 * What membership means, stated in the UI so it is not folklore.
 *
 * This used to be a level-by-level table — OWNER administers, EDITOR edits,
 * VIEWER reads. Backend migration 119 retired those: adding someone puts them in
 * the programme, and what they may do there is decided by their permissions.
 * Saying so plainly is the point, because the old screen let an operator believe
 * the dropdown was the authority when the permission always was.
 */
const MEMBERSHIP_HELP =
  "Adds them to this programme. Actions follow their effective permissions. " +
  "Operational access remains limited to their assigned batches and permitted scope.";

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
  { key: "overview", label: "Overview" },
  { key: "people",   label: "People" },
  { key: "students", label: "Students" },
  { key: "schools",  label: "Schools" },
  { key: "batches",  label: "Batches" },
  { key: "content",  label: "Content" },
  { key: "settings", label: "Settings" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { has } = usePermissions();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: me } = useCurrentUser();

  const { data: programme, isLoading, error } = useProgramme(id);
  // Overview lands first. People was the default because it was the only tab
  // when this page was a membership editor; the hub now answers "how is this
  // programme doing" before "who is on it", and the numbers are the cheapest
  // thing here to fetch.
  const { tab } = readProgrammeState(params);
  const setTab = (tab: TabKey) => router.replace(updateProgrammeUrl(pathname, params, { tab }), { scroll: false });
  const [banner, setBanner] = useState<Banner | null>(null);
  const notify: Notify = (message, tone = "error") =>
    setBanner(message === null ? null : { text: message, tone });

  const isMember = Boolean(programme?.is_member);
  const capabilities = programmeCapabilities(has, isMember);
  const mayAdminister = capabilities.manage;
  // Assigning a student writes users.programme_id, so the button needs the user
  // edit right on top of administering this programme. The server enforces the
  // same three; this only decides whether the control is worth showing.
  const mayAssignStudents = mayAdminister && capabilities.students && has(PERM.user_management.edit);

  if (isLoading) return <div role="status" className={cat.resultsLabel}>Loading programme…</div>;
  if (error || !programme) {
    return (
      <div role="alert" className={ui.error}>
        {error instanceof ApiError && error.status === 404
          ? "Programme not found, or you are not a member of it."
          : "Failed to load programme."}
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => t.key !== "students" || capabilities.students);
  // A deep link to a tab this caller cannot see lands on Overview; the notice
  // below still says why, and the roster is never mounted (so never fetched).
  const activeTab: TabKey = visibleTabs.some((t) => t.key === tab) ? tab : "overview";
  const panel = (
    <>
      {activeTab === "people" && (
        <PeopleSection
          programmeId={id}
          canManage={capabilities.manageMembers}
          onError={notify}
        />
      )}
      {activeTab === "students" && <StudentsSection programmeId={id} canAssign={mayAssignStudents} onError={notify} />}
      {activeTab === "overview" && <OverviewSection programmeId={id} />}
      {activeTab === "schools" && <SchoolsSection programmeId={id} canManage={mayAdminister} onError={notify} />}
      {activeTab === "batches" && <BatchesSection programmeId={id} canManage={mayAdminister} onError={notify} />}
      {activeTab === "content" && <ContentSection programmeId={id} canManage={mayAdminister} onError={notify} />}
      {activeTab === "settings" && (
        mayAdminister
          ? <DangerSection programmeId={id} status={programme.status} onError={notify} />
          : (
            <div className={ui.notice}>
              Changing a programme&rsquo;s settings needs the{" "}
              <strong>Manage Programmes</strong> permission and access to administer this programme.
            </div>
          )
      )}
    </>
  );

  return (
    <div className={`${workspace.workspace} ${ui.page}`}>
      <div className={ui.header}>
        <div className={ui.headerToolbar}>
          <BackLink fallback="/dashboard/programmes" className={cat.secondary}>
            <ArrowLeft size={16} aria-hidden="true" /><span><span className="hidden sm:inline">Back to </span>Programmes</span>
          </BackLink>
          {/* The role label is presentation; effective permissions decide actions. */}
          {isMember && me?.role?.code && (
            <span className={`${ui.pill} ${ui.pillInfo}`}>{roleLabel(me.role.code)}</span>
          )}
        </div>
        <div className={ui.identity}>
          <h2>{programme.name}</h2>
          <div className={ui.meta}>
            {programme.status === "ARCHIVED"
              ? <span className={`${ui.pill} ${ui.pillMuted}`}>Archived</span>
              : <span className={`${ui.pill} ${ui.pillGreen}`}>Active</span>}
            {programme.kind && <span>{programme.kind}</span>}
            {programme.state && <span>{programme.state}</span>}
            <span className={ui.code}>{programme.code}</span>
            {programme.cohort_label && <span>{programme.cohort_label}</span>}
          </div>
        </div>
      </div>

      {programme.status === "ARCHIVED" && (
        <div className={ui.notice}>
          This programme is archived. Editors cannot edit its content while it stays
          archived. Programme administrators keep administrative access, so this can be undone below.
        </div>
      )}
      {tab === "students" && !capabilities.students && (
        <div className={ui.notice}>Student access requires the View Students permission.</div>
      )}
      {banner && (
        <div role={banner.tone === "error" ? "alert" : "status"} className={banner.tone === "error" ? ui.error : ui.notice}>{banner.text}</div>
      )}

      <div className={`${workspace.stickyTabs} ${ui.tabs}`}>
        <Tabs
          ariaLabel="Programme sections"
          compactOnScroll
          activeKey={activeTab}
          onTabChange={(key) => { setTab(key as TabKey); notify(null); }}
          tabs={visibleTabs.map((t) => ({ key: t.key, label: t.label, panel }))}
        />
      </div>
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
  const canSeeContacts = usePermission(PERM.staff.view_contacts);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const addMember = useAddProgrammeMember();
  const removeMember = useRemoveProgrammeMember();

  const [adding, setAdding] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);

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

  // Two sections, then roles inside each. The split is the point: a seated
  // member is a `programme_members` row and can be removed here; a derived one
  // is reached because a school they run was attached, grants no authority at
  // all, and cannot be removed from this page — you detach the school instead.
  const sections = useMemo(() => {
    const bySource = (src: ProgrammeMember["source"]) => {
      const by = new Map<string, ProgrammeMember[]>();
      for (const m of members.filter((x: ProgrammeMember) => x.source === src)) {
        by.set(m.role, [...(by.get(m.role) ?? []), m]);
      }
      return [...by.entries()]
        .sort(([a], [b]) => roleRank(a) - roleRank(b) || a.localeCompare(b))
        .map(([role, rows]) => [role, [...rows].sort((x, y) => x.name.localeCompare(y.name))] as const);
    };
    return [
      { src: "MEMBER" as const, label: "Seated in this programme", groups: bySource("MEMBER") },
      { src: "SCHOOL" as const, label: "Reached through a school", groups: bySource("SCHOOL") },
    ];
  }, [members]);

  return (
    <section className={ui.section}>
      <div className={ui.sectionHead}>
        <h3 className={ui.sectionTitle}>People</h3>
        {canManage && !adding && (
          <button type="button" className={cat.secondary} onClick={() => setAdding(true)}><UserPlus size={16} aria-hidden="true" />Add member</button>
        )}
      </div>

      {canManage && adding && (
        <div className={`${ui.panel} ${ui.panelRow}`}>
          <div className={ui.grow}>
            <label className={ui.label}>Staff members</label>
            <SearchMultiPicker
              options={candidates.map((u) => ({
                id: u.user_id,
                label: u.name,
                sublabel: [u.role, canSeeContacts ? u.email : null].filter(Boolean).join(" · "),
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
              <div className={ui.errorText} style={{ marginTop: 6 }}>
                {staffError instanceof ApiError
                  ? staffError.message
                  : "Failed to load staff."}
              </div>
            )}
          </div>
          <div className={ui.grow} style={{ flexBasis: "14rem" }}>
            <div className={ui.help}>
              {MEMBERSHIP_HELP}
              {picks.length > 1 ? ` Applies to all ${picks.length} selected.` : ""}
            </div>
          </div>
          <button
            className={cat.primary}
            disabled={picks.length === 0 || addMember.isPending}
            onClick={() => run(async () => {
              // Sequential on purpose: each add is its own authority check, and
              // a partial success must say exactly who failed.
              const failed: string[] = [];
              for (const userId of picks) {
                try {
                  await addMember.mutateAsync({ id: programmeId, userId });
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
            {addMember.isPending ? "Adding…" : picks.length > 1 ? `Add ${picks.length}` : "Add"}
          </button>
          <button className={cat.secondary} onClick={() => { setAdding(false); setPicks([]); }}>Cancel</button>
        </div>
      )}

      <div className={cat.tableWrap}>
        <table className={`${cat.table} ${ui.table}`}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>

              {canManage && <th scope="col"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4}>Loading…</td></tr>}
            {!isLoading && members.length === 0 && (
              <tr><td className={ui.muted} colSpan={4}>No one is on this programme yet.</td></tr>
            )}
            {sections.map((section) => section.groups.length === 0 ? null : (
              <Fragment key={section.src}>
                {/* Only the derived section announces itself. "Seated in this
                    programme" named the default — every members table in the app
                    lists members — and cost a row of vertical space to say so. The
                    school banner has to stay: those rows carry no membership, no
                    Remove button, and disappear when the school is detached, none
                    of which is visible from the row itself. */}
                {section.src === "SCHOOL" && (
                  <tr className={ui.groupRow}>
                    <td colSpan={canManage ? 4 : 3}>
                      {section.label}
                      <span>
                        — their school responsibility connects them here. Actions and operational
                        access follow their effective permissions and assigned batches.
                      </span>
                    </td>
                  </tr>
                )}
                {section.groups.map(([role, rows]) => (
                  <Fragment key={`${section.src}-${role}`}>
                    <tr className={ui.groupRow}>
                      <td colSpan={canManage ? 4 : 3}>
                        {roleLabel(role)} · {rows.length}
                      </td>
                    </tr>
                    {rows.map((m) => (
                      <tr key={m.user_id}>
                        <td>
                          <button type="button" className={ui.linkButton} aria-expanded={selectedMember === m.user_id} onClick={() => setSelectedMember(selectedMember === m.user_id ? null : m.user_id)}>{m.name}</button>
                          {selectedMember === m.user_id && <div className={ui.sub}>{roleLabel(m.role)} · {m.source === "MEMBER" ? "Programme member" : "School responsibility"}</div>}
                          {canSeeContacts && m.email && <div className={ui.sub}>{m.email}</div>}
                          {m.via_schools.length > 0 && (
                            <div className={ui.chips}>
                              {m.via_schools.map((v) => (
                                <span
                                  key={v.school_id}
                                  className={`${ui.pill} ${ui.pillInfo}`}
                                  title={
                                    v.cause === "IN_CHARGE"
                                      ? "They are the in-charge of this attached school."
                                      : "They manage the in-charge of this attached school."
                                  }
                                >
                                  via <EntityLink href={`/dashboard/schools/${v.school_id}`} permissions={[PERM.schools.view]} style={LINK}>{v.name}</EntityLink>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{roleLabel(m.role)}</td>
                        {canManage && (
                          <td className={ui.end}>
                            {/* No Remove on a derived row: there is no membership
                                to delete, and offering the button would promise an
                                effect the endpoint cannot deliver. */}
                            {m.source === "MEMBER" ? (
                              <button
                                className={ui.dangerButton}
                                onClick={() => run(() => removeMember.mutateAsync({ id: programmeId, userId: m.user_id }))}
                                title={
                                  m.via_schools.length > 0
                                    ? "Removing their seat leaves them reachable through their school."
                                    : undefined
                                }
                              >
                                Remove
                              </button>
                            ) : (
                              <span className={`${ui.muted} ${ui.help}`}>via school</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── analytics ────────────────────────────────────────────────────────────────

function statCard(label: string, value: string, hint?: string, href?: string) {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </>
  );

  // A number that names a list people can act on is a link to that list. The
  // ones with nowhere useful to go stay inert rather than growing a fake affordance.
  if (href) {
    return (
      <Link key={label} href={href} className={ui.stat} aria-label={`${label}: ${value} — open list`}>
        {body}
      </Link>
    );
  }

  return <div key={label} className={ui.stat}>{body}</div>;
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
function OverviewSection({ programmeId }: { programmeId: string }) {
  const { data, isLoading, error } = useProgrammeOverview(programmeId);
  const { has } = usePermissions();
  const currentUrl = useCurrentUrl();
  const params = useSearchParams();
  const pathname = usePathname();
  const hub = (tab: TabKey) => updateProgrammeUrl(pathname, params, { tab });
  const doubtHref = (status: string) => has(PERM.doubts.view) ? withFrom(`/dashboard/doubts?status=${status}&programme_id=${programmeId}`, currentUrl) : undefined;

  if (isLoading) return <div role="status" className={cat.resultsLabel}>Loading overview…</div>;
  if (error || !data) return <div role="alert" className={ui.error}>Failed to load programme overview.</div>;

  const o: ProgrammeOverview = data;
  const contentTotal =
    o.content.courses + o.content.assignments + o.content.resources + o.content.quizzes;

  return (
    <section className={ui.section} aria-label="Overview">

      <div>
        <h3 className={ui.groupTitle}>Reach</h3>
        <div className={ui.statGrid}>
          {/* Two student measures, because one would now be a lie: `activity`
              below is read from the immutable programme stamped on each fact,
              while reach is current. With the school arm on, a student assigned
              elsewhere who attends a hosted school enters the first number and
              never the second. */}
          {statCard("Students reached", String(o.reachable_students), undefined, has(PERM.students.view) ? hub("students") : undefined)}
          {statCard("Assigned to programme", String(o.assigned_students), undefined, has(PERM.students.view) ? updateProgrammeUrl(pathname, params, { tab: "students", via: "PROGRAMME", page: 0 }) : undefined)}
          {statCard("Schools", String(o.schools), undefined, hub("schools"))}
          {statCard("Batches", String(o.batches), undefined, hub("batches"))}
          {statCard("Staff", String(o.staff), undefined, hub("people"))}
        </div>
      </div>

      <div>
        <h3 className={ui.groupTitle}>Content owned</h3>
        <div className={ui.statGrid}>
          {statCard("Courses", String(o.content.courses), undefined, hub("content"))}
          {statCard("Assignments", String(o.content.assignments), undefined, hub("content"))}
          {statCard("Resources", String(o.content.resources), undefined, hub("content"))}
          {statCard("Quizzes", String(o.content.quizzes), undefined, hub("content"))}
        </div>
        {contentTotal === 0 && (
          <div className={ui.notice} style={{ marginTop: 10 }}>
            No content yet.
          </div>
        )}
      </div>

      <div>
        <h3 className={ui.groupTitle}>Activity</h3>
        <div className={ui.statGrid}>
          {statCard("Quiz attempts", String(o.activity.attempts))}
          {statCard("Average score", o.activity.avg_score === null ? "—" : `${o.activity.avg_score}%`,
            o.activity.avg_score === null ? "no completed attempts yet" : undefined)}
          {statCard("Register marks", String(o.activity.attendance_marks), "Recorded in offline attendance registers")}
          {statCard("Tracker records", String(o.activity.tracker_records))}
        </div>
      </div>

      <div>
        <h3 className={ui.groupTitle}>Doubts</h3>
        <div className={ui.statGrid}>
          {/* Read through optional access, because during a rolling deploy this
              page is served by the new frontend while some requests still land
              on an instance of the old API that has never heard of `doubts`.
              Dereferencing it flat would take the whole Overview tab down with a
              TypeError for the length of the rollout. */}
          {statCard("Open", String(o.doubts?.open ?? 0), undefined, doubtHref("OPEN"))}
          {statCard("Answered", String(o.doubts?.answered ?? 0), undefined, doubtHref("ANSWERED"))}
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
/**
 * Assign existing students to this programme.
 *
 * Server-side search: the candidate set is every unassigned student the caller
 * reaches, which at programme scale is far too large to filter in the browser.
 * The picker reports the needle and renders whatever comes back, and the
 * select-all control acts on the matches for the CURRENT needle — so "every
 * unassigned student at this school" is one search and one click.
 *
 * Partial success is the normal outcome, not an error: students sitting in
 * another programme's batch, or carrying a different programme type, are
 * refused individually and named here.
 */
function AddStudentsPanel({
  programmeId, onClose, onError,
}: { programmeId: string; onClose: () => void; onError: Notify }) {
  const [query, setQuery] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [report, setReport] = useState<{ assigned: number; failed: Array<{ name: string; reason: string }> } | null>(null);
  const { data, isFetching, error } = useEligibleProgrammeStudents(programmeId, query, true);
  const addStudents = useAddProgrammeStudents();

  const rows = data?.rows ?? [];
  const options = rows.map((r) => ({
    id: r.user_id,
    label: r.name,
    sublabel: [
      r.roll_number,
      r.school_name,
      r.programme_type,
      r.reached ? "already reached by this programme" : null,
    ].filter(Boolean).join(" · ") || undefined,
  }));

  return (
    <div className={ui.panel}>
      <div className={ui.sectionHead}>
        <label className={ui.label} style={{ margin: 0 }}>Add students</label>
        <button type="button" className={cat.secondary} onClick={onClose}>Cancel</button>
      </div>

      <SearchMultiPicker
        options={options}
        value={picks}
        onChange={setPicks}
        onQueryChange={setQuery}
        isLoading={isFetching}
        disabled={Boolean(error)}
        placeholder="Search unassigned students by name, roll number or school…"
        emptyText="No unassigned students to add."
      />

      {error && (
        <div className={ui.errorText}>
          {error instanceof ApiError ? error.message : "Failed to load students."}
        </div>
      )}

      <div className={ui.panelRow} style={{ alignItems: "center" }}>
        <span className={`${ui.help} ${ui.grow}`}>
          Only students who belong to no programme yet are listed. A student in another
          programme&rsquo;s batch, or of a different programme type, is refused and named.
        </span>
        <button
          className={cat.primary}
          disabled={picks.length === 0 || addStudents.isPending}
          onClick={async () => {
            onError(null);
            setReport(null);
            try {
              const res = await addStudents.mutateAsync({ id: programmeId, userIds: picks });
              setPicks([]);
              setReport({ assigned: res.assigned, failed: res.failed });
              if (res.failed.length === 0) onClose();
            } catch (e) {
              onError(e instanceof ApiError ? e.message : "Failed to add students.");
            }
          }}
        >
          {addStudents.isPending ? "Adding…" : picks.length > 1 ? `Add ${picks.length}` : "Add"}
        </button>
      </div>

      {report && (
        <div className={ui.notice}>
          <strong>{report.assigned} student{report.assigned === 1 ? "" : "s"} added.</strong>
          {report.failed.length > 0 && (
            <ul className={ui.failList}>
              {report.failed.map((f) => (
                <li key={f.name}>{f.name} — {f.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StudentsSection({
  programmeId, canAssign, onError,
}: { programmeId: string; canAssign: boolean; onError: Notify }) {
  const [adding, setAdding] = useState(false);
  const rowNav = useRowNavigation();
  const canSeeStudent = usePermission(PERM.students.view);
  const canReadProfile = useAnyPermission(...STUDENT_PROFILE_PERMISSIONS);
  const canOpenStudent = canSeeStudent && canReadProfile;
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { data: schools = [] } = useProgrammeSchools(programmeId);

  const { q, school: schoolId, via, page } = readProgrammeState(params);
  const update = (changes: Parameters<typeof updateProgrammeUrl>[2]) => router.replace(updateProgrammeUrl(pathname, params, changes), { scroll: false });
  const PAGE = 200;

  const { data, isLoading, error, isPlaceholderData } = useProgrammeStudents(
    programmeId,
    true,
    {
      q: q || undefined,
      school_id: schoolId || undefined,
      via: via || undefined,
      limit: PAGE,
      offset: page * PAGE,
    },
  );
  const students = data?.rows ?? [];
  const total = data?.total ?? 0;
  const filtering = Boolean(q || schoolId || via);

  const viaBadge = (v: ProgrammeReachVia) => {
    const tone = v === "PROGRAMME" ? ui.pillGreen : v === "SCHOOL" ? ui.pillInfo : ui.pillMuted;
    const title =
      v === "PROGRAMME" ? "Assigned to this programme directly."
      : v === "SCHOOL" ? "Attends a school attached to this programme. Detaching the school ends it."
      : "Enrolled in one of this programme's batches. Moving that batch would end it.";
    const label = v === "PROGRAMME" ? "Programme" : v === "SCHOOL" ? "School" : "Batch";
    return <span key={v} className={`${ui.pill} ${tone}`} title={title}>{label}</span>;
  };

  return (
    <section className={ui.section}>
      <div className={ui.sectionHead}>
        <h3 className={ui.sectionTitle}>Students</h3>
        {canAssign && !adding && (
          <button type="button" className={cat.secondary} onClick={() => setAdding(true)}><UserPlus size={16} aria-hidden="true" />Add students</button>
        )}
      </div>
      <div className={ui.filters}>
          <label className={cat.search} style={{ maxWidth: "none" }}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search students"
              placeholder="Search name, roll number or school"
              value={q}
              onChange={(e) => update({ q: e.target.value, page: 0 })}
            />
          </label>
          <select
            aria-label="Filter by school"
            className={cat.control}
            value={schoolId}
            onChange={(e) => update({ school: e.target.value, page: 0 })}
          >
            <option value="">All schools</option>
            {schools.map((sc: ProgrammeSchool) => (
              <option key={sc.school_id} value={sc.school_id}>{sc.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by reach"
            className={cat.control}
            value={via}
            onChange={(e) => update({ via: e.target.value as "" | ProgrammeReachVia, page: 0 })}
          >
            <option value="">Reached any way</option>
            <option value="PROGRAMME">Assigned to programme</option>
            <option value="BATCH">Through a batch</option>
            <option value="SCHOOL">Through a school</option>
          </select>
      </div>

      {canAssign && adding && (
        <AddStudentsPanel
          programmeId={programmeId}
          onClose={() => setAdding(false)}
          onError={onError}
        />
      )}

      {error && <div role="alert" className={ui.error}>Failed to load students.</div>}

      {!isLoading && total > 0 && (
        <p role="status" className={cat.resultsLabel}>
          {filtering
            ? `${total} matching student${total === 1 ? "" : "s"}`
            : `${total} student${total === 1 ? "" : "s"}`}
          {total > PAGE && <> · showing {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)}</>}
        </p>
      )}

      <div className={cat.tableWrap} style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
        <table className={`${cat.table} ${ui.table}`}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Roll number</th>
              <th scope="col">School</th>
              <th scope="col">Reached via</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4}>Loading…</td></tr>}
            {!isLoading && total === 0 && !filtering && (
              <tr>
                <td className={ui.muted} colSpan={4}>
                  No students yet. A student joins by being assigned to this programme in
                  User management, by being enrolled in one of its batches, or by attending
                  one of its attached schools.
                </td>
              </tr>
            )}
            {!isLoading && total === 0 && filtering && (
              <tr><td className={ui.muted} colSpan={4}>No student matches these filters.</td></tr>
            )}
            {students.map((s: ProgrammeStudent) => (
              <tr
                key={s.user_id}
               
                {...(canOpenStudent ? rowNav(`/dashboard/students/${s.user_id}`) : {})}
              >
                <td>
                  <EntityLink
                    href={`/dashboard/students/${s.user_id}`}
                    permissions={STUDENT_PROFILE_PERMISSIONS}
                    requiredPermissions={[PERM.students.view]}
                    style={LINK}
                  >
                    {s.name}
                  </EntityLink>
                  {s.status !== "ACTIVE" && (
                    <span className={`${ui.pill} ${ui.pillMuted}`} style={{ marginLeft: 8 }}>
                      {s.status}
                    </span>
                  )}
                </td>
                <td className={ui.code}>{s.roll_number ?? "—"}</td>
                <td>{s.school_name ?? "—"}</td>
                <td>
                  <span className={ui.chips} style={{ marginTop: 0 }}>
                    {s.via.map(viaBadge)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE && (
        <div className={ui.pager}>
          <button className={cat.secondary} disabled={page === 0} onClick={() => update({ page: page - 1 })}>
            Previous
          </button>
          <button
            className={cat.secondary}
            disabled={(page + 1) * PAGE >= total}
            onClick={() => update({ page: page + 1 })}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

const KINDS: Array<{ key: ProgrammeContentKind; label: string; one: string; row: string }> = [
  { key: "courses", label: "Courses", one: "course", row: "Course" },
  { key: "assignments", label: "Assignments", one: "assignment", row: "Assignment" },
  { key: "resources", label: "Resources", one: "resource", row: "Resource" },
  // Quizzes joined in migration 129. Only standalone ones appear: a module quiz
  // belongs to whoever owns its course, so it is assigned by assigning the
  // course, and offering a second way here is how the two start to disagree.
  { key: "quizzes", label: "Quizzes", one: "quiz", row: "Quiz" },
];

/**
 * Where each content kind lives, and what it takes to open it.
 *
 * Resources open the focused list entry; quizzes open the existing builder
 * with its own read/write gates. Each destination keeps the hub return URL.
 */
const CONTENT_HREF: Record<string, ((id: string) => string) | undefined> = {
  courses: (id) => `/dashboard/courses/${id}`,
  assignments: (id) => `/dashboard/assignments/${id}`,
  quizzes: (id) => `/dashboard/quiz-builder/${id}`,
  resources: (id) => `/dashboard/resources?focus=${id}`,
};
const CONTENT_PERMS: Record<string, readonly string[]> = {
  courses: [PERM.courses.view],
  assignments: [PERM.assignments.view],
  resources: [PERM.resources.view],
  quizzes: [PERM.test_bank.view],
};

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

  // AUTO-POPULATE. Anything the server marks `suggested` is already used by
  // this programme — taught on its batches, or carried by its bundles — so it
  // is pre-ticked and the admin only has to press Add.
  //
  // Seeded ONCE per kind, and never while a search is narrowing the list:
  // re-seeding would tick boxes again after somebody deliberately unticked
  // them, which is the difference between a helpful default and a control that
  // fights you. Suggesting is not claiming — the write still needs the click.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const key = `${programmeId}:${kind}`;
    if (seeded.current === key || search.trim() || assignable.length === 0) return;
    const suggested = assignable.filter((c) => c.suggested).map((c) => c.id);
    seeded.current = key;
    if (suggested.length > 0) setPicks(suggested);
  }, [programmeId, kind, search, assignable]);

  async function run(fn: () => Promise<unknown>) {
    onError(null);
    try { await fn(); } catch (e) {
      onError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  const notEditable = owned.filter((c) => !c.editable).length;

  return (
    <section className={ui.section}>
      <h3 className={ui.sectionTitle}>Content</h3>
      {canManage && (
        <div className={`${ui.panel} ${ui.panelRow}`}>
          <div className={ui.fixed}>
            <label className={ui.label}>Type</label>
            <select
              className={cat.control}
              value={kind}
              onChange={(e) => { setKind(e.target.value as ProgrammeContentKind); setPicks([]); setSearch(""); }}
            >
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <div className={ui.grow}>
            <label className={ui.label}>Add to programme</label>
            {/* Server-search mode: typing re-queries the assignable list (the
                server caps at 50), and picks made under one query survive the
                next — the picker caches every option it has seen. */}
            <SearchMultiPicker
              options={assignable.map((c) => ({ id: c.id, label: c.title, sublabel: c.why }))}
              value={picks}
              onChange={setPicks}
              onQueryChange={setSearch}
              isLoading={loadingPick}
              placeholder={`Search ${kind} by title…`}
              emptyText={
                kind === "quizzes"
                  ? "Nothing available to add. Only standalone quizzes no programme owns are offered — a module quiz is assigned by assigning its course."
                  : `Nothing available to add. Only unassigned ${kind} you created or were invited to manage are offered.`
              }
            />
          </div>
          <button
            className={cat.primary}
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

      <div className={cat.tableWrap}>
        <table className={`${cat.table} ${ui.table}`}>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Type</th>
              <th scope="col">Created by</th>
              <th scope="col">Members can edit</th>
              {canManage && <th scope="col"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5}>Loading…</td></tr>}
            {!isLoading && owned.length === 0 && (
              <tr>
                <td className={ui.muted} colSpan={5}>
                  This programme owns nothing yet, so membership grants no edit rights.
                </td>
              </tr>
            )}
            {owned.map((c) => (
              <tr key={`${c.kind}:${c.id}`}>
                <td>
                  {(() => {
                    const to = CONTENT_HREF[c.kind];
                    return to ? (
                      <EntityLink href={to(c.id)} permissions={CONTENT_PERMS[c.kind] ?? []} style={LINK}>
                        {c.title}
                      </EntityLink>
                    ) : c.title;
                  })()}
                </td>
                <td>{KIND_ROW_LABEL[c.kind] ?? c.kind}</td>
                <td>{c.created_by_name ?? "—"}</td>
                <td>
                  {c.editable
                    ? <span className={ui.ok}>Yes</span>
                    : <span className={ui.warn} title="Another programme also uses this, so editing stays with its creator.">
                        No — shared
                      </span>}
                </td>
                {canManage && (
                  <td className={ui.end}>
                    <button
                      className={ui.dangerButton}
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
        <div className={ui.help}>
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
  const rowNav = useRowNavigation();
  const canOpenSchool = usePermission(PERM.schools.view);
  const { data: attached = [], isLoading } = useProgrammeSchools(programmeId);
  const attach = useAttachProgrammeSchool();
  const detach = useDetachProgrammeSchool();
  const [all, setAll] = useState<SchoolOption[]>([]);
  const [picks, setPicks] = useState<string[]>([]);

  useEffect(() => {
    if (!canManage || !canOpenSchool) return;
    fetchSchools().then(setAll).catch(() => setAll([]));
  }, [canManage, canOpenSchool]);

  const attachedIds = useMemo(() => new Set(attached.map((s) => s.school_id)), [attached]);
  const candidates = all.filter((s) => !attachedIds.has(s.id));

  async function run(fn: () => Promise<unknown>) {
    onError(null);
    try { await fn(); } catch (e) {
      onError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <section className={ui.section}>
      <h3 className={ui.sectionTitle}>Schools</h3>

      {canManage && canOpenSchool && (
        <div className={`${ui.panel} ${ui.panelRow}`}>
          <div className={ui.grow}>
            <label className={ui.label}>Attach schools</label>
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
            className={cat.primary}
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

      <div className={cat.tableWrap}>
        <table className={`${cat.table} ${ui.table}`}>
          <thead>
            <tr>
              <th scope="col">School</th>
              <th scope="col">{ZONE}</th>
              <th scope="col">State</th>
              <th scope="col">{IN_CHARGE}</th>
              <th scope="col">{ROLE_LABELS.ZONAL_MANAGER}</th>
              {canManage && <th scope="col"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6}>Loading…</td></tr>}
            {!isLoading && attached.length === 0 && (
              <tr><td className={ui.muted} colSpan={6}>No schools attached.</td></tr>
            )}
            {attached.map((s) => (
              <tr
                key={s.school_id}
               
                {...(canOpenSchool ? rowNav(`/dashboard/schools/${s.school_id}`) : {})}
              >
                <td>
                  <EntityLink href={`/dashboard/schools/${s.school_id}`} permissions={[PERM.schools.view]} style={LINK}>
                    {s.name}
                  </EntityLink>
                </td>
                <td>{s.district ?? "—"}</td>
                <td>{s.state ?? "—"}</td>
                <td>{s.fellow_name ?? "—"}</td>
                <td>{s.zm_name ?? "—"}</td>
                {canManage && (
                  <td className={ui.end}>
                    <button
                      className={ui.dangerButton}
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
  const rowNav = useRowNavigation();
  const canOpenBatch = usePermission(PERM.batches.view);
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
        setImpact(mergeBatchImpacts(results.flatMap(result => result.status === "fulfilled" ? [result.value] : [])));
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
    <section className={ui.section}>
      <h3 className={ui.sectionTitle}>Batches</h3>
      {canManage && (
        <div className={ui.panel}>
          <div className={ui.panelRow}>
            <div className={ui.grow}>
              <label className={ui.label}>Add batches</label>
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
              className={cat.primary}
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
            <div role="status" className={ui.help}>Checking impact…</div>
          )}
          {impact !== null && picks.length > 0 && (impact.length > 0 || (!checking && !impactFailed)) && (
            <BatchImpactNotice items={impact} />
          )}
          {impactFailed && !checking && (
            <div className={ui.warnNotice}>
              Could not check what attaching {picks.length === 1 ? "this batch" : "every selected batch"} would
              affect. Adding {picks.length === 1 ? "it" : "them"} may still remove edit rights from another
              programme.
            </div>
          )}
        </div>
      )}

      <div className={cat.tableWrap}>
        <table className={`${cat.table} ${ui.table}`}>
          <thead>
            <tr>
              <th scope="col">Batch</th>
              <th scope="col">School</th>
              <th scope="col">Courses</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5}>Loading…</td></tr>}
            {!isLoading && attached.length === 0 && (
              <tr>
                <td className={ui.muted} colSpan={5}>
                  No batches in this programme yet.
                </td>
              </tr>
            )}
            {attached.map((b) => (
              <tr
                key={b.id}
               
                {...(canOpenBatch ? rowNav(`/dashboard/batches/${b.id}`) : {})}
              >
                <td>
                  <EntityLink href={`/dashboard/batches/${b.id}`} permissions={[PERM.batches.view]} style={LINK}>
                    {b.name}
                  </EntityLink>
                </td>
                <td>{b.school_name ?? "—"}</td>
                <td>{b.course_count}</td>
                <td>{b.status ?? "—"}</td>
                {canManage && (
                  <td className={ui.end}>
                    <button
                      className={ui.dangerButton}
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
    <section className={ui.section}>
      <h3 className={ui.sectionTitle}>{archived ? "Restore" : "Archive"}</h3>
      <div className={`${ui.panel} ${ui.panelRow}`} style={{ alignItems: "center" }}>
        <p className={ui.help} style={{ flex: "1 1 18rem", fontSize: "0.8125rem" }}>
          {archived
            ? "Restoring makes the programme active again, so editors regain edit access to its content."
            : "Archiving keeps everything attached but stops editors from changing its content until it is restored."}
        </p>
        <button
          type="button"
          className={archived ? cat.primary : `${cat.secondary} ${ui.dangerOutline}`}
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
