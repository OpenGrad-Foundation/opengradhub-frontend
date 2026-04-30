"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getUsers, type SafeUser } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const VALID_ROLES = [
  "SUPER_ADMIN", "PROGRAM_MANAGER", "ZONAL_MANAGER",
  "FELLOW", "STUDENT", "GOVERNMENT", "FUNDING_PARTNER",
];

const MODULES = [
  { code: "dashboard",       name: "Dashboard" },
  { code: "courses",         name: "Courses" },
  { code: "assessments",     name: "Assessments" },
  { code: "resources",       name: "Resources" },
  { code: "doubts",          name: "Doubts" },
  { code: "announcements",   name: "Announcements" },
  { code: "analytics",       name: "Analytics" },
  { code: "student_export",  name: "Student Export" },
  { code: "user_management", name: "User Management" },
  { code: "role_management", name: "Role Management" },
];

const ACTIONS = ["view", "create", "edit", "delete"];

type Override = {
  id: string;
  module_code: string;
  module_name: string;
  permission_code: string;
  permission_name: string;
  effect: string;
  created_at: string;
};

// ── API helpers ────────────────────────────────────────────────

async function patchRole(userId: string, role: string, callerRole: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, caller_role: callerRole }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to update role.");
  }
}

async function fetchOverrides(userId: string, callerRole: string): Promise<Override[]> {
  const res = await fetch(
    `${API_BASE}/users/${userId}/overrides?caller_role=${callerRole}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Failed to fetch overrides.");
  return res.json() as Promise<Override[]>;
}

async function addOverride(
  userId: string, permissionCode: string,
  effect: "ALLOW" | "DENY", setBy: string, callerRole: string,
): Promise<Override[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/overrides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permission_code: permissionCode, effect, set_by: setBy, caller_role: callerRole }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to add override.");
  }
  return res.json() as Promise<Override[]>;
}

async function deleteOverride(userId: string, permissionId: string, callerRole: string) {
  const res = await fetch(
    `${API_BASE}/users/${userId}/overrides/${permissionId}?caller_role=${callerRole}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete override.");
}

// ── Page ───────────────────────────────────────────────────────

export default function RoleManagementPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const callerId = data?.user?.id ?? "";

  const [users, setUsers] = useState<SafeUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { setUsers(await getUsers()); }
    catch { setUsers([]); }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => { if (!userLoading) void loadUsers(); }, [userLoading, loadUsers]);

  const loadOverrides = useCallback(async (user: SafeUser) => {
    setSelectedUser(user);
    setOverridesLoading(true);
    try { setOverrides(await fetchOverrides(user.id, roleCode)); }
    catch { setOverrides([]); }
    finally { setOverridesLoading(false); }
  }, [roleCode]);

  if (userLoading) return <LoadingState />;

  if (roleCode !== "SUPER_ADMIN") {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={glassCard}>
          <p style={labelStyle}>Access Denied</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>Super Admin only.</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <p style={labelStyle}>Administration</p>
        <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 0" }}>Role Management</h1>
        <p style={{ ...subtitleStyle, marginTop: "6px" }}>
          Change user roles and manage permission overrides
        </p>
      </div>

      {/* ══ Section 1: User Role Assignment ══════════════════ */}
      <div style={{ ...glassCard, marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <p style={labelStyle}>Section 1</p>
            <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 0" }}>User Role Assignment</h2>
          </div>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            style={{ ...inputStyle, width: "260px" }}
          />
        </div>

        {usersLoading ? (
          <p style={subtitleStyle}>Loading users&hellip;</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {["Name", "Email", "Current Role", "Programme", "Status", "Action"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <UserRoleRow
                    key={u.id}
                    user={u}
                    callerId={callerId}
                    callerRole={roleCode}
                    onChanged={loadUsers}
                    onSelect={() => void loadOverrides(u)}
                    isSelected={selectedUser?.id === u.id}
                  />
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "rgba(3,72,82,0.4)" }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Section 2: Permission Overrides ══════════════════ */}
      <div style={glassCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <p style={labelStyle}>Section 2</p>
            <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 0" }}>
              Permission Overrides
              {selectedUser && (
                <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 400, color: "#209379", marginLeft: "12px" }}>
                  — {selectedUser.name}
                </span>
              )}
            </h2>
          </div>
          {selectedUser && (
            <button
              style={primaryButton}
              onClick={() => setShowAddModal(true)}
              onMouseEnter={hoverIn} onMouseLeave={hoverOut}
            >
              + Add Override
            </button>
          )}
        </div>

        {!selectedUser ? (
          <div style={{ padding: "32px", textAlign: "center", background: "rgba(0,0,0,0.02)", borderRadius: "16px", border: "1px dashed rgba(3,72,82,0.12)" }}>
            <p style={{ ...subtitleStyle, fontSize: "15px" }}>
              Click a row in the table above to view and manage overrides for that user.
            </p>
          </div>
        ) : overridesLoading ? (
          <p style={subtitleStyle}>Loading overrides&hellip;</p>
        ) : overrides.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", background: "rgba(0,0,0,0.02)", borderRadius: "16px" }}>
            <p style={subtitleStyle}>No overrides for {selectedUser.name}. Role defaults apply.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {["Module", "Permission", "Effect", "Date Added", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overrides.map((ov) => (
                  <OverrideRow
                    key={ov.id}
                    override={ov}
                    onDelete={async () => {
                      await deleteOverride(selectedUser.id, ov.id, roleCode);
                      setOverrides(await fetchOverrides(selectedUser.id, roleCode));
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Override Modal ─────────────────────────────── */}
      {showAddModal && selectedUser && (
        <AddOverrideModal
          user={selectedUser}
          callerId={callerId}
          callerRole={roleCode}
          onClose={() => setShowAddModal(false)}
          onCreated={async (updated) => {
            setOverrides(updated);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── User Role Row ──────────────────────────────────────────────

function UserRoleRow({
  user, callerId, callerRole, onChanged, onSelect, isSelected,
}: {
  user: SafeUser;
  callerId: string;
  callerRole: string;
  onChanged: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleConfirm() {
    if (newRole === user.role) { setEditing(false); return; }
    setSaving(true); setErr(null);
    try {
      await patchRole(user.id, newRole, callerRole);
      onChanged();
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr
      onClick={onSelect}
      style={{
        cursor: "pointer",
        background: isSelected ? "rgba(10,190,98,0.05)" : "transparent",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isSelected ? "rgba(10,190,98,0.05)" : "transparent"; }}
    >
      <td style={tdStyle}><span style={{ fontWeight: 600, color: "#034852" }}>{user.name}</span></td>
      <td style={tdStyle}><span style={{ color: "rgba(3,72,82,0.6)" }}>{user.email ?? "—"}</span></td>
      <td style={tdStyle}>
        {editing ? (
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{ ...inputStyle, padding: "6px 10px", fontSize: "12px" }}
          >
            {VALID_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        ) : (
          <RoleBadge role={user.role} />
        )}
        {err && <p style={{ fontSize: "11px", color: "#e53e3e", marginTop: "4px" }}>{err}</p>}
      </td>
      <td style={tdStyle}>{user.programme_type ?? "—"}</td>
      <td style={tdStyle}><StatusBadge status={user.status} /></td>
      <td style={{ ...tdStyle, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={handleConfirm}
              disabled={saving}
              style={{ ...smallButton, background: "#0abe62", color: "#fff" }}
            >
              {saving ? "…" : "Confirm"}
            </button>
            <button onClick={() => { setEditing(false); setNewRole(user.role); }} style={smallButton}>
              Cancel
            </button>
          </div>
        ) : (
          user.id !== callerId && (
            <button onClick={() => setEditing(true)} style={smallButton}>
              Change Role
            </button>
          )
        )}
      </td>
    </tr>
  );
}

// ── Override Row ───────────────────────────────────────────────

function OverrideRow({ override, onDelete }: { override: Override; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const isAllow = override.effect === "ALLOW";

  return (
    <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <td style={tdStyle}><span style={{ fontWeight: 600, color: "#034852" }}>{override.module_name}</span></td>
      <td style={tdStyle}><code style={{ fontSize: "12px", color: "#209379" }}>{override.permission_code}</code></td>
      <td style={tdStyle}>
        <span style={{
          padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
          background: isAllow ? "rgba(10,190,98,0.1)" : "rgba(229,62,62,0.1)",
          color: isAllow ? "#0a944e" : "#c53030",
          border: isAllow ? "1px solid rgba(10,190,98,0.2)" : "1px solid rgba(229,62,62,0.2)",
        }}>
          {isAllow ? "GRANT" : "REVOKE"}
        </span>
      </td>
      <td style={{ ...tdStyle, color: "rgba(3,72,82,0.5)", fontSize: "12px" }}>
        {new Date(override.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </td>
      <td style={tdStyle}>
        <button
          onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false); }}
          disabled={deleting}
          style={{ ...smallButton, color: "#c53030", borderColor: "rgba(229,62,62,0.3)" }}
        >
          {deleting ? "…" : "Delete"}
        </button>
      </td>
    </tr>
  );
}

// ── Add Override Modal ─────────────────────────────────────────

function AddOverrideModal({
  user, callerId, callerRole, onClose, onCreated,
}: {
  user: SafeUser;
  callerId: string;
  callerRole: string;
  onClose: () => void;
  onCreated: (updated: Override[]) => void;
}) {
  const [module, setModule] = useState("dashboard");
  const [action, setAction] = useState("view");
  const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr(null);
    try {
      const permCode = `${module}.${action}`;
      const updated = await addOverride(user.id, permCode, effect, callerId, callerRole);
      onCreated(updated);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to add override.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,72,82,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ ...glassCard, position: "relative", width: "100%", maxWidth: "480px", animation: "floatIn 0.3s ease-out forwards" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <p style={labelStyle}>Add Override</p>
            <p style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700, color: "#034852", marginTop: "2px" }}>
              {user.name}
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={formLabelStyle}>Module</label>
            <select value={module} onChange={(e) => setModule(e.target.value)} style={inputStyle}>
              {MODULES.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label style={formLabelStyle}>Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} style={inputStyle}>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label style={formLabelStyle}>Effect</label>
            <div style={{ display: "flex", gap: "12px" }}>
              {(["ALLOW", "DENY"] as const).map((ef) => {
                const active = effect === ef;
                const isAllow = ef === "ALLOW";
                return (
                  <button
                    key={ef}
                    type="button"
                    onClick={() => setEffect(ef)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "10px", fontWeight: 700,
                      fontSize: "13px", cursor: "pointer", border: "2px solid",
                      transition: "all 150ms",
                      background: active
                        ? (isAllow ? "rgba(10,190,98,0.12)" : "rgba(229,62,62,0.1)")
                        : "transparent",
                      borderColor: active
                        ? (isAllow ? "#0abe62" : "#e53e3e")
                        : "rgba(0,0,0,0.12)",
                      color: active
                        ? (isAllow ? "#0a944e" : "#c53030")
                        : "rgba(3,72,82,0.5)",
                    }}
                  >
                    {ef === "ALLOW" ? "Grant" : "Revoke"}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.45)", marginTop: "6px" }}>
              Grant adds a permission the role lacks. Revoke removes a permission the role has by default.
            </p>
          </div>

          {err && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{err}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...primaryButton, opacity: submitting ? 0.65 : 1 }}>
              {submitting ? "Saving…" : "Apply Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Small components ───────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    SUPER_ADMIN:     { bg: "rgba(3,72,82,0.1)",    color: "#034852" },
    PROGRAM_MANAGER: { bg: "rgba(0,109,108,0.1)",  color: "#006d6c" },
    ZONAL_MANAGER:   { bg: "rgba(32,147,121,0.1)", color: "#209379" },
    FELLOW:          { bg: "rgba(10,190,98,0.1)",  color: "#0a944e" },
    STUDENT:         { bg: "rgba(166,219,116,0.2)","color": "#4a7a20" },
    GOVERNMENT:      { bg: "rgba(255,222,0,0.2)",  color: "#7a6600" },
    FUNDING_PARTNER: { bg: "rgba(255,222,89,0.2)", color: "#7a6000" },
  };
  const c = colors[role] ?? { bg: "rgba(0,0,0,0.06)", color: "#034852" };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: "100px", fontSize: "10px",
      fontWeight: 700, letterSpacing: "0.05em",
      background: c.bg, color: c.color,
    }}>
      {role.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span style={{
      padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
      background: active ? "rgba(10,190,98,0.1)" : "rgba(229,62,62,0.1)",
      color: active ? "#0a944e" : "#c53030",
    }}>
      {status}
    </span>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>Role Management</p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Please wait&hellip;</p>
      </div>
    </div>
  );
}

// ── Interactions ───────────────────────────────────────────────

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 12px 20px rgba(10,190,98,0.3)";
}
function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 8px 16px rgba(10,190,98,0.2)";
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "24px",
  padding: "32px",
  boxShadow: "0 16px 40px rgba(0,0,0,0.06)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px", color: "rgba(3,72,82,0.6)",
};

const primaryButton: React.CSSProperties = {
  padding: "10px 20px", border: "none", borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "13px", cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
};

const smallButton: React.CSSProperties = {
  padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
  background: "none", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "8px",
  color: "#034852", transition: "all 150ms",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "10px 20px", background: "none",
  border: "1px solid rgba(3,72,82,0.2)", borderRadius: "10px",
  color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", fontSize: "18px",
  color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px",
};

const formLabelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px",
  background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)",
  fontSize: "14px", outline: "none",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.5)",
  borderBottom: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px", borderBottom: "1px solid rgba(0,0,0,0.05)",
  verticalAlign: "middle",
};
