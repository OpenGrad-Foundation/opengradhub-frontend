"use client";

import { useState, useEffect } from "react";
import type { SafeUser } from "@/lib/api";
import { updateUser, deleteUser } from "@/lib/api";
import {
  VALID_ROLES,
  patchRole,
} from "@/app/dashboard/role-management/role-management.utils";

interface UserDetailPanelProps {
  user: SafeUser;
  callerId: string;
  callerRole: string;
  onClose: () => void;
  onUpdated: (updated: SafeUser) => void;
  onDeleted: () => void;
  onAssignCourse: (user: SafeUser) => void;
  onAssignBundle: (user: SafeUser) => void;
}

type Draft = {
  name: string;
  email: string;
  phone: string;
  programme_type: string;
  state: string;
  school_id: string;
  school_code: string;
  roll_number: string;
  district: string;
};

function makeDraft(u: SafeUser): Draft {
  return {
    name: u.name ?? "",
    email: u.email ?? "",
    phone: u.phone ?? "",
    programme_type: u.programme_type ?? "",
    state: u.state ?? "",
    school_id: u.school_id ?? "",
    school_code: u.school_code ?? "",
    roll_number: u.roll_number ?? "",
    district: u.district ?? "",
  };
}

export function UserDetailPanel({
  user,
  callerId,
  callerRole,
  onClose,
  onUpdated,
  onDeleted,
  onAssignCourse,
  onAssignBundle,
}: UserDetailPanelProps) {
  const [draft, setDraft] = useState<Draft>(() => makeDraft(user));
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [roleEditing, setRoleEditing] = useState(false);
  const [newRole, setNewRole] = useState(user.role);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleErr, setRoleErr] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const initial = makeDraft(user);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    setDraft(makeDraft(user));
    setSaveErr(null);
    setRoleEditing(false);
    setNewRole(user.role);
    setRoleErr(null);
    setConfirmDelete(false);
    setDeleteErr(null);
    setConfirmClose(false);
  }, [user.id]);

  function set(field: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleClose() {
    if (dirty) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }

  async function handleRoleConfirm() {
    if (newRole === user.role) { setRoleEditing(false); return; }
    setRoleSaving(true);
    setRoleErr(null);
    try {
      await patchRole(user.id, newRole, callerRole);
      setRoleEditing(false);
      onUpdated({ ...user, role: newRole });
    } catch (e) {
      setRoleErr(e instanceof Error ? e.message : "Failed to change role.");
    } finally {
      setRoleSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);
    try {
      const updated = await updateUser(
        user.id,
        {
          name: draft.name.trim() || undefined,
          email: draft.email.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          programme_type: draft.programme_type || undefined,
          state: draft.state || undefined,
          school_id: draft.school_id.trim() || undefined,
          school_code: draft.school_code.trim() || undefined,
          roll_number: draft.roll_number.trim() || undefined,
          district: draft.district.trim() || undefined,
        },
        callerRole,
      );
      setDraft(makeDraft(updated));
      onUpdated(updated);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteUser(user.id, callerRole);
      onDeleted();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Failed to delete user.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const isStudent = user.role === "STUDENT";
  const isFellow = user.role === "FELLOW";
  const isPMorZM = user.role === "PROGRAM_MANAGER" || user.role === "ZONAL_MANAGER";
  const isSelf = user.id === callerId;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(3,72,82,0.18)",
          backdropFilter: "blur(3px)",
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(580px, 100vw)",
        background: "#ffffff",
        borderLeft: "1px solid rgba(3,72,82,0.1)",
        boxShadow: "-24px 0 64px rgba(3,72,82,0.12)",
        zIndex: 41,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          padding: "24px 28px 16px",
          borderBottom: "1px solid rgba(3,72,82,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={S.label}>User Details</p>
            <h2 style={{ ...S.heading, fontSize: "20px", margin: "4px 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.name}
            </h2>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", margin: 0 }}>{user.email ?? "—"}</p>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} />
            </div>
          </div>
          <button onClick={handleClose} style={S.closeBtn} aria-label="Close panel">✕</button>
        </div>

        {/* ── Scrollable body ─────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* ── Role Section ───────────────────────────────── */}
          <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
            <p style={{ ...S.label, marginBottom: "10px" }}>Role</p>
            {roleEditing ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ ...S.input, flex: 1, minWidth: 0, padding: "7px 12px", fontSize: "13px" }}
                >
                  {VALID_ROLES.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <button
                  onClick={() => void handleRoleConfirm()}
                  disabled={roleSaving}
                  style={{ ...S.smallBtn, background: "#0abe62", color: "#fff", borderColor: "#0abe62", opacity: roleSaving ? 0.65 : 1 }}
                >
                  {roleSaving ? "…" : "Confirm"}
                </button>
                <button
                  onClick={() => { setRoleEditing(false); setNewRole(user.role); setRoleErr(null); }}
                  style={S.smallBtn}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <RoleBadge role={user.role} />
                {!isSelf && (
                  <button onClick={() => setRoleEditing(true)} style={S.smallBtn}>Change</button>
                )}
              </div>
            )}
            {roleErr && <p style={{ fontSize: "12px", color: "#e53e3e", margin: "6px 0 0" }}>{roleErr}</p>}
          </div>

          {/* ── Details Section ─────────────────────────────── */}
          <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
            <p style={{ ...S.label, marginBottom: "14px" }}>Details</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

              <div style={S.formRow}>
                <PanelField label="Full Name">
                  <input
                    value={draft.name}
                    onChange={(e) => set("name", e.target.value)}
                    style={S.input}
                    placeholder="Full name"
                  />
                </PanelField>
                <PanelField label="Email">
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => set("email", e.target.value)}
                    style={S.input}
                    placeholder="Email address"
                  />
                </PanelField>
              </div>

              <PanelField label="Phone">
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  style={S.input}
                  placeholder="Phone number"
                />
              </PanelField>

              {isStudent && (
                <>
                  <div style={S.formRow}>
                    <PanelField label="Roll Number">
                      <input
                        value={draft.roll_number}
                        onChange={(e) => set("roll_number", e.target.value)}
                        style={S.input}
                        placeholder="Roll number"
                      />
                    </PanelField>
                    <PanelField label="Programme">
                      <select value={draft.programme_type} onChange={(e) => set("programme_type", e.target.value)} style={S.input}>
                        <option value="">Select…</option>
                        <option value="UG">UG</option>
                        <option value="PG">PG</option>
                      </select>
                    </PanelField>
                  </div>
                  <div style={S.formRow}>
                    <PanelField label="State">
                      <select value={draft.state} onChange={(e) => set("state", e.target.value)} style={S.input}>
                        <option value="">Select…</option>
                        <option value="KERALA">Kerala</option>
                        <option value="KARNATAKA">Karnataka</option>
                        <option value="TAMIL_NADU">Tamil Nadu</option>
                        <option value="CHHATTISGARH">Chhattisgarh</option>
                      </select>
                    </PanelField>
                    <PanelField label="School">
                      <input
                        value={draft.school_id}
                        onChange={(e) => set("school_id", e.target.value)}
                        style={S.input}
                        placeholder="School name"
                      />
                    </PanelField>
                  </div>
                  <PanelField label="School Code">
                    <input
                      value={draft.school_code}
                      onChange={(e) => set("school_code", e.target.value)}
                      style={S.input}
                      placeholder="School code"
                    />
                  </PanelField>
                </>
              )}

              {isFellow && (
                <>
                  <div style={S.formRow}>
                    <PanelField label="Programme">
                      <select value={draft.programme_type} onChange={(e) => set("programme_type", e.target.value)} style={S.input}>
                        <option value="">Select…</option>
                        <option value="UG">UG</option>
                        <option value="PG">PG</option>
                      </select>
                    </PanelField>
                    <PanelField label="State">
                      <select value={draft.state} onChange={(e) => set("state", e.target.value)} style={S.input}>
                        <option value="">Select…</option>
                        <option value="KERALA">Kerala</option>
                        <option value="KARNATAKA">Karnataka</option>
                        <option value="TAMIL_NADU">Tamil Nadu</option>
                        <option value="CHHATTISGARH">Chhattisgarh</option>
                      </select>
                    </PanelField>
                  </div>
                  <div style={S.formRow}>
                    <PanelField label="District">
                      <input
                        value={draft.district}
                        onChange={(e) => set("district", e.target.value)}
                        style={S.input}
                        placeholder="District"
                      />
                    </PanelField>
                    <PanelField label="School">
                      <input
                        value={draft.school_id}
                        onChange={(e) => set("school_id", e.target.value)}
                        style={S.input}
                        placeholder="School name"
                      />
                    </PanelField>
                  </div>
                </>
              )}

              {isPMorZM && (
                <PanelField label="State">
                  <select value={draft.state} onChange={(e) => set("state", e.target.value)} style={S.input}>
                    <option value="">Select…</option>
                    <option value="KERALA">Kerala</option>
                    <option value="KARNATAKA">Karnataka</option>
                    <option value="TAMIL_NADU">Tamil Nadu</option>
                    <option value="CHHATTISGARH">Chhattisgarh</option>
                  </select>
                </PanelField>
              )}

            </div>
          </div>

          {/* ── Courses & Bundles (STUDENT only) ───────────── */}
          {isStudent && (
            <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
              <p style={{ ...S.label, marginBottom: "6px" }}>Courses & Bundles</p>
              <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: "0 0 12px" }}>
                Assign learning content to this student.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => onAssignCourse(user)}
                  style={{
                    flex: 1, padding: "10px 16px",
                    border: "1.5px solid rgba(10,190,98,0.35)",
                    borderRadius: "10px", background: "rgba(10,190,98,0.05)",
                    color: "#0a944e", fontFamily: "var(--font-body)",
                    fontSize: "13px", fontWeight: 700, cursor: "pointer",
                    transition: "all 150ms",
                  }}
                >
                  Assign Course
                </button>
                <button
                  onClick={() => onAssignBundle(user)}
                  style={{
                    flex: 1, padding: "10px 16px",
                    border: "1.5px solid rgba(32,147,121,0.35)",
                    borderRadius: "10px", background: "rgba(32,147,121,0.05)",
                    color: "#209379", fontFamily: "var(--font-body)",
                    fontSize: "13px", fontWeight: 700, cursor: "pointer",
                    transition: "all 150ms",
                  }}
                >
                  Assign Bundle
                </button>
              </div>
            </div>
          )}

          {/* ── Danger Zone ─────────────────────────────────── */}
          {!isSelf && (
            <div style={{ padding: "16px 28px" }}>
              <p style={{ ...S.label, color: "#c53030", marginBottom: "10px" }}>Danger Zone</p>
              {confirmDelete ? (
                <div style={{
                  background: "rgba(229,62,62,0.06)",
                  border: "1px solid rgba(229,62,62,0.25)",
                  borderRadius: "12px", padding: "14px 16px",
                }}>
                  <p style={{ fontSize: "13px", color: "#c53030", fontWeight: 600, margin: "0 0 10px" }}>
                    Delete {user.name}? This cannot be undone.
                  </p>
                  {deleteErr && (
                    <p style={{ fontSize: "12px", color: "#e53e3e", margin: "0 0 10px" }}>{deleteErr}</p>
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      style={{ ...S.dangerBtn, background: "rgba(229,62,62,0.1)", opacity: deleting ? 0.65 : 1 }}
                    >
                      {deleting ? "Deleting…" : "Yes, Delete"}
                    </button>
                    <button
                      onClick={() => { setConfirmDelete(false); setDeleteErr(null); }}
                      style={S.smallBtn}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={S.dangerBtn}>
                  Delete User
                </button>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div style={{
          padding: "14px 28px",
          borderTop: "1px solid rgba(3,72,82,0.08)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}>
          {saveErr && (
            <p style={{ fontSize: "12px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{saveErr}</p>
          )}
          {confirmClose && (
            <div style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: "10px", padding: "10px 14px",
              fontSize: "13px", color: "#92400e",
            }}>
              You have unsaved changes. Discard them?
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            {dirty ? (
              <>
                {confirmClose ? (
                  <button onClick={onClose} style={S.dangerBtn}>Discard & Close</button>
                ) : (
                  <button onClick={handleClose} style={S.ghostBtn}>Cancel</button>
                )}
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  style={{ ...S.primaryBtn, opacity: saving ? 0.65 : 1 }}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            ) : (
              <button onClick={onClose} style={S.ghostBtn}>Close</button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "rgba(3,72,82,0.5)",
        margin: "0 0 5px",
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    SUPER_ADMIN:     { bg: "rgba(3,72,82,0.1)",     color: "#034852" },
    PROGRAM_MANAGER: { bg: "rgba(0,109,108,0.1)",   color: "#006d6c" },
    ZONAL_MANAGER:   { bg: "rgba(32,147,121,0.1)",  color: "#209379" },
    FELLOW:          { bg: "rgba(10,190,98,0.1)",   color: "#0a944e" },
    STUDENT:         { bg: "rgba(166,219,116,0.2)", color: "#4a7a20" },
    GOVERNMENT:      { bg: "rgba(255,222,0,0.2)",   color: "#7a6600" },
    FUNDING_PARTNER: { bg: "rgba(255,222,89,0.2)",  color: "#7a6000" },
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

// ── Styles ─────────────────────────────────────────────────────

const S = {
  label: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.28em", color: "#209379",
    margin: 0,
  } as React.CSSProperties,

  heading: {
    fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852",
    margin: 0,
  } as React.CSSProperties,

  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  } as React.CSSProperties,

  input: {
    width: "100%", padding: "10px 14px",
    background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: "10px", color: "#034852", fontFamily: "var(--font-body)",
    fontSize: "13px", outline: "none", boxSizing: "border-box",
  } as React.CSSProperties,

  smallBtn: {
    padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
    background: "none",
    borderWidth: "1px", borderStyle: "solid", borderColor: "rgba(3,72,82,0.2)",
    borderRadius: "8px",
    color: "#034852", transition: "all 150ms", whiteSpace: "nowrap",
  } as React.CSSProperties,

  primaryBtn: {
    padding: "10px 20px", border: "none", borderRadius: "10px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700,
    fontSize: "13px", cursor: "pointer",
    boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
    transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
  } as React.CSSProperties,

  ghostBtn: {
    padding: "10px 20px", background: "none",
    border: "1px solid rgba(3,72,82,0.2)", borderRadius: "10px",
    color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer",
  } as React.CSSProperties,

  dangerBtn: {
    padding: "8px 16px", background: "none",
    border: "1px solid rgba(229,62,62,0.3)", borderRadius: "10px",
    color: "#c53030", fontWeight: 600, fontSize: "13px", cursor: "pointer",
  } as React.CSSProperties,

  closeBtn: {
    background: "none", border: "none", fontSize: "18px",
    color: "rgba(3,72,82,0.4)", cursor: "pointer", padding: "4px 8px",
    borderRadius: "8px", flexShrink: 0,
  } as React.CSSProperties,
};
