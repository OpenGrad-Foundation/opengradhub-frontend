"use client";

import { useEffect, useState, useCallback } from "react";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  fetchRoles,
  createRole,
  BUILTIN_ROLES,
} from "@/app/dashboard/role-management/role-management.utils";
import { RolePermissionPanel } from "@/app/dashboard/_components/RolePermissionPanel";
import { Plus } from "lucide-react";

type Role = { code: string; name: string };

export default function RoleManagementPage() {
  const { has } = usePermissions();
  const canManage = has(PERM.role_management.manage_roles);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Role | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRoles(await fetchRoles()); }
    catch { setRoles([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    setCreateErr(null);
    try {
      const created = await createRole({ code: newCode.trim().toUpperCase(), name: newName.trim() });
      setAdding(false);
      setNewCode("");
      setNewName("");
      await load();
      setSelected(created);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Failed to create role.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rm-container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 16px" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .rm-container { padding: 0 12px !important; }
          .rm-card { padding: 16px !important; }
          .rm-card-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .rm-add-btn { width: 100% !important; }
          .rm-create-form { flex-direction: column !important; align-items: stretch !important; }
          .rm-create-form label { min-width: 0 !important; width: 100% !important; }
          .rm-create-form button { width: 100% !important; }
          .rm-table thead { display: none !important; }
          .rm-table, .rm-table tbody, .rm-table tr, .rm-table td { display: block !important; width: 100% !important; }
          .rm-table tr {
            border: 1px solid var(--color-border) !important;
            border-radius: 12px !important;
            padding: 12px 14px !important;
            margin-bottom: 10px !important;
            position: relative;
          }
          .rm-table td {
            padding: 4px 0 !important;
            border-bottom: none !important;
            text-align: left !important;
          }
          .rm-table td:last-child { text-align: left !important; margin-top: 4px; }
        }
      ` }} />
      <div className="rm-card" style={glassCard}>
        <div className="rm-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 0" }}>Default permissions</h2>
          </div>
          {canManage && !adding && (
            <button className="rm-add-btn" onClick={() => { setAdding(true); setCreateErr(null); }} style={primaryBtn}><Plus size={16} aria-hidden="true" /> Add role</button>
          )}
        </div>

        {adding && (
          <div className="rm-create-form" style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "20px", padding: "16px", borderRadius: "12px", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "160px" }}>
              <span style={fieldLabel}>Code</span>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="E.G. CONTENT_EDITOR" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "160px" }}>
              <span style={fieldLabel}>Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Content Editor" style={inputStyle} />
            </label>
            <button onClick={() => void handleCreate()} disabled={creating || !newCode.trim() || !newName.trim()} style={{ ...primaryBtn, opacity: creating || !newCode.trim() || !newName.trim() ? 0.5 : 1 }}>
              {creating ? "Creating…" : "Create"}
            </button>
            <button onClick={() => { setAdding(false); setCreateErr(null); }} style={ghostBtn}>Cancel</button>
            {createErr && <p style={{ width: "100%", fontSize: "12px", color: "#b83232", margin: 0 }}>{createErr}</p>}
          </div>
        )}

        {loading ? (
          <p style={subtitleStyle}>Loading roles…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="rm-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {["Role", "Code", "Type", ""].map((h) => (<th key={h} style={thStyle}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const builtin = (BUILTIN_ROLES as readonly string[]).includes(r.code);
                  const isSelected = selected?.code === r.code;
                  return (
                    <tr
                      key={r.code}
                      onClick={() => setSelected(r)}
                      style={{ cursor: "pointer", background: isSelected ? "rgba(10,190,98,0.05)" : "transparent" }}
                    >
                      <td style={tdStyle}><span style={{ fontWeight: 600, color: "var(--color-text)" }}>{r.name}</span></td>
                      <td style={tdStyle}><span style={{ color: "var(--color-text-muted)" }}>{r.code}</span></td>
                      <td style={tdStyle}>
                        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, background: builtin ? "#eef5f3" : "rgba(255,222,89,0.25)", color: builtin ? "var(--color-text)" : "#7a6000" }}>
                          {builtin ? "Built-in" : "Custom"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#08784a", opacity: isSelected ? 1 : 0.7 }}>
                          {isSelected ? "Open ›" : (canManage ? "Edit →" : "View →")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {roles.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)" }}>No roles found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <RolePermissionPanel
          roleCode={selected.code}
          roleName={selected.name}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onSaved={() => { void load(); }}
          onDeleted={() => { setSelected(null); void load(); }}
        />
      )}
    </div>
  );
}

const glassCard: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px,4vw,24px)" };
const titleStyle: React.CSSProperties = { fontSize: "22px", fontWeight: 700, color: "var(--color-text)" };
const subtitleStyle: React.CSSProperties = { fontSize: "14px", color: "var(--color-text-muted)" };
const fieldLabel: React.CSSProperties = { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" };
const inputStyle: React.CSSProperties = { minHeight: "44px", padding: "0 12px", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px" };
const primaryBtn: React.CSSProperties = { minHeight: "44px", padding: "0 18px", border: "1px solid var(--green)", borderRadius: "12px", background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" };
const ghostBtn: React.CSSProperties = { minHeight: "44px", padding: "0 18px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", color: "var(--color-text)", fontWeight: 600, fontSize: "14px", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)", background: "#eef5f3", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px", borderBottom: "1px solid var(--color-border)", verticalAlign: "middle" };
