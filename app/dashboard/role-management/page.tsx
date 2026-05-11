"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getUsers, type SafeUser } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";
import { UserPermissionPanel } from "@/app/dashboard/_components/UserPermissionPanel";

export default function RoleManagementPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const callerId = data?.user?.id ?? "";

  const [users, setUsers] = useState<SafeUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [search, setSearch] = useState("");

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { setUsers(await getUsers()); }
    catch { setUsers([]); }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => { if (!userLoading) void loadUsers(); }, [userLoading, loadUsers]);

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
          Select a user to manage their role and permission overrides
        </p>
      </div>

      {/* ══ User Table ════════════════════════════════════ */}
      <div style={glassCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <p style={labelStyle}>Users</p>
            <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 0" }}>Role Assignment</h2>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ ...inputStyle, width: "260px" }}
          />
        </div>

        {usersLoading ? (
          <p style={subtitleStyle}>Loading users…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {["Name", "Email", "Current Role", "Programme", "Status", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelected={selectedUser?.id === u.id}
                    onSelect={() => setSelectedUser(u)}
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

      {/* ── Right Panel ───────────────────────────────────── */}
      {selectedUser && (
        <UserPermissionPanel
          user={selectedUser}
          callerId={callerId}
          callerRole={roleCode}
          onClose={() => setSelectedUser(null)}
          onRoleChanged={() => {
            void loadUsers();
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

// ── User Row ───────────────────────────────────────────────────

function UserRow({
  user,
  isSelected,
  onSelect,
}: {
  user: SafeUser;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      style={{
        cursor: "pointer",
        background: isSelected ? "rgba(10,190,98,0.05)" : "transparent",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(0,0,0,0.02)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.background = isSelected
          ? "rgba(10,190,98,0.05)"
          : "transparent";
      }}
    >
      <td style={tdStyle}><span style={{ fontWeight: 600, color: "#034852" }}>{user.name}</span></td>
      <td style={tdStyle}><span style={{ color: "rgba(3,72,82,0.6)" }}>{user.email ?? "—"}</span></td>
      <td style={tdStyle}><RoleBadge role={user.role} /></td>
      <td style={tdStyle}>{user.programme_type ?? "—"}</td>
      <td style={tdStyle}><StatusBadge status={user.status} /></td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <span style={{
          fontSize: "11px", fontWeight: 600, color: "#209379",
          opacity: isSelected ? 1 : 0.5,
        }}>
          {isSelected ? "Open ›" : "Manage →"}
        </span>
      </td>
    </tr>
  );
}

// ── Small components ───────────────────────────────────────────

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

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>Role Management</p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Please wait…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "24px",
  padding: "32px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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

const inputStyle: React.CSSProperties = {
  padding: "10px 16px",
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
