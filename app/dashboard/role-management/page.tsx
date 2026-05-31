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
          .rm-header { margin-bottom: 20px !important; }
          .rm-title { font-size: 22px !important; }
          .rm-card { padding: 18px !important; border-radius: 16px !important; }
          .rm-card-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .rm-add-btn { width: 100% !important; }
          .rm-create-form { flex-direction: column !important; align-items: stretch !important; }
          .rm-create-form label { min-width: 0 !important; width: 100% !important; }
          .rm-create-form button { width: 100% !important; }
          .rm-table thead { display: none !important; }
          .rm-table, .rm-table tbody, .rm-table tr, .rm-table td { display: block !important; width: 100% !important; }
          .rm-table tr {
            border: 1px solid rgba(0,0,0,0.08) !important;
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
      <div className="rm-header" style={{ marginBottom: "32px" }}>
        <p style={labelStyle}>Administration</p>
        <h1 className="rm-title" style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 0" }}>Role Management</h1>
        <p style={{ ...subtitleStyle, marginTop: "6px" }}>
          Set the default permissions for each role, or create a new role.
        </p>
      </div>

      <div className="rm-card" style={glassCard}>
        <div className="rm-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <p style={labelStyle}>Roles</p>
            <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 0" }}>Default Permissions</h2>
          </div>
          {canManage && !adding && (
            <button className="rm-add-btn" onClick={() => { setAdding(true); setCreateErr(null); }} style={primaryBtn}>＋ Add Role</button>
          )}
        </div>

        {adding && (
          <div className="rm-create-form" style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "20px", padding: "16px", borderRadius: "12px", background: "rgba(10,190,98,0.04)", border: "1px solid rgba(10,190,98,0.2)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "160px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#209379" }}>CODE</span>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="E.G. CONTENT_EDITOR" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "160px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#209379" }}>NAME</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Content Editor" style={inputStyle} />
            </label>
            <button onClick={() => void handleCreate()} disabled={creating || !newCode.trim() || !newName.trim()} style={{ ...primaryBtn, opacity: creating || !newCode.trim() || !newName.trim() ? 0.5 : 1 }}>
              {creating ? "Creating…" : "Create"}
            </button>
            <button onClick={() => { setAdding(false); setCreateErr(null); }} style={ghostBtn}>Cancel</button>
            {createErr && <p style={{ width: "100%", fontSize: "12px", color: "#e53e3e", margin: 0 }}>{createErr}</p>}
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
                      <td style={tdStyle}><span style={{ fontWeight: 600, color: "#034852" }}>{r.name}</span></td>
                      <td style={tdStyle}><span style={{ color: "rgba(3,72,82,0.6)" }}>{r.code}</span></td>
                      <td style={tdStyle}>
                        <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, background: builtin ? "rgba(3,72,82,0.08)" : "rgba(255,222,89,0.25)", color: builtin ? "#034852" : "#7a6000" }}>
                          {builtin ? "BUILT-IN" : "CUSTOM"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#209379", opacity: isSelected ? 1 : 0.5 }}>
                          {isSelected ? "Open ›" : (canManage ? "Edit →" : "View →")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {roles.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "rgba(3,72,82,0.4)" }}>No roles found.</td></tr>
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

const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "24px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" };
const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const subtitleStyle: React.CSSProperties = { fontSize: "14px", color: "rgba(3,72,82,0.6)" };
const inputStyle: React.CSSProperties = { padding: "10px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none" };
const primaryBtn: React.CSSProperties = { padding: "10px 18px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { padding: "10px 18px", background: "none", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "10px", color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.5)", borderBottom: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "middle" };
