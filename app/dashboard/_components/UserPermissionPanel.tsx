"use client";

import { useEffect, useState, useCallback } from "react";
import type { SafeUser } from "@/lib/api";
import {
  fetchCatalogue,
  fetchOverrides,
  fetchEffectivePermissions,
  addOverride,
  deleteOverride,
  patchRole,
  type Override,
  type CatalogueModule,
} from "@/app/dashboard/role-management/role-management.utils";
import { clearUserCache } from "@/hooks/use-current-user";

interface UserPermissionPanelProps {
  user: SafeUser;
  callerId: string;
  onClose: () => void;
  onRoleChanged: () => void;
}

type PermState = "ALLOW" | "DENY" | "NONE";
type PendingAction = "ALLOW" | "DENY" | "CLEAR";

// `courses.create` → `create`
function actionOf(permCode: string): string {
  return permCode.includes(".") ? permCode.slice(permCode.indexOf(".") + 1) : permCode;
}

export function UserPermissionPanel({
  user,
  callerId,
  onClose,
  onRoleChanged,
}: UserPermissionPanelProps) {
  const [modules, setModules] = useState<CatalogueModule[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [effective, setEffective] = useState<null | { permissions: string[]; modules: any[] }>(null);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState("dashboard");
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingAction>>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [roleEditing, setRoleEditing] = useState(false);
  const [newRole, setNewRole] = useState(user.role);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleErr, setRoleErr] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty = Object.keys(pendingChanges).length > 0;

  // Load the module/permission catalogue once.
  useEffect(() => {
    let cancelled = false;
    fetchCatalogue()
      .then((cat) => {
        if (cancelled) return;
        setModules(cat.modules);
        setRoleOptions(cat.roles.map((r) => r.code));
        if (cat.modules.length > 0 && !cat.modules.some((m) => m.code === "dashboard")) {
          setSelectedModule(cat.modules[0].code);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModules([]);
          setRoleOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const [ovs, eff] = await Promise.all([
        fetchOverrides(user.id),
        // May throw if the caller lacks role_management.view — return null so
        // the UI stays usable.
        fetchEffectivePermissions(user.id).catch(() => null),
      ]);
      setOverrides(ovs);
      setEffective(eff);
    } catch {
      setOverrides([]);
      setEffective(null);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadOverrides();
    setPendingChanges({});
    setSaveErr(null);
    setSelectedModule("dashboard");
    setRoleEditing(false);
    setNewRole(user.role);
    setRoleErr(null);
    setConfirmClose(false);
  }, [user.id, loadOverrides, user.role]);

  function getPermState(permCode: string): PermState {
    const pending = pendingChanges[permCode];
    if (pending === "ALLOW") return "ALLOW";
    if (pending === "DENY") return "DENY";
    if (pending === "CLEAR") return "NONE";
    // Explicit saved override takes precedence
    const saved = overrides.find((o) => o.permission_code === permCode);
    if (saved) return saved.effect as PermState;

    // Otherwise, consult effective permissions (role grants + user allows)
    if (effective && Array.isArray(effective.permissions) && effective.permissions.includes(permCode)) {
      return "ALLOW";
    }

    return "NONE";
  }

  function setPending(permCode: string, action: PendingAction) {
    setPendingChanges((prev) => {
      const savedOverride = overrides.find((o) => o.permission_code === permCode);
      const savedEffect = savedOverride?.effect ?? null;

      // If the action matches the already-saved state, remove from pending (no-op)
      if (
        (action === "ALLOW" && savedEffect === "ALLOW") ||
        (action === "DENY" && savedEffect === "DENY") ||
        (action === "CLEAR" && !savedOverride)
      ) {
        const { [permCode]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [permCode]: action };
    });
  }

  function handleToggle(permCode: string) {
    const current = getPermState(permCode);
    if (current === "ALLOW") {
      setPending(permCode, "CLEAR");
    } else {
      setPending(permCode, "ALLOW");
    }
  }

  function handleDeny(permCode: string) {
    const current = getPermState(permCode);
    if (current === "DENY") {
      setPending(permCode, "CLEAR");
    } else {
      setPending(permCode, "DENY");
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      for (const [permCode, action] of Object.entries(pendingChanges)) {
        if (action === "ALLOW" || action === "DENY") {
          await addOverride(user.id, permCode, action, callerId);
        } else {
          const existing = overrides.find((o) => o.permission_code === permCode);
          if (existing) await deleteOverride(user.id, existing.id);
        }
      }
      const fresh = await fetchOverrides(user.id);
      setOverrides(fresh);
      setPendingChanges({});
      // If we edited the currently-logged-in user's permissions, clear the
      // client-side cached profile so the UI (sidebar/navigation) reflects
      // the updated effective modules/permissions immediately.
      if (user.id === callerId) {
        try {
          clearUserCache();
          // Hard reload to force re-fetch of the current user profile.
          window.location.reload();
        } catch {
          // ignore
        }
      } else {
        // Refresh effective permissions for non-current users
        try {
          const eff = await fetchEffectivePermissions(user.id).catch(() => null);
          setEffective(eff);
        } catch {
          // ignore
        }
        setSaveOk(true);
      }
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleConfirm() {
    if (newRole === user.role) { setRoleEditing(false); return; }
    setRoleSaving(true);
    setRoleErr(null);
    try {
      await patchRole(user.id, newRole);
      // If we changed the currently-logged-in user's role, clear cache and reload
      if (user.id === callerId) {
        try {
          clearUserCache();
          window.location.reload();
          return; // reload will interrupt flow
        } catch {
          // ignore and fall through to normal behavior
        }
      }
      onRoleChanged();
      setRoleEditing(false);
    } catch (e) {
      setRoleErr(e instanceof Error ? e.message : "Failed to change role.");
    } finally {
      setRoleSaving(false);
    }
  }

  function handleClose() {
    if (dirty) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }

  const selectedMod = modules.find((m) => m.code === selectedModule);
  const selectedModuleName = selectedMod?.name ?? selectedModule;
  const selectedActions = selectedMod?.permissions.map((p) => actionOf(p.code)) ?? [];
  const pendingCount = Object.keys(pendingChanges).length;

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
            <p style={S.label}>User Permissions</p>
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

        {/* ── Role Section ───────────────────────────────── */}
        <div style={{
          padding: "14px 28px",
          borderBottom: "1px solid rgba(3,72,82,0.08)",
          flexShrink: 0,
        }}>
          <p style={{ ...S.label, marginBottom: "8px" }}>Role</p>
          {roleEditing ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{ ...S.input, flex: 1, minWidth: 0, padding: "7px 12px", fontSize: "13px" }}
              >
                {roleOptions.map((r) => (
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
              {user.id !== callerId && (
                <button onClick={() => setRoleEditing(true)} style={S.smallBtn}>
                  Change
                </button>
              )}
            </div>
          )}
          {roleErr && <p style={{ fontSize: "12px", color: "#e53e3e", marginTop: "6px" }}>{roleErr}</p>}
        </div>

        {/* ── Permission Body ────────────────────────────── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* Module list */}
          <div style={{
            width: "160px",
            borderRight: "1px solid rgba(3,72,82,0.08)",
            overflowY: "auto",
            flexShrink: 0,
            padding: "8px 0",
          }}>
            <p style={{ ...S.label, padding: "8px 16px 4px", fontSize: "9px" }}>Modules</p>
            {modules.map((mod) => {
              const active = selectedModule === mod.code;
              const hasPending = mod.permissions.some((p) => pendingChanges[p.code]);
              return (
                <button
                  key={mod.code}
                  onClick={() => setSelectedModule(mod.code)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "9px 16px",
                    border: "none",
                    background: active ? "rgba(10,190,98,0.08)" : "transparent",
                    borderLeft: `3px solid ${active ? "#0abe62" : "transparent"}`,
                    color: active ? "#034852" : "rgba(3,72,82,0.6)",
                    fontFamily: "var(--font-body)",
                    fontSize: "13px",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 150ms",
                  }}
                >
                  <span>{mod.name}</span>
                  {hasPending && (
                    <span style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: "#f59e0b", flexShrink: 0,
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Permission toggles */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
            {loading ? (
              <p key="permissions-loading" style={{ ...S.subtitle, marginTop: "24px" }}>Loading permissions…</p>
            ) : (
              <>
                <p key="permissions-module-heading" style={{ ...S.heading, fontSize: "15px", marginBottom: "4px" }}>{selectedModuleName}</p>
                <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)", marginBottom: "20px" }}>
                  Toggles grant explicit access. Use Deny to block role defaults.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {selectedActions.map((action) => {
                    const permCode = `${selectedModule}.${action}`;
                    const state = getPermState(permCode);
                    const isPending = Boolean(pendingChanges[permCode]);
                    return (
                      <PermissionRow
                        key={permCode}
                        action={action}
                        state={state}
                        isPending={isPending}
                        onToggle={() => handleToggle(permCode)}
                        onDeny={() => handleDeny(permCode)}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
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
          {saveOk && (
            <p style={{ fontSize: "12px", color: "#0abe62", fontWeight: 600, margin: 0 }}>
              Saved. Changes take effect on the user&apos;s next page refresh.
            </p>
          )}
          {confirmClose && (
            <div style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "13px",
              color: "#92400e",
            }}>
              You have {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}. Discard them?
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
                  style={{ ...S.primaryBtn, opacity: saving ? 0.65 : 1, minWidth: "120px" }}
                >
                  {saving ? "Saving…" : `Save ${pendingCount > 0 ? `(${pendingCount})` : "Changes"}`}
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

// ── Permission Row ─────────────────────────────────────────────

function PermissionRow({
  action,
  state,
  isPending,
  onToggle,
  onDeny,
}: {
  action: string;
  state: PermState;
  isPending: boolean;
  onToggle: () => void;
  onDeny: () => void;
}) {
  const isAllow = state === "ALLOW";
  const isDeny = state === "DENY";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "11px 14px",
      borderRadius: "10px",
      background: isPending ? "rgba(245,158,11,0.04)" : "rgba(3,72,82,0.02)",
      border: isPending ? "1px solid rgba(245,158,11,0.2)" : "1px solid transparent",
      transition: "all 150ms",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{
          fontSize: "13px", fontWeight: 600, color: "#034852",
          textTransform: "capitalize",
        }}>
          {action}
        </span>
        {isPending && (
          <span style={{
            fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#92400e",
            background: "rgba(245,158,11,0.15)", padding: "2px 6px", borderRadius: "4px",
          }}>
            Unsaved
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Deny chip */}
        <button
          type="button"
          onClick={onDeny}
          title={isDeny ? "Click to clear deny override" : "Click to explicitly deny this permission"}
          style={{
            padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
            cursor: "pointer", borderWidth: "1px", borderStyle: "solid",
            background: isDeny ? "rgba(229,62,62,0.12)" : "transparent",
            borderColor: isDeny ? "rgba(229,62,62,0.4)" : "rgba(3,72,82,0.15)",
            color: isDeny ? "#c53030" : "rgba(3,72,82,0.35)",
            transition: "all 150ms",
          }}
        >
          {isDeny ? "Denied" : "Deny"}
        </button>

        {/* Grant toggle */}
        <ToggleSwitch on={isAllow} onChange={onToggle} />
      </div>
    </div>
  );
}

// ── Toggle Switch ──────────────────────────────────────────────

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
        background: on ? "#0abe62" : "rgba(3,72,82,0.15)",
        transition: "background 200ms",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: on ? 21 : 3,
        width: 16, height: 16,
        borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 200ms",
        display: "block",
      }} />
    </button>
  );
}

// ── Badges ─────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    SUPER_ADMIN:     { bg: "rgba(3,72,82,0.1)",    color: "#034852" },
    PROGRAM_MANAGER: { bg: "rgba(0,109,108,0.1)",  color: "#006d6c" },
    ZONAL_MANAGER:   { bg: "rgba(32,147,121,0.1)", color: "#209379" },
    FELLOW:          { bg: "rgba(10,190,98,0.1)",  color: "#0a944e" },
    STUDENT:         { bg: "rgba(166,219,116,0.2)", color: "#4a7a20" },
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

// ── Styles ─────────────────────────────────────────────────────

const S = {
  label: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.28em", color: "#209379",
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
  } as React.CSSProperties,

  heading: {
    fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852",
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
  } as React.CSSProperties,

  subtitle: {
    fontSize: "14px", color: "rgba(3,72,82,0.6)",
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
  } as React.CSSProperties,

  input: {
    width: "100%", padding: "12px 16px",
    background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
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
    padding: "10px 20px", background: "none",
    border: "1px solid rgba(229,62,62,0.3)", borderRadius: "10px",
    color: "#c53030", fontWeight: 600, fontSize: "13px", cursor: "pointer",
  } as React.CSSProperties,

  closeBtn: {
    background: "none", border: "none", fontSize: "18px",
    color: "rgba(3,72,82,0.4)", cursor: "pointer", padding: "4px 8px",
    borderRadius: "8px", flexShrink: 0,
  } as React.CSSProperties,
};
