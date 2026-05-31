"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchCatalogue,
  fetchRoleDefaults,
  putRoleDefaults,
  deleteRole,
  BUILTIN_ROLES,
  type CatalogueModule,
} from "@/app/dashboard/role-management/role-management.utils";
import { clearUserCache } from "@/hooks/use-current-user";

interface RolePermissionPanelProps {
  roleCode: string;
  roleName: string;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

// `courses.create` → `create`
function actionOf(permCode: string): string {
  return permCode.includes(".") ? permCode.slice(permCode.indexOf(".") + 1) : permCode;
}

export function RolePermissionPanel({
  roleCode,
  roleName,
  canManage,
  onClose,
  onSaved,
  onDeleted,
}: RolePermissionPanelProps) {
  const readOnly = roleCode === "SUPER_ADMIN" || !canManage;
  const deletable = canManage && !BUILTIN_ROLES.includes(roleCode as (typeof BUILTIN_ROLES)[number]);

  const [modules, setModules] = useState<CatalogueModule[]>([]);
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState("dashboard");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      const [cat, defaults] = await Promise.all([
        fetchCatalogue(),
        fetchRoleDefaults(roleCode),
      ]);
      setModules(cat.modules);
      const set = new Set(defaults);
      setInitial(new Set(set));
      setGranted(new Set(set));
      if (cat.modules.length > 0 && !cat.modules.some((m) => m.code === "dashboard")) {
        setSelectedModule(cat.modules[0].code);
      } else {
        setSelectedModule("dashboard");
      }
    } catch {
      setModules([]);
      setInitial(new Set());
      setGranted(new Set());
    } finally {
      setLoading(false);
    }
  }, [roleCode]);

  useEffect(() => {
    void load();
    setConfirmDelete(false);
    setDeleteErr(null);
  }, [load]);

  const dirty =
    granted.size !== initial.size ||
    Array.from(granted).some((c) => !initial.has(c));

  function toggle(permCode: string) {
    if (readOnly) return;
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(permCode)) next.delete(permCode);
      else next.add(permCode);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      await putRoleDefaults(roleCode, Array.from(granted));
      setInitial(new Set(granted));
      // Editing role defaults can change the current user's own effective
      // permissions; clear the cached profile so nav refreshes.
      clearUserCache();
      setSaveOk(true);
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteRole(roleCode);
      onDeleted();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Failed to delete role.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const selectedMod = modules.find((m) => m.code === selectedModule);
  const selectedModuleName = selectedMod?.name ?? selectedModule;
  const selectedPerms = selectedMod?.permissions ?? [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .rpp-panel { width: 100vw !important; }
          .rpp-header { padding: 18px 18px 12px !important; }
          .rpp-body { flex-direction: column !important; }
          .rpp-modules {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(3,72,82,0.08) !important;
            display: flex !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding: 6px 8px !important;
            scrollbar-width: none;
          }
          .rpp-modules::-webkit-scrollbar { display: none; }
          .rpp-modules-label { display: none !important; }
          .rpp-modules button {
            flex-shrink: 0 !important;
            width: auto !important;
            padding: 8px 12px !important;
            border-left: none !important;
            border-bottom: 3px solid transparent !important;
            white-space: nowrap;
            font-size: 12px !important;
          }
          .rpp-modules button[data-active="true"] {
            border-bottom-color: #0abe62 !important;
          }
          .rpp-content { padding: 14px 16px !important; }
          .rpp-footer { padding: 12px 16px !important; }
          .rpp-footer-row { flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
          .rpp-footer-row > div { width: 100%; display: flex; gap: 8px; }
          .rpp-footer-row button { flex: 1; }
        }
      ` }} />
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.18)", backdropFilter: "blur(3px)", zIndex: 40 }}
      />
      <div className="rpp-panel" style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(580px, 100vw)",
        background: "#ffffff", borderLeft: "1px solid rgba(3,72,82,0.1)",
        boxShadow: "-24px 0 64px rgba(3,72,82,0.12)", zIndex: 41,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div className="rpp-header" style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={S.label}>Role Permissions</p>
            <h2 style={{ ...S.heading, fontSize: "20px", margin: "4px 0 2px" }}>{roleName}</h2>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", margin: 0 }}>{roleCode}</p>
            {readOnly && (
              <p style={{ fontSize: "12px", color: "#92400e", marginTop: "6px" }}>
                {roleCode === "SUPER_ADMIN"
                  ? "Super Admin has full access by default — permissions can't be edited."
                  : "You don't have permission to edit roles."}
              </p>
            )}
          </div>
          <button onClick={onClose} style={S.closeBtn} aria-label="Close panel">✕</button>
        </div>

        {/* Body */}
        <div className="rpp-body" style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div className="rpp-modules" style={{ width: "160px", borderRight: "1px solid rgba(3,72,82,0.08)", overflowY: "auto", flexShrink: 0, padding: "8px 0" }}>
            <p className="rpp-modules-label" style={{ ...S.label, padding: "8px 16px 4px", fontSize: "9px" }}>Modules</p>
            {modules.map((mod) => {
              const active = selectedModule === mod.code;
              return (
                <button
                  key={mod.code}
                  data-active={active}
                  onClick={() => setSelectedModule(mod.code)}
                  style={{
                    display: "block", width: "100%", padding: "9px 16px", border: "none",
                    background: active ? "rgba(10,190,98,0.08)" : "transparent",
                    borderLeft: `3px solid ${active ? "#0abe62" : "transparent"}`,
                    color: active ? "#034852" : "rgba(3,72,82,0.6)",
                    fontFamily: "var(--font-body)", fontSize: "13px",
                    fontWeight: active ? 600 : 400, cursor: "pointer", textAlign: "left",
                  }}
                >
                  {mod.name}
                </button>
              );
            })}
          </div>

          <div className="rpp-content" style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
            {loading ? (
              <p style={{ ...S.subtitle, marginTop: "24px" }}>Loading permissions…</p>
            ) : (
              <>
                <p style={{ ...S.heading, fontSize: "15px", marginBottom: "4px" }}>{selectedModuleName}</p>
                <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)", marginBottom: "20px" }}>
                  Toggles set the role&apos;s default grants. Per-user exceptions live in User Management.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {selectedPerms.map((perm) => {
                    const on = granted.has(perm.code);
                    return (
                      <div key={perm.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: "10px", background: "rgba(3,72,82,0.02)" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#034852", textTransform: "capitalize" }}>
                          {actionOf(perm.code)}
                        </span>
                        <ToggleSwitch on={on} disabled={readOnly} onChange={() => toggle(perm.code)} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="rpp-footer" style={{ padding: "14px 28px", borderTop: "1px solid rgba(3,72,82,0.08)", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {saveErr && <p style={{ fontSize: "12px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{saveErr}</p>}
          {deleteErr && <p style={{ fontSize: "12px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{deleteErr}</p>}
          {saveOk && !dirty && <p style={{ fontSize: "12px", color: "#0abe62", fontWeight: 600, margin: 0 }}>Saved. Affected users see changes on their next refresh.</p>}
          {confirmDelete && (
            <div style={{ background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#c53030" }}>
              Delete role <strong>{roleCode}</strong>? This can&apos;t be undone.
            </div>
          )}
          <div className="rpp-footer-row" style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              {deletable && (
                confirmDelete ? (
                  <button onClick={() => void handleDelete()} disabled={deleting} style={S.dangerBtn}>
                    {deleting ? "Deleting…" : "Confirm delete"}
                  </button>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} style={S.ghostDanger}>Delete role</button>
                )
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={onClose} style={S.ghostBtn}>Close</button>
              {!readOnly && (
                <button onClick={() => void handleSave()} disabled={saving || !dirty} style={{ ...S.primaryBtn, opacity: saving || !dirty ? 0.5 : 1 }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ToggleSwitch({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled}
      onClick={onChange}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: on ? "#0abe62" : "rgba(3,72,82,0.15)",
        opacity: disabled ? 0.6 : 1, position: "relative", flexShrink: 0,
      }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 200ms", display: "block" }} />
    </button>
  );
}

const S = {
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: "14px", color: "rgba(3,72,82,0.6)", margin: 0 } as React.CSSProperties,
  primaryBtn: { padding: "10px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer" } as React.CSSProperties,
  ghostBtn: { padding: "10px 20px", background: "none", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "10px", color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer" } as React.CSSProperties,
  ghostDanger: { padding: "10px 16px", background: "none", border: "1px solid rgba(229,62,62,0.3)", borderRadius: "10px", color: "#c53030", fontWeight: 600, fontSize: "13px", cursor: "pointer" } as React.CSSProperties,
  dangerBtn: { padding: "10px 16px", background: "#e53e3e", border: "none", borderRadius: "10px", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer" } as React.CSSProperties,
  closeBtn: { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.4)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px", flexShrink: 0 } as React.CSSProperties,
};
