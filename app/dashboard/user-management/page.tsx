"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getUsers,
  createUser,
  bulkUploadUsers,
  getUserTemplateUrl,
  type SafeUser,
} from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

const ALL_ROLES: { code: string; label: string }[] = [
  { code: "SUPER_ADMIN", label: "Super Admin" },
  { code: "PROGRAM_MANAGER", label: "Program Manager" },
  { code: "ZONAL_MANAGER", label: "Zonal Manager" },
  { code: "FELLOW", label: "Fellow" },
  { code: "STUDENT", label: "Student" },
  { code: "GOVERNMENT", label: "Government" },
  { code: "FUNDING_PARTNER", label: "Funding Partner" },
];

export default function UserManagementPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;

  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoading && roleCode === "SUPER_ADMIN") void fetchUsers();
  }, [userLoading, roleCode, fetchUsers]);

  // ── Guard ──────────────────────────────────────────────────
  if (userLoading) return <LoadingState />;

  if (roleCode !== "SUPER_ADMIN") {
    return (
      <div style={glassCard}>
        <p style={labelStyle}>Access Denied</p>
        <p style={{ ...titleStyle, marginTop: "12px" }}>
          User Management is available to Super Admins only.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <p style={labelStyle}>Administration</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>User Management</h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>
            {users.length} user{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            id="add-user-btn"
            style={primaryButton}
            onClick={() => { setShowAddUser(true); setShowBulkUpload(false); }}
            onMouseEnter={hoverIn} onMouseLeave={hoverOut}
          >
            + Add User
          </button>
          <button
            id="bulk-upload-btn"
            style={{ ...primaryButton, background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)" }}
            onClick={() => { setShowBulkUpload(true); setShowAddUser(false); }}
            onMouseEnter={hoverIn} onMouseLeave={hoverOut}
          >
            ↑ Bulk Upload
          </button>
        </div>
      </div>

      {/* ── Add User Modal ────────────────────────────────── */}
      {showAddUser && (
        <AddUserForm onClose={() => setShowAddUser(false)} onCreated={() => { setShowAddUser(false); void fetchUsers(); }} />
      )}

      {/* ── Bulk Upload Modal ─────────────────────────────── */}
      {showBulkUpload && (
        <BulkUploadPanel onClose={() => setShowBulkUpload(false)} onDone={() => { void fetchUsers(); }} />
      )}

      {/* ── Users Table ───────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={glassCard}><p style={{ ...titleStyle, color: "#e53e3e" }}>{error}</p></div>
      ) : (
        <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(3,72,82,0.08)" }}>
                  {["Name", "Email", "Role", "Programme", "Status", "Created"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(3,72,82,0.05)" }}>
                    <td style={tdStyle}><strong style={{ color: "#034852" }}>{u.name}</strong></td>
                    <td style={tdStyle}>{u.email ?? "—"}</td>
                    <td style={tdStyle}><RoleBadge role={u.role} /></td>
                    <td style={tdStyle}>{u.programme_type ?? "—"}</td>
                    <td style={tdStyle}><StatusBadge status={u.status} /></td>
                    <td style={tdStyle}>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add User Form ──────────────────────────────────────────────

function AddUserForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [programme, setProgramme] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role,
        programme_type: role === "STUDENT" && programme ? programme : undefined,
        school_id: schoolId.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ ...glassCard, textAlign: "left", marginBottom: "24px", animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards", opacity: 0, transform: "translateY(12px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={labelStyle}>Add New User</p>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: "14px" }}>
          <Row>
            <Field label="Full Name *" id="user-name"><input id="user-name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="Suraj Kumar" /></Field>
            <Field label="Email *" id="user-email"><input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="suraj@opengrad.org" /></Field>
          </Row>
          <Row>
            <Field label="Phone" id="user-phone"><input id="user-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+91 9876543210" /></Field>
            <Field label="Role *" id="user-role">
              <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                {ALL_ROLES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </Field>
          </Row>
          {role === "STUDENT" && (
            <Row>
              <Field label="Programme Type" id="user-programme">
                <select id="user-programme" value={programme} onChange={(e) => setProgramme(e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  <option value="UG">UG</option>
                  <option value="PG">PG</option>
                  <option value="SCHOOL">School</option>
                </select>
              </Field>
              <Field label="School Name" id="user-school"><input id="user-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={inputStyle} placeholder="Optional" /></Field>
            </Row>
          )}
        </div>
        {error && <p style={{ marginTop: "12px", fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{error}</p>}
        <button id="user-submit-btn" type="submit" disabled={submitting || !name.trim() || !email.trim()} style={{ ...primaryButton, marginTop: "20px", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Creating…" : "Create User"}
        </button>
      </form>
    </div>
  );
}

// ── Bulk Upload Panel ──────────────────────────────────────────

function BulkUploadPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const res = await bulkUploadUsers(file);
      setResult(res);
      onDone();
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : "Upload failed."] });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ ...glassCard, textAlign: "left", marginBottom: "24px", animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards", opacity: 0, transform: "translateY(12px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={labelStyle}>Bulk Upload Users</p>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* Template download */}
      <a
        href={getUserTemplateUrl()}
        download="opengrad_users_template.csv"
        id="download-template-btn"
        style={{ ...primaryButton, display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", fontSize: "12px", padding: "10px 20px", background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)" }}
      >
        ↓ Download Template CSV
      </a>

      {/* File input */}
      <div style={{ marginTop: "20px" }}>
        <label style={formLabelStyle}>Upload CSV File</label>
        <input
          id="bulk-csv-input"
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ ...inputStyle, padding: "10px" }}
        />
      </div>

      <button
        id="bulk-submit-btn"
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{ ...primaryButton, marginTop: "16px", opacity: !file || uploading ? 0.6 : 1 }}
      >
        {uploading ? "Uploading…" : "Upload & Create Users"}
      </button>

      {/* Results */}
      {result && (
        <div style={{ marginTop: "20px", padding: "16px", borderRadius: "12px", background: "rgba(3,72,82,0.04)" }}>
          <p style={{ fontWeight: 700, color: "#034852", fontSize: "15px" }}>
            ✅ {result.created} user{result.created !== 1 ? "s" : ""} created
            {result.skipped > 0 && <>, ⚠️ {result.skipped} skipped</>}
          </p>
          {result.errors.length > 0 && (
            <ul style={{ marginTop: "10px", paddingLeft: "20px", fontSize: "12px", color: "#e53e3e", lineHeight: 1.8 }}>
              {result.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", background: "rgba(32,147,121,0.12)", color: "#209379" }}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", background: isActive ? "rgba(10,190,98,0.12)" : "rgba(220,38,38,0.10)", color: isActive ? "#0abe62" : "#dc2626" }}>
      {status}
    </span>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>{children}</div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={formLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={glassCard}>
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>Fetching users</p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Loading user records&hellip;</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 12px 20px rgba(10,190,98,0.3)";
}

function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 8px 16px rgba(10,190,98,0.2)";
}

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "24px",
  padding: "32px",
  textAlign: "center",
  boxShadow: "0 32px 64px rgba(0,0,0,0.1)",
};

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const subtitleStyle: React.CSSProperties = { fontSize: "14px", color: "rgba(3,72,82,0.6)" };

const primaryButton: React.CSSProperties = {
  padding: "12px 24px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px",
  cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 280ms cubic-bezier(0.16,1,0.3,1)", whiteSpace: "nowrap",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)",
  cursor: "pointer", padding: "4px 8px", borderRadius: "8px",
};

const formLabelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px", outline: "none",
};

const thStyle: React.CSSProperties = {
  padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379",
  background: "rgba(32,147,121,0.04)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 20px", textAlign: "left", color: "rgba(3,72,82,0.75)", fontSize: "13px",
};
