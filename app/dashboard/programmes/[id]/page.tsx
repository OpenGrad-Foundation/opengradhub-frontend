"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  ApiError, fetchSchools, getUsers,
  type ProgrammeLevel, type SafeUser, type SchoolOption,
} from "@/lib/api";
import {
  useProgramme, useProgrammeMembers, useProgrammeSchools,
} from "@/lib/queries/programmes";
import {
  useAttachProgrammeSchool, useDetachProgrammeSchool, useRemoveProgrammeMember,
  useSetProgrammeMember, useUpdateProgramme,
} from "@/lib/mutations/programmes";
import {
  cardStyle, errorStyle, formLabelStyle, inputStyle, labelStyle, levelBadge,
  linkBtnStyle, noticeStyle, primaryButton, secondaryButton, tdStyle, thStyle, titleStyle,
} from "../styles";

const LEVELS: ProgrammeLevel[] = ["OWNER", "EDITOR", "VIEWER"];

/**
 * What each level means, stated in the UI so it is not folklore.
 * Mirrors the backend: level gates writes; VIEWER is deliberately read-only and
 * carries no roster PII or grades.
 */
const LEVEL_HELP: Record<ProgrammeLevel, string> = {
  OWNER: "Manages members, schools and settings.",
  EDITOR: "Manages the programme's content.",
  VIEWER: "Read-only. No student data.",
};

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { has } = usePermissions();
  const canEdit = has(PERM.programmes.edit);
  const canManageMembers = has(PERM.programmes.manage_members);

  const { data: programme, isLoading, error } = useProgramme(id);
  const [banner, setBanner] = useState<string | null>(null);

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
          This programme is archived. Membership grants nothing while it stays archived.
        </div>
      )}
      {banner && <div style={errorStyle}>{banner}</div>}

      <MembersSection
        programmeId={id}
        canManage={canManageMembers && (isOwner || has("*"))}
        onError={setBanner}
      />
      <SchoolsSection programmeId={id} canManage={mayAdminister} onError={setBanner} />
      {mayAdminister && <DangerSection programmeId={id} status={programme.status} onError={setBanner} />}
    </div>
  );
}

// ── members ──────────────────────────────────────────────────────────────────

function MembersSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: (m: string | null) => void }) {
  const { data: members = [], isLoading } = useProgrammeMembers(programmeId);
  const setMember = useSetProgrammeMember();
  const removeMember = useRemoveProgrammeMember();

  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [level, setLevel] = useState<ProgrammeLevel>("EDITOR");

  // Staff only — the API refuses students, so offering them would be a trap.
  const { data: staff = [] } = useQuery({
    queryKey: ["og", "users", "staff-for-programme"],
    queryFn: async () => {
      const all = await getUsers();
      return all.filter((u: SafeUser) => u.role !== "STUDENT" && u.status === "ACTIVE");
    },
    enabled: adding,
    staleTime: 5 * 60_000,
  });

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const candidates = staff.filter((u) => !memberIds.has(u.id));

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
            <select style={inputStyle} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Select…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.role}{u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
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

// ── schools ──────────────────────────────────────────────────────────────────

function SchoolsSection({
  programmeId, canManage, onError,
}: { programmeId: string; canManage: boolean; onError: (m: string | null) => void }) {
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

// ── archive ──────────────────────────────────────────────────────────────────

function DangerSection({
  programmeId, status, onError,
}: { programmeId: string; status: "ACTIVE" | "ARCHIVED"; onError: (m: string | null) => void }) {
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
