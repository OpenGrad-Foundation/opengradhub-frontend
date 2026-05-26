"use client";

import { useEffect, useState, useCallback } from "react";
import Papa from "papaparse";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getUsers,
  createUser,
  bulkUploadUsers,
  getUserTemplateUrl,
  getCourses,
  assignCourse,
  getBundles,
  enrolStudentInBundle,
  getStudentsForBulk,
  bulkEnrol,
  fetchSchools,
  getManagers,
  type SafeUser,
  type Course,
  type Bundle,
  type StudentForBulk,
  type SchoolOption,
  type ManagerOption,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { UserDetailPanel } from "@/app/dashboard/_components/UserDetailPanel";

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
  const { has } = usePermissions();
  const canCreate = has(PERM.user_management.create);

  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [assignStudent, setAssignStudent] = useState<SafeUser | null>(null);
  const [assignBundleStudent, setAssignBundleStudent] = useState<SafeUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const currentUserId = data?.user?.id ?? "";

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
    if (!userLoading) void fetchUsers();
  }, [userLoading, fetchUsers]);

  if (userLoading) return <LoadingState />;

  return (
    <div>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7">
        <div>
          <p style={labelStyle}>Administration</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>User Management</h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>
            {users.length} user{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canCreate && (
            <>
              <button
                id="add-user-btn"
                style={primaryButton}
                onClick={() => { setShowAddUser(true); setShowBulkUpload(false); setShowBulkAssign(false); }}
                onMouseEnter={hoverIn} onMouseLeave={hoverOut}
              >
                + Add User
              </button>
              <button
                id="bulk-upload-btn"
                style={{ ...primaryButton, background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)" }}
                onClick={() => { setShowBulkUpload(true); setShowAddUser(false); setShowBulkAssign(false); }}
                onMouseEnter={hoverIn} onMouseLeave={hoverOut}
              >
                ↑ Bulk Upload
              </button>
              <button
                id="bulk-assign-btn"
                style={{ ...primaryButton, background: "linear-gradient(135deg, #209379 0%, #034852 100%)" }}
                onClick={() => { setShowBulkAssign(true); setShowAddUser(false); setShowBulkUpload(false); }}
                onMouseEnter={hoverIn} onMouseLeave={hoverOut}
              >
                ⚡ Bulk Assign
              </button>
            </>
          )}
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

      {/* ── Bulk Assign Panel ──────────────────────────────── */}
      {showBulkAssign && (
        <BulkAssignPanel
          onClose={() => setShowBulkAssign(false)}
        />
      )}

      {/* ── Assign Course Modal ───────────────────────────── */}
      {assignStudent && (
        <AssignCourseModal
          student={assignStudent}
          assignedBy={currentUserId}
          onClose={() => setAssignStudent(null)}
        />
      )}

      {/* ── Assign Bundle Modal ───────────────────────────── */}
      {assignBundleStudent && (
        <AssignBundleModal
          student={assignBundleStudent}
          onClose={() => setAssignBundleStudent(null)}
        />
      )}

      {/* ── User Detail Panel ─────────────────────────────── */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          callerId={currentUserId}
          onClose={() => setSelectedUser(null)}
          onUpdated={(updated) => {
            setSelectedUser(updated);
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          }}
          onDeleted={() => {
            setSelectedUser(null);
            void fetchUsers();
          }}
          onAssignCourse={(u) => setAssignStudent(u)}
          onAssignBundle={(u) => setAssignBundleStudent(u)}
        />
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
                  {["Name", "Email", "Role", "Programme", "Status", "Created", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      style={{
                        borderBottom: "1px solid rgba(3,72,82,0.05)",
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
                      <td style={tdStyle}><strong style={{ color: "#034852" }}>{u.name}</strong></td>
                      <td style={tdStyle}>{u.email ?? "—"}</td>
                      <td style={tdStyle}><RoleBadge role={u.role} /></td>
                      <td style={tdStyle}>{u.programme_type ?? "—"}</td>
                      <td style={tdStyle}><StatusBadge status={u.status} /></td>
                      <td style={tdStyle}>{new Date(u.created_at).toLocaleDateString()}</td>
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
                })}
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
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [programme, setProgramme] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [state, setState] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [passwordMode, setPasswordMode] = useState<"auto" | "manual">("auto");
  const [manualPassword, setManualPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<SafeUser | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [managerId, setManagerId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    fetchSchools()
      .then((list) => {
        if (!cancelled) setSchools(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSchoolsError(err instanceof Error ? err.message : "Failed to load schools.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setManagerId('');
    if (role === 'ZONAL_MANAGER') {
      getManagers('PROGRAM_MANAGER').then((opts) => { if (!cancelled) setManagerOptions(opts); });
    } else if (role === 'FELLOW') {
      getManagers('ZONAL_MANAGER').then((opts) => { if (!cancelled) setManagerOptions(opts); });
    } else {
      setManagerOptions([]);
    }
    return () => { cancelled = true; };
  }, [role]);

  const isStudent = role === "STUDENT";
  const isFellow = role === "FELLOW";
  const isPM = role === "PROGRAM_MANAGER";
  const isZM = role === "ZONAL_MANAGER";
  const isUgStudent = isStudent && programme === "UG";
  const roleSelected = role !== "";

  const pwRules = {
    length:    manualPassword.trim().length >= 8,
    uppercase: /[A-Z]/.test(manualPassword),
    lowercase: /[a-z]/.test(manualPassword),
    number:    /[0-9]/.test(manualPassword),
  };
  const isManualPasswordValid = passwordMode === "manual"
    ? Object.values(pwRules).every(Boolean)
    : true;
  const showPwRules = passwordMode === "manual" && manualPassword.length > 0;

  function handleRoleChange(newRole: string) {
    setRole(newRole);
    setProgramme("");
    setSchoolId("");
    setState("");
    setSchoolCode("");
    setRollNumber("");
    setDistrict("");
    setManagerId("");
    setPasswordMode("auto");
    setManualPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: Parameters<typeof createUser>[0] = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        password: passwordMode === "manual" && manualPassword.trim() ? manualPassword.trim() : undefined,
        manager_id: (isZM || isFellow) ? (managerId || null) : null,
      };
      if (isStudent) {
        if (programme) payload.programme_type = programme;
        if (state) payload.state = state;
        if (schoolId.trim()) payload.school_id = schoolId.trim();
        if (schoolCode.trim()) payload.school_code = schoolCode.trim();
        if (rollNumber.trim()) payload.roll_number = rollNumber.trim();
      } else if (isFellow) {
        if (programme) payload.programme_type = programme;
        if (state) payload.state = state;
        if (district.trim()) payload.district = district.trim();
        if (schoolId.trim()) payload.school_id = schoolId.trim();
      } else if (isPM || isZM) {
        if (state) payload.state = state;
      }
      const user = await createUser(payload);
      if (user.tempPassword) {
        setCreatedUser(user);
      } else {
        onCreated();
      }
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

      {createdUser ? (
        <CredentialsDisplay user={createdUser} onDone={onCreated} />
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: "14px" }}>

            {/* Step 1 — Role selector (always visible) */}
            <Field label="Role *" id="user-role">
              <select
                id="user-role"
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="">Select a role…</option>
                {ALL_ROLES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </Field>

            {/* Step 2 — Fields rendered only after a role is chosen */}
            {roleSelected && (
              <>
                {/* Common fields for every role */}
                <Row>
                  <Field label="Full Name *" id="user-name">
                    <input id="user-name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="Suraj Kumar" />
                  </Field>
                  <Field label={isUgStudent ? "Email" : "Email *"} id="user-email">
                    <input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!isUgStudent} style={inputStyle} placeholder="suraj@opengrad.org" />
                  </Field>
                </Row>
                <Field label="Phone" id="user-phone">
                  <input id="user-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+91 9876543210" />
                </Field>

                {/* STUDENT-only fields */}
                {isStudent && (
                  <>
                    <Row>
                      <Field label="Roll Number" id="user-roll-number">
                        <input id="user-roll-number" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} style={inputStyle} placeholder="Leave blank to auto-generate" />
                      </Field>
                      <Field label="Programme Type" id="user-programme">
                        <select id="user-programme" value={programme} onChange={(e) => setProgramme(e.target.value)} style={inputStyle}>
                          <option value="">Select…</option>
                          <option value="UG">UG</option>
                          <option value="PG">PG</option>
                        </select>
                      </Field>
                    </Row>
                    <Row>
                      <Field label="State" id="user-state">
                        <select id="user-state" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
                          <option value="">Select…</option>
                          <option value="KERALA">Kerala</option>
                          <option value="KARNATAKA">Karnataka</option>
                          <option value="TAMIL_NADU">Tamil Nadu</option>
                        </select>
                      </Field>
                      <Field label="School" id="user-school">
                        <select
                          id="user-school"
                          value={schoolId}
                          onChange={(e) => setSchoolId(e.target.value)}
                          style={inputStyle}
                          disabled={schools.length === 0 && !schoolsError}
                        >
                          <option value="">
                            {schoolsError
                              ? "Failed to load schools"
                              : schools.length === 0
                                ? "Loading schools…"
                                : "Select a school (optional)"}
                          </option>
                          {schools.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </Field>
                    </Row>
                  </>
                )}

                {/* FELLOW-only fields */}
                {isFellow && (
                  <>
                    <Row>
                      <Field label="Programme Type" id="user-programme">
                        <select id="user-programme" value={programme} onChange={(e) => setProgramme(e.target.value)} style={inputStyle}>
                          <option value="">Select…</option>
                          <option value="UG">UG</option>
                          <option value="PG">PG</option>
                        </select>
                      </Field>
                      <Field label="State" id="user-state">
                        <select id="user-state" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
                          <option value="">Select…</option>
                          <option value="KERALA">Kerala</option>
                          <option value="KARNATAKA">Karnataka</option>
                          <option value="TAMIL_NADU">Tamil Nadu</option>
                        </select>
                      </Field>
                    </Row>
                    <Row>
                      <Field label="District" id="user-district">
                        <input id="user-district" value={district} onChange={(e) => setDistrict(e.target.value)} style={inputStyle} placeholder="e.g. Ernakulam" />
                      </Field>
                      <Field label="School" id="user-school">
                        <select
                          id="user-school"
                          value={schoolId}
                          onChange={(e) => setSchoolId(e.target.value)}
                          style={inputStyle}
                          disabled={schools.length === 0 && !schoolsError}
                        >
                          <option value="">
                            {schoolsError
                              ? "Failed to load schools"
                              : schools.length === 0
                                ? "Loading schools…"
                                : "Select a school (optional)"}
                          </option>
                          {schools.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </Field>
                    </Row>
                  </>
                )}

                {/* PROGRAM_MANAGER / ZONAL_MANAGER — State only */}
                {(isPM || isZM) && (
                  <Field label="State" id="user-state">
                    <select id="user-state" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
                      <option value="">Select…</option>
                      <option value="KERALA">Kerala</option>
                      <option value="KARNATAKA">Karnataka</option>
                      <option value="TAMIL_NADU">Tamil Nadu</option>
                    </select>
                  </Field>
                )}

                {/* Reports-to manager — ZONAL_MANAGER reports to Program Manager; FELLOW reports to Zonal Manager */}
                {(isZM || isFellow) && (
                  <Field label={isZM ? "Reports to (Program Manager)" : "Reports to (Zonal Manager)"} id="user-manager">
                    <select
                      id="user-manager"
                      value={managerId}
                      onChange={(e) => setManagerId(e.target.value)}
                      required
                      style={inputStyle}
                    >
                      <option value="" disabled>Select a manager…</option>
                      {managerOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}{m.state ? ` (${m.state}${m.zone ? ` · ${m.zone}` : ''})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {/* Password section */}
                <div style={{ marginTop: "4px" }}>
                  <p style={formLabelStyle}>Password</p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    {(["auto", "manual"] as const).map((mode) => {
                      const active = passwordMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => { setPasswordMode(mode); setManualPassword(""); }}
                          style={{
                            padding: "8px 18px",
                            border: active ? "1.5px solid #034852" : "1.5px solid rgba(3,72,82,0.18)",
                            borderRadius: "10px",
                            background: active ? "rgba(3,72,82,0.07)" : "transparent",
                            color: active ? "#034852" : "rgba(3,72,82,0.55)",
                            fontFamily: "var(--font-body)",
                            fontSize: "13px",
                            fontWeight: active ? 700 : 500,
                            cursor: "pointer",
                            transition: "all 180ms ease",
                          }}
                        >
                          {mode === "auto" ? "Auto-generate" : "Set manually"}
                        </button>
                      );
                    })}
                  </div>
                  {passwordMode === "auto" && (
                    <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: 0 }}>
                      A secure password will be generated and shown after creation.
                    </p>
                  )}
                  {passwordMode === "manual" && (
                    <>
                      <input
                        id="user-password"
                        type="text"
                        value={manualPassword}
                        onChange={(e) => setManualPassword(e.target.value)}
                        placeholder="e.g. OpenGrad@2025"
                        style={{
                          ...inputStyle,
                          fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
                          letterSpacing: "0.04em",
                          borderColor: showPwRules && !isManualPasswordValid ? "#e53e3e" : undefined,
                        }}
                      />
                      {showPwRules && (
                        <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {([
                            { key: "length",    label: "8+ chars" },
                            { key: "uppercase", label: "Uppercase" },
                            { key: "lowercase", label: "Lowercase" },
                            { key: "number",    label: "Number" },
                          ] as const).map(({ key, label }) => (
                            <span key={key} style={{
                              fontSize: "11px", fontWeight: 600, padding: "3px 9px",
                              borderRadius: "100px",
                              background: pwRules[key] ? "rgba(10,190,98,0.12)" : "rgba(229,62,62,0.10)",
                              color: pwRules[key] ? "#0abe62" : "#e53e3e",
                              border: `1px solid ${pwRules[key] ? "rgba(10,190,98,0.25)" : "rgba(229,62,62,0.2)"}`,
                            }}>
                              {pwRules[key] ? "✓" : "✗"} {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {error && <p style={{ marginTop: "12px", fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{error}</p>}
          <button
            id="user-submit-btn"
            type="submit"
            disabled={!roleSelected || submitting || !name.trim() || (!isUgStudent && !email.trim()) || (passwordMode === "manual" && !manualPassword.trim()) || !isManualPasswordValid}
            style={{ ...primaryButton, marginTop: "20px", opacity: (!roleSelected || submitting) ? 0.5 : 1 }}
          >
            {submitting ? "Creating…" : "Create User"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Credentials Display ────────────────────────────────────────

function CredentialRow({ label, value, copyId }: { label: string; value: string; copyId: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ marginBottom: "12px" }}>
      <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.55)" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <code
          id={copyId}
          style={{
            flex: 1,
            display: "block",
            background: "#ffffff",
            border: "1px solid rgba(3,72,82,0.15)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
            fontSize: "14px",
            fontWeight: 600,
            color: "#034852",
            letterSpacing: "0.03em",
            wordBreak: "break-all",
          }}
        >
          {value}
        </code>
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          style={{
            flexShrink: 0,
            padding: "10px 14px",
            border: "1px solid rgba(3,72,82,0.15)",
            borderRadius: "8px",
            background: copied ? "rgba(10,190,98,0.12)" : "rgba(3,72,82,0.04)",
            color: copied ? "#0abe62" : "#034852",
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 200ms ease",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function CredentialsDisplay({ user, onDone }: { user: SafeUser; onDone: () => void }) {
  return (
    <div>
      <h3 style={{ ...titleStyle, fontSize: "18px", color: "#034852" }}>User Provisioned Successfully</h3>
      <p style={{ marginTop: "10px", fontSize: "14px", color: "rgba(3,72,82,0.75)", lineHeight: 1.6 }}>
        A temporary password was generated for this user.{" "}
        <strong style={{ color: "#034852" }}>Share these credentials securely.</strong>{" "}
        The user will be required to change the password on first login.
      </p>
      <div style={{ marginTop: "20px", background: "rgba(3,72,82,0.03)", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "14px", padding: "20px" }}>
        <CredentialRow label="Name" value={user.name} copyId="cred-name" />
        {user.roll_number && (
          <CredentialRow label="Roll Number" value={user.roll_number} copyId="cred-roll" />
        )}
        {user.email && (
          <CredentialRow label="Email" value={user.email} copyId="cred-email" />
        )}
        <CredentialRow label="Temporary Password" value={user.tempPassword!} copyId="cred-password" />
      </div>
      <button onClick={onDone} style={{ ...primaryButton, width: "100%", marginTop: "24px" }}>Done</button>
    </div>
  );
}

// ── Assign Course Modal ────────────────────────────────────────

function AssignCourseModal({
  student,
  assignedBy,
  onClose,
}: {
  student: SafeUser;
  assignedBy: string;
  onClose: () => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setCoursesLoading(true);
    getCourses(student.programme_type ?? undefined)
      .then((data) => setCourses(data))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false));
  }, [student.programme_type]);

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAssign() {
    if (!selectedCourseId) return;
    setSubmitting(true);
    setError(null);
    setIsAlreadyEnrolled(false);
    try {
      await assignCourse(student.id, selectedCourseId, assignedBy);
      setSuccess(true);
    } catch (err) {
      // 409 Conflict = already enrolled — show a soft warning, not a red error
      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      if (status === 409) {
        setIsAlreadyEnrolled(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to assign course.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(3,72,82,0.25)",
          backdropFilter: "blur(4px)", zIndex: 50,
        }}
      />
      {/* Modal Wrapper */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(480px, 92vw)",
        zIndex: 51,
      }}>
        {/* Modal Inner */}
        <div style={{
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          opacity: 0,
          transform: "translateY(12px)",
          animation: "floatIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
        }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <p style={labelStyle}>Assign Course</p>
            <h3 style={{ ...titleStyle, fontSize: "18px", margin: "4px 0 2px" }}>
              {student.name}
            </h3>
            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: 0 }}>
              {student.programme_type ?? "No programme"} · {student.email ?? student.roll_number ?? "—"}
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {success ? (
          <div>
            <div style={{
              background: "rgba(10,190,98,0.08)", border: "1px solid rgba(10,190,98,0.25)",
              borderRadius: "12px", padding: "20px", textAlign: "center", marginBottom: "20px",
            }}>
              <p style={{ fontSize: "28px", margin: "0 0 8px" }}>✅</p>
              <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", fontSize: "16px", margin: 0 }}>
                Course assigned successfully
              </p>
            </div>
            <button onClick={onClose} style={{ ...primaryButton, width: "100%" }}>Done</button>
          </div>
        ) : (
          <>
            {/* Search */}
            <input
              type="text"
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: "12px" }}
            />

            {/* Course list */}
            <div style={{
              maxHeight: "240px", overflowY: "auto",
              border: "1px solid rgba(3,72,82,0.1)", borderRadius: "14px",
              marginBottom: "16px",
            }}>
              {coursesLoading ? (
                <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
                  Loading courses…
                </p>
              ) : filtered.length === 0 ? (
                <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
                  {search ? "No courses match your search." : "No active courses available."}
                </p>
              ) : (
                filtered.map((course) => {
                  const active = selectedCourseId === course.id;
                  return (
                    <div
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      style={{
                        padding: "12px 16px",
                        cursor: "pointer",
                        background: active ? "rgba(10,190,98,0.08)" : "transparent",
                        borderLeft: active ? "3px solid #0abe62" : "3px solid transparent",
                        transition: "all 150ms ease",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>
                          {course.title}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                          {course.programme_type} · {course.lesson_count} lesson{course.lesson_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {active && (
                        <span style={{ fontSize: "16px", color: "#0abe62" }}>✓</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {isAlreadyEnrolled && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "8px",
                padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
                background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.4)",
              }}>
                <span style={{ fontSize: "15px", flexShrink: 0 }}>⚠️</span>
                <p style={{ fontSize: "13px", color: "#7a5f00", fontWeight: 600, margin: 0 }}>
                  This student is already enrolled in that course.
                </p>
              </div>
            )}

            {error && (
              <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={onClose} style={{ ...primaryButton, flex: 1, background: "rgba(3,72,82,0.07)", color: "#034852", boxShadow: "none" }}>
                Cancel
              </button>
              <button
                onClick={() => void handleAssign()}
                disabled={!selectedCourseId || submitting}
                style={{ ...primaryButton, flex: 2, opacity: (!selectedCourseId || submitting) ? 0.5 : 1 }}
              >
                {submitting ? "Assigning…" : "Confirm Assignment"}
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
}

// ── Assign Bundle Modal ────────────────────────────────────────

function AssignBundleModal({
  student,
  onClose,
}: {
  student: SafeUser;
  onClose: () => void;
}) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [enrolledBundles, setEnrolledBundles] = useState<Bundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setBundlesLoading(true);
    Promise.all([getBundles(), getBundles(student.id)])
      .then(([all, enrolled]) => {
        setEnrolledBundles(enrolled);
        const enrolledIds = new Set(enrolled.map((b) => b.id));
        setBundles(all.filter((b) => !enrolledIds.has(b.id)));
      })
      .catch(() => { setBundles([]); setEnrolledBundles([]); })
      .finally(() => setBundlesLoading(false));
  }, [student.id]);

  const filtered = bundles.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAssign() {
    if (!selectedBundleId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await enrolStudentInBundle(selectedBundleId, student.id);
      setSuccessMsg(`Enrolled in bundle (${result.courses_enrolled} course${result.courses_enrolled !== 1 ? "s" : ""} assigned).`);
      setSuccess(true);
    } catch (err) {
      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      if (status === 409) {
        setError("Student is already enrolled in this bundle.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to assign bundle.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.25)", backdropFilter: "blur(4px)", zIndex: 50 }}
      />
      {/* Modal wrapper */}
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(500px, 92vw)", zIndex: 51 }}>
        <div style={{
          background: "#ffffff",
          border: "1px solid rgba(255,255,255,0.3)", borderRadius: "24px", padding: "32px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          opacity: 0, transform: "translateY(12px)",
          animation: "floatIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <p style={labelStyle}>Assign Bundle</p>
              <h3 style={{ ...titleStyle, fontSize: "18px", margin: "4px 0 2px" }}>{student.name}</h3>
              <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: 0 }}>
                {student.programme_type ?? "No programme"} · {student.email ?? student.roll_number ?? "—"}
              </p>
            </div>
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </div>

          {success ? (
            <div>
              <div style={{
                background: "rgba(10,190,98,0.08)", border: "1px solid rgba(10,190,98,0.25)",
                borderRadius: "12px", padding: "20px", textAlign: "center", marginBottom: "20px",
              }}>
                <p style={{ fontSize: "28px", margin: "0 0 8px" }}>✅</p>
                <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", fontSize: "16px", margin: 0 }}>
                  Bundle assigned successfully
                </p>
                <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "6px 0 0" }}>{successMsg}</p>
              </div>
              <button onClick={onClose} style={{ ...primaryButton, width: "100%" }}>Done</button>
            </div>
          ) : (
            <>
              {/* Currently enrolled bundles */}
              {enrolledBundles.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <p style={{ ...labelStyle, marginBottom: "8px" }}>Currently enrolled bundles</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {enrolledBundles.map((b) => (
                      <div key={b.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 12px", borderRadius: "10px",
                        background: "rgba(10,190,98,0.06)", border: "1px solid rgba(10,190,98,0.2)",
                      }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{b.name}</p>
                          <p style={{ margin: "1px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                            {b.course_count} course{b.course_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span style={{ fontSize: "13px", color: "#0abe62", fontWeight: 700 }}>✓ Enrolled</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: "1px", background: "rgba(3,72,82,0.08)", margin: "16px 0" }} />
                </div>
              )}

              {/* Bundle search */}
              <input
                type="text"
                autoFocus={enrolledBundles.length === 0}
                placeholder="Search bundles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: "12px" }}
              />

              {/* Bundle list */}
              <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "14px", marginBottom: "16px" }}>
                {bundlesLoading ? (
                  <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading bundles…</p>
                ) : filtered.length === 0 ? (
                  <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
                    {search ? "No bundles match your search." : "No bundles available to assign."}
                  </p>
                ) : (
                  filtered.map((bundle) => {
                    const active = selectedBundleId === bundle.id;
                    return (
                      <div
                        key={bundle.id}
                        onClick={() => { setSelectedBundleId(bundle.id); setError(null); }}
                        style={{
                          padding: "12px 16px", cursor: "pointer",
                          background: active ? "rgba(10,190,98,0.08)" : "transparent",
                          borderLeft: active ? "3px solid #0abe62" : "3px solid transparent",
                          transition: "all 150ms ease",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{bundle.name}</p>
                          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                            {bundle.course_count} course{bundle.course_count !== 1 ? "s" : ""} · {bundle.student_count} student{bundle.student_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {active && <span style={{ fontSize: "16px", color: "#0abe62" }}>✓</span>}
                      </div>
                    );
                  })
                )}
              </div>

              {error && (
                <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "12px" }}>{error}</p>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={onClose} style={{ ...primaryButton, flex: 1, background: "rgba(3,72,82,0.07)", color: "#034852", boxShadow: "none" }}>
                  Cancel
                </button>
                <button
                  onClick={() => void handleAssign()}
                  disabled={!selectedBundleId || submitting}
                  style={{ ...primaryButton, flex: 2, opacity: (!selectedBundleId || submitting) ? 0.5 : 1 }}
                >
                  {submitting ? "Assigning…" : "Confirm Assignment"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Bulk Assign Panel ──────────────────────────────────────────

const BULK_STATES = [
  { value: "TAMIL_NADU",    label: "Tamil Nadu" },
  { value: "CHHATTISGARH", label: "Chhattisgarh" },
  { value: "KERALA",        label: "Kerala" },
];

function BulkAssignPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  // Filters
  const [filterState,    setFilterState]    = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterSchool,   setFilterSchool]   = useState("");
  const [filterProg,     setFilterProg]     = useState("");
  const [filterSearch,   setFilterSearch]   = useState("");

  // Results + selections
  const [students,    setStudents]    = useState<StudentForBulk[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [searchErr,   setSearchErr]   = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Step 2 — multi-select courses + bundles
  const [courses,           setCourses]           = useState<Course[]>([]);
  const [bundles,           setBundles]           = useState<Bundle[]>([]);
  const [courseSearch,      setCourseSearch]      = useState("");
  const [bundleSearch,      setBundleSearch]      = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(new Set());

  // Step 3
  const [showConfirm, setShowConfirm] = useState(false);
  const [assigning,   setAssigning]   = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  // Load courses + bundles on mount
  useEffect(() => {
    getCourses(undefined, undefined, undefined, true).then(setCourses).catch(() => {});
    getBundles().then(setBundles).catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSearch() {
    setSearching(true);
    setSearchErr(null);
    setSelectedIds(new Set());
    try {
      const results = await getStudentsForBulk({
        state:          filterState    || undefined,
        district:       filterDistrict || undefined,
        school_id:      filterSchool   || undefined,
        programme_type: filterProg     || undefined,
        search:         filterSearch   || undefined,
      });
      setStudents(results);
      setHasSearched(true);
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(
      selectedIds.size === students.length
        ? new Set()
        : new Set(students.map((s) => s.id))
    );
  }

  function toggleCourse(id: string) {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBundle(id: string) {
    setSelectedBundleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign() {
    setAssigning(true);
    try {
      const result = await bulkEnrol({
        student_ids: Array.from(selectedIds),
        course_ids:  Array.from(selectedCourseIds),
        bundle_ids:  Array.from(selectedBundleIds),
      });
      setShowConfirm(false);
      const nC = selectedCourseIds.size;
      const nB = selectedBundleIds.size;
      const nS = selectedIds.size;
      const parts: string[] = [];
      if (nC > 0) parts.push(`${nC} course${nC !== 1 ? "s" : ""}`);
      if (nB > 0) parts.push(`${nB} bundle${nB !== 1 ? "s" : ""}`);
      setToast({
        msg: `Done. Assigned ${parts.join(" and ")} to ${nS} student${nS !== 1 ? "s" : ""}. ${result.skipped} already enrolled, skipped.`,
        ok: true,
      });
      setSelectedIds(new Set());
      setSelectedCourseIds(new Set());
      setSelectedBundleIds(new Set());
    } catch (e) {
      setShowConfirm(false);
      setToast({ msg: e instanceof Error ? e.message : "Assignment failed.", ok: false });
    } finally {
      setAssigning(false);
    }
  }

  const selectedCount    = selectedIds.size;
  const allSelected      = students.length > 0 && selectedIds.size === students.length;
  const someSelected     = selectedIds.size > 0 && selectedIds.size < students.length;
  const filteredCourses  = courses.filter((c) => c.title.toLowerCase().includes(courseSearch.toLowerCase()));
  const filteredBundles  = bundles.filter((b) => b.name.toLowerCase().includes(bundleSearch.toLowerCase()));
  const selectedCourses  = courses.filter((c) => selectedCourseIds.has(c.id));
  const selectedBundles  = bundles.filter((b) => selectedBundleIds.has(b.id));
  const canAssign        = selectedCount > 0 && (selectedCourseIds.size > 0 || selectedBundleIds.size > 0);
  const selectionSummary = (() => {
    const parts: string[] = [];
    if (selectedCourseIds.size > 0) parts.push(`${selectedCourseIds.size} course${selectedCourseIds.size !== 1 ? "s" : ""}`);
    if (selectedBundleIds.size > 0) parts.push(`${selectedBundleIds.size} bundle${selectedBundleIds.size !== 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") + " selected" : null;
  })();

  return (
    <div style={{ ...glassCard, textAlign: "left", marginBottom: "24px", animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards", opacity: 0, transform: "translateY(12px)", position: "relative" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "absolute", top: "16px", right: "56px",
          padding: "10px 16px", borderRadius: "10px",
          background: toast.ok ? "#034852" : "#c53030",
          color: "#fff", fontSize: "13px", fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: 10,
          maxWidth: "380px", lineHeight: 1.5,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={labelStyle}>Bulk Assign — Filter Students &amp; Assign</p>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px", marginBottom: "14px" }}>
        <div>
          <label style={formLabelStyle}>State</label>
          <select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={inputStyle}>
            <option value="">All States</option>
            {BULK_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={formLabelStyle}>District</label>
          <input type="text" placeholder="e.g. Chennai" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && void handleSearch()} />
        </div>
        <div>
          <label style={formLabelStyle}>School</label>
          <input type="text" placeholder="School name" value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && void handleSearch()} />
        </div>
        <div>
          <label style={formLabelStyle}>Programme</label>
          <select value={filterProg} onChange={(e) => setFilterProg(e.target.value)} style={inputStyle}>
            <option value="">All</option>
            <option value="UG">UG</option>
            <option value="PG">PG</option>
          </select>
        </div>
        <div>
          <label style={formLabelStyle}>Search</label>
          <input type="text" placeholder="Name or roll number" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && void handleSearch()} />
        </div>
      </div>

      <button
        onClick={() => void handleSearch()}
        disabled={searching}
        style={{ ...primaryButton, fontSize: "13px", padding: "10px 22px", opacity: searching ? 0.7 : 1, cursor: searching ? "not-allowed" : "pointer" }}
      >
        {searching ? "Searching…" : "Search Students"}
      </button>

      {/* ── Search error ────────────────────────────────────── */}
      {searchErr && (
        <p style={{ marginTop: "12px", fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{searchErr}</p>
      )}

      {/* ── Results table ────────────────────────────────────── */}
      {hasSearched && !searchErr && (
        <div style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                style={{ accentColor: "#0abe62", width: "15px", height: "15px" }}
              />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#034852" }}>
                {students.length === 0 ? "No students found" : `${selectedCount} of ${students.length} selected`}
              </span>
            </label>
          </div>

          {students.length > 0 && (
            <div style={{ border: "1px solid rgba(3,72,82,0.1)", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: "var(--font-body)" }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr style={{ background: "rgba(3,72,82,0.05)", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
                      <th style={{ ...thStyle, width: "40px" }}></th>
                      {["Name", "Roll Number", "Programme", "State", "District", "School"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => {
                      const checked = selectedIds.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => toggleStudent(s.id)}
                          style={{
                            borderTop: i > 0 ? "1px solid rgba(3,72,82,0.05)" : "none",
                            background: checked ? "rgba(10,190,98,0.05)" : "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <td style={{ ...tdStyle, textAlign: "center", width: "40px" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStudent(s.id)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ accentColor: "#0abe62", width: "14px", height: "14px" }}
                            />
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: "#034852" }}>{s.name}</td>
                          <td style={{ ...tdStyle, fontFamily: "monospace", color: "rgba(3,72,82,0.6)" }}>{s.roll_number ?? "—"}</td>
                          <td style={tdStyle}>
                            {s.programme_type ? (
                              <span style={{ padding: "2px 7px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, background: "rgba(32,147,121,0.1)", color: "#209379" }}>
                                {s.programme_type}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={tdStyle}>{s.state ?? "—"}</td>
                          <td style={tdStyle}>{s.district ?? "—"}</td>
                          <td style={{ ...tdStyle, color: "rgba(3,72,82,0.6)" }}>{s.school_name ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Assign section ───────────────────────────────────── */}
      {selectedCount > 0 && (
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(3,72,82,0.08)" }}>
          <p style={{ ...labelStyle, marginBottom: "16px" }}>
            Assign to {selectedCount} student{selectedCount !== 1 ? "s" : ""}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

            {/* Courses column */}
            <div>
              <p style={{ ...formLabelStyle, marginBottom: "6px" }}>Courses</p>
              <input type="text" placeholder="Search courses…" value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: "6px" }} />
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "10px" }}>
                {filteredCourses.length === 0 ? (
                  <p style={{ padding: "12px", margin: 0, color: "rgba(3,72,82,0.45)", fontSize: "12px" }}>
                    {courseSearch ? "No matches." : "No active courses."}
                  </p>
                ) : filteredCourses.map((c) => {
                  const checked = selectedCourseIds.has(c.id);
                  return (
                    <label key={c.id} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "8px 10px", cursor: "pointer",
                      borderBottom: "1px solid rgba(3,72,82,0.04)",
                      background: checked ? "rgba(10,190,98,0.06)" : "transparent",
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCourse(c.id)}
                        style={{ accentColor: "#0abe62", width: "13px", height: "13px", flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: "#034852", fontSize: "12px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                        <span style={{ fontSize: "10px", color: "rgba(3,72,82,0.5)" }}>{c.programme_type} · {c.lesson_count} lesson{c.lesson_count !== 1 ? "s" : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {selectedCourses.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                  {selectedCourses.map((c) => (
                    <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px 3px 9px", borderRadius: "100px", background: "rgba(10,190,98,0.1)", border: "1px solid rgba(10,190,98,0.25)", fontSize: "11px", fontWeight: 600, color: "#034852" }}>
                      {c.title}
                      <button onClick={() => toggleCourse(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)", fontSize: "13px", lineHeight: 1, padding: "0 1px", fontWeight: 700 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bundles column */}
            <div>
              <p style={{ ...formLabelStyle, marginBottom: "6px" }}>Bundles</p>
              <input type="text" placeholder="Search bundles…" value={bundleSearch}
                onChange={(e) => setBundleSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: "6px" }} />
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "10px" }}>
                {filteredBundles.length === 0 ? (
                  <p style={{ padding: "12px", margin: 0, color: "rgba(3,72,82,0.45)", fontSize: "12px" }}>
                    {bundleSearch ? "No matches." : "No bundles available."}
                  </p>
                ) : filteredBundles.map((b) => {
                  const checked = selectedBundleIds.has(b.id);
                  return (
                    <label key={b.id} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "8px 10px", cursor: "pointer",
                      borderBottom: "1px solid rgba(3,72,82,0.04)",
                      background: checked ? "rgba(10,190,98,0.06)" : "transparent",
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleBundle(b.id)}
                        style={{ accentColor: "#0abe62", width: "13px", height: "13px", flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: "#034852", fontSize: "12px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                        <span style={{ fontSize: "10px", color: "rgba(3,72,82,0.5)" }}>{b.course_count} course{b.course_count !== 1 ? "s" : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {selectedBundles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                  {selectedBundles.map((b) => (
                    <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px 3px 9px", borderRadius: "100px", background: "rgba(3,72,82,0.07)", border: "1px solid rgba(3,72,82,0.15)", fontSize: "11px", fontWeight: 600, color: "#034852" }}>
                      {b.name}
                      <button onClick={() => toggleBundle(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)", fontSize: "13px", lineHeight: 1, padding: "0 1px", fontWeight: 700 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            {selectionSummary && (
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#209379" }}>{selectionSummary}</span>
            )}
            <button onClick={() => setShowConfirm(true)} disabled={!canAssign}
              style={{ ...primaryButton, opacity: canAssign ? 1 : 0.45, cursor: canAssign ? "pointer" : "not-allowed" }}>
              Assign →
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmation modal ───────────────────────────────── */}
      {showConfirm && (
        <>
          <div onClick={() => !assigning && setShowConfirm(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.3)", backdropFilter: "blur(4px)", zIndex: 50 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(480px,92vw)", zIndex: 51 }}>
            <div style={{ background: "#fff", borderRadius: "20px", padding: "32px", boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}>
              <p style={labelStyle}>Confirm Assignment</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "rgba(3,72,82,0.7)", margin: "12px 0 6px" }}>
                You are about to assign:
              </p>
              {selectedCourses.length > 0 && (
                <ul style={{ margin: "0 0 6px", paddingLeft: "18px", fontFamily: "var(--font-body)", fontSize: "13px", color: "#034852" }}>
                  {selectedCourses.map((c) => <li key={c.id} style={{ fontWeight: 600 }}>{c.title}</li>)}
                </ul>
              )}
              {selectedBundles.length > 0 && (
                <ul style={{ margin: "0 0 10px", paddingLeft: "18px", fontFamily: "var(--font-body)", fontSize: "13px", color: "#034852" }}>
                  {selectedBundles.map((b) => <li key={b.id}><span style={{ fontWeight: 600 }}>{b.name}</span> <span style={{ color: "rgba(3,72,82,0.45)", fontWeight: 400 }}>(bundle)</span></li>)}
                </ul>
              )}
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "rgba(3,72,82,0.7)", margin: "0 0 20px" }}>
                to <strong style={{ color: "#034852" }}>{selectedCount} student{selectedCount !== 1 ? "s" : ""}</strong>. Already enrolled will be skipped. Continue?
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => !assigning && setShowConfirm(false)} disabled={assigning}
                  style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.2)", background: "transparent", color: "#034852", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "13px", cursor: assigning ? "not-allowed" : "pointer", opacity: assigning ? 0.5 : 1 }}>
                  Cancel
                </button>
                <button onClick={() => void handleAssign()} disabled={assigning}
                  style={{ ...primaryButton, opacity: assigning ? 0.7 : 1, cursor: assigning ? "not-allowed" : "pointer" }}>
                  {assigning ? "Assigning…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Bulk Upload Panel ──────────────────────────────────────────

// Human-readable labels for CSV column names
const CSV_FIELD_LABELS: Record<string, string> = {
  name:           "Full Name",
  email:          "Email",
  role:           "Role",
  programme_type: "Programme Type",
  state:          "State",
  district:       "District",
  school_name:    "School",
  school_code:    "School Code",
  roll_number:    "Roll Number",
  phone:          "Phone",
  password:       "Password",
};

const ROLE_OPTIONS = [
  "STUDENT", "FELLOW", "PROGRAM_MANAGER", "ZONAL_MANAGER",
  "SUPER_ADMIN", "GOVERNMENT", "FUNDING_PARTNER",
];

// Returns the display names of required fields that are missing for a row.
function getMissingFields(row: Record<string, string>): string[] {
  const role    = (row.role           ?? "").trim().toUpperCase();
  const prog    = (row.programme_type ?? "").trim().toUpperCase();
  const isUgStu = role === "STUDENT" && prog === "UG";
  const missing: string[] = [];

  // Base — required for every role
  if (!row.name?.trim())             missing.push("Full Name");
  if (!isUgStu && !row.email?.trim()) missing.push("Email");
  if (!row.role?.trim())             missing.push("Role");

  // Role-specific extras
  if (role === "STUDENT") {
    if (!row.programme_type?.trim()) missing.push("Programme Type");
    if (!row.state?.trim())          missing.push("State");
    if (!row.school_name?.trim())    missing.push("School");
  } else if (role === "FELLOW") {
    if (!row.programme_type?.trim()) missing.push("Programme Type");
    if (!row.state?.trim())          missing.push("State");
    if (!row.district?.trim())       missing.push("District");
    if (!row.school_name?.trim())    missing.push("School");
  } else if (role === "PROGRAM_MANAGER" || role === "ZONAL_MANAGER") {
    if (!row.state?.trim())          missing.push("State");
  }

  return missing;
}

// Returns true if this specific CSV column is required for the row's role.
function isCellRequired(row: Record<string, string>, col: string): boolean {
  const role = (row.role           ?? "").trim().toUpperCase();
  const prog = (row.programme_type ?? "").trim().toUpperCase();
  const isUgStu = role === "STUDENT" && prog === "UG";

  if (col === "name")           return true;
  if (col === "email")          return !isUgStu;
  if (col === "role")           return true;
  if (col === "programme_type") return role === "STUDENT" || role === "FELLOW";
  if (col === "state")          return role === "STUDENT" || role === "FELLOW" || role === "PROGRAM_MANAGER" || role === "ZONAL_MANAGER";
  if (col === "school_name")    return role === "STUDENT" || role === "FELLOW";
  if (col === "district")       return role === "FELLOW";
  return false;
}

// Minimal CSV value escaper
function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function BulkUploadPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file,         setFile]         = useState<File | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [result,       setResult]       = useState<{ created: number; skipped: number; errors: string[]; credentials?: Array<{ name: string; rollNumber: string; tempPassword?: string }> } | null>(null);
  const [templateRole, setTemplateRole] = useState<string>("COMMON");
  const [parseError,   setParseError]   = useState<string | null>(null);
  const [csvHeaders,   setCsvHeaders]   = useState<string[]>([]);
  const [editableRows, setEditableRows] = useState<Array<Record<string, string>>>([]);

  // Parse CSV when file changes
  useEffect(() => {
    if (!file) {
      setCsvHeaders([]);
      setEditableRows([]);
      setParseError(null);
      return;
    }
    let cancelled = false;
    setCsvHeaders([]);
    setEditableRows([]);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled) return;
      const text = typeof reader.result === "string" ? reader.result : "";
      try {
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          preview: 500,
          skipEmptyLines: true,
          transform: (v) => (typeof v === "string" ? v.trim() : String(v ?? "")),
        });
        if (parsed.errors?.length) {
          setParseError(parsed.errors[0].message || "Invalid CSV format.");
          return;
        }
        const hdrs = (parsed.meta.fields ?? []).filter(Boolean);
        const rows = (parsed.data ?? []).filter((r) => r && Object.keys(r).length > 0);
        if (!hdrs.length) {
          setParseError("Could not detect CSV headers. Please use the downloaded template.");
          return;
        }
        setCsvHeaders(hdrs);
        setEditableRows(rows);
      } catch {
        setParseError("Failed to parse CSV. Please use the downloaded template.");
      }
    };
    reader.onerror = () => { if (!cancelled) setParseError("Could not read the file."); };
    reader.readAsText(file);
    return () => { cancelled = true; };
  }, [file]);

  // Update a single cell
  function updateCell(rowIdx: number, col: string, value: string) {
    setEditableRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [col]: value };
      return next;
    });
  }

  // Reconstruct CSV from edited rows and upload
  async function doUpload(rowsToUpload: Array<Record<string, string>>) {
    if (!rowsToUpload.length) return;
    setUploading(true);
    try {
      const csvContent = [
        csvHeaders.join(","),
        ...rowsToUpload.map((row) => csvHeaders.map((h) => csvEscape(row[h] ?? "")).join(",")),
      ].join("\n");
      const blob    = new Blob([csvContent], { type: "text/csv" });
      const newFile = new File([blob], file?.name ?? "upload.csv", { type: "text/csv" });
      const res     = await bulkUploadUsers(newFile);
      setResult(res);
      onDone();
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : "Upload failed."] });
    } finally {
      setUploading(false);
    }
  }

  function downloadCredentials() {
    if (!result?.credentials?.length) return;
    const csvContent = "Name,Roll Number,Temporary Password\n" +
      result.credentials.map((c) => `"${c.name}","${c.rollNumber}","${c.tempPassword ?? ""}"`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "opengrad_ug_credentials.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Per-row validation (recomputed on every render — instant, no state needed)
  const rowErrors  = editableRows.map((row) => getMissingFields(row));
  const readyCount = rowErrors.filter((e) => e.length === 0).length;
  const errorCount = rowErrors.filter((e) => e.length  > 0).length;
  const readyRows  = editableRows.filter((_, i) => rowErrors[i].length === 0);
  const hasData    = csvHeaders.length > 0 && editableRows.length > 0;

  return (
    <div style={{ ...glassCard, textAlign: "left", marginBottom: "24px", animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards", opacity: 0, transform: "translateY(12px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={labelStyle}>Bulk Upload Users</p>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* Template download */}
      <a
        href={getUserTemplateUrl(templateRole === "COMMON" ? undefined : templateRole)}
        download={templateRole === "COMMON" ? "opengrad_users_template_common.csv" : `opengrad_users_template_${templateRole.toLowerCase()}.csv`}
        id="download-template-btn"
        style={{ ...primaryButton, display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", fontSize: "12px", padding: "10px 20px", background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)" }}
      >
        ↓ Download Template CSV
      </a>

      <div style={{ marginTop: "14px" }}>
        <label style={formLabelStyle}>Template Type</label>
        <select id="bulk-template-role" value={templateRole} onChange={(e) => setTemplateRole(e.target.value)} style={inputStyle}>
          <option value="COMMON">Common (all roles)</option>
          {ALL_ROLES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.55)", lineHeight: 1.5 }}>
          Role templates hide irrelevant columns, but uploads can still mix roles as long as each row includes a valid <strong>role</strong>.
        </p>
      </div>

      {/* File input */}
      <div style={{ marginTop: "20px" }}>
        <label style={formLabelStyle}>Upload CSV File</label>
        <input
          id="bulk-csv-input"
          type="file"
          accept=".csv"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          style={{ ...inputStyle, padding: "10px" }}
        />
      </div>

      {/* Parse error */}
      {parseError && (
        <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(229,62,62,0.06)", border: "1px solid rgba(229,62,62,0.2)", fontSize: "12px", fontWeight: 600, color: "#c53030" }}>
          {parseError}
        </div>
      )}

      {/* ── Editable preview ─────────────────────────────── */}
      {hasData && (
        <div style={{ marginTop: "20px" }}>
          <p style={formLabelStyle}>Preview &amp; Edit</p>

          {/* Summary bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
            padding: "12px 16px", borderRadius: "12px", marginBottom: "12px",
            background: errorCount > 0 ? "rgba(229,62,62,0.05)" : "rgba(10,190,98,0.06)",
            border: `1px solid ${errorCount > 0 ? "rgba(229,62,62,0.2)" : "rgba(10,190,98,0.2)"}`,
          }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0abe62" }}>
              ✓ {readyCount} row{readyCount !== 1 ? "s" : ""} ready
            </span>
            {errorCount > 0 && (
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#e53e3e" }}>
                ✗ {errorCount} row{errorCount !== 1 ? "s" : ""} have errors
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
              {errorCount > 0 ? (
                <>
                  <button
                    id="bulk-submit-btn"
                    onClick={() => void doUpload(readyRows)}
                    disabled={uploading || readyCount === 0}
                    style={{ ...primaryButton, padding: "8px 16px", fontSize: "12px", opacity: uploading || readyCount === 0 ? 0.5 : 1, cursor: uploading || readyCount === 0 ? "not-allowed" : "pointer" }}
                  >
                    {uploading ? "Uploading…" : `Import Ready Rows (${readyCount})`}
                  </button>
                  <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)", whiteSpace: "nowrap" }}>
                    Fix all errors to import all
                  </span>
                </>
              ) : (
                <button
                  id="bulk-submit-btn"
                  onClick={() => void doUpload(editableRows)}
                  disabled={uploading}
                  style={{ ...primaryButton, padding: "8px 16px", fontSize: "12px", opacity: uploading ? 0.5 : 1, cursor: uploading ? "not-allowed" : "pointer" }}
                >
                  {uploading ? "Uploading…" : `Import All (${editableRows.length})`}
                </button>
              )}
            </div>
          </div>

          {/* Editable table */}
          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.10)", background: "rgba(255,255,255,0.55)", maxHeight: "400px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "12px", minWidth: "900px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr style={{ background: "rgba(3,72,82,0.07)", textAlign: "left" }}>
                  {/* Status */}
                  <th style={{ padding: "9px 10px", width: "32px", borderBottom: "1px solid rgba(3,72,82,0.08)" }} />
                  {csvHeaders.map((h) => (
                    <th key={h} style={{ padding: "9px 10px", borderBottom: "1px solid rgba(3,72,82,0.08)", color: "rgba(3,72,82,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "10px", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {CSV_FIELD_LABELS[h] ?? h}
                      {/* Mark columns that can be required with a subtle indicator */}
                    </th>
                  ))}
                  {/* Errors */}
                  <th style={{ padding: "9px 10px", borderBottom: "1px solid rgba(3,72,82,0.08)", color: "rgba(3,72,82,0.5)", fontSize: "10px", whiteSpace: "nowrap", minWidth: "120px" }}>
                    ERRORS
                  </th>
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row, rowIdx) => {
                  const missing  = rowErrors[rowIdx];
                  const hasError = missing.length > 0;
                  return (
                    <tr key={rowIdx} style={{ borderBottom: "1px solid rgba(3,72,82,0.06)", background: hasError ? "rgba(229,62,62,0.02)" : "transparent" }}>
                      {/* Row status icon */}
                      <td style={{ padding: "6px 8px", textAlign: "center", verticalAlign: "middle" }}>
                        <span title={hasError ? `Missing: ${missing.join(", ")}` : "Row is valid"} style={{ fontSize: "13px", cursor: "default" }}>
                          {hasError ? "⚠️" : "✅"}
                        </span>
                      </td>

                      {/* Data cells */}
                      {csvHeaders.map((col) => {
                        const val        = row[col] ?? "";
                        const required   = isCellRequired(row, col);
                        const cellErr    = required && !val.trim();
                        const isDropRole = col === "role";
                        const isDropProg = col === "programme_type";
                        const tooltipMsg = cellErr ? `Required for ${(row.role ?? "this role").toUpperCase() || "all roles"}` : undefined;

                        const cellBase: React.CSSProperties = {
                          padding: "4px 6px",
                          verticalAlign: "middle",
                          borderBottom: "none",
                        };

                        const controlBase: React.CSSProperties = {
                          width: "100%",
                          padding: "5px 7px",
                          borderRadius: "6px",
                          fontFamily: "var(--font-body)",
                          fontSize: "12px",
                          color: "#034852",
                          background: cellErr ? "rgba(229,62,62,0.04)" : "transparent",
                          border: cellErr ? "1.5px solid #e53e3e" : "1px solid transparent",
                          outline: "none",
                          boxSizing: "border-box" as const,
                          minWidth: isDropRole ? "160px" : isDropProg ? "100px" : "90px",
                          cursor: "text",
                        };

                        return (
                          <td key={col} style={cellBase} title={tooltipMsg}>
                            {isDropRole ? (
                              <select
                                value={val}
                                onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                style={{ ...controlBase, cursor: "pointer" }}
                              >
                                <option value="">—</option>
                                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : isDropProg ? (
                              <select
                                value={val}
                                onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                style={{ ...controlBase, cursor: "pointer", minWidth: "80px" }}
                              >
                                <option value="">—</option>
                                <option value="UG">UG</option>
                                <option value="PG">PG</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={val}
                                onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                style={controlBase}
                                placeholder={cellErr ? "Required" : ""}
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Error summary cell */}
                      <td style={{ padding: "6px 10px", verticalAlign: "middle", minWidth: "120px" }}>
                        {missing.length > 0 && (
                          <span style={{ fontSize: "11px", color: "#e53e3e", fontWeight: 600, lineHeight: 1.4, display: "block" }}>
                            Missing: {missing.join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.45)" }}>
            {editableRows.length} row{editableRows.length !== 1 ? "s" : ""} loaded. Click any cell to edit. Dropdowns for Role and Programme Type.
          </p>
        </div>
      )}

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
          {result.credentials?.some((c) => c.tempPassword) && (
            <div style={{ marginTop: "16px", padding: "12px", background: "rgba(10,190,98,0.08)", borderRadius: "8px" }}>
              <p style={{ fontSize: "13px", color: "#034852", marginBottom: "8px", fontWeight: 600 }}>
                Some UG students were created with temporary passwords.
              </p>
              <button
                onClick={downloadCredentials}
                style={{ ...primaryButton, padding: "8px 16px", fontSize: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)" }}
              >
                ↓ Download Credentials CSV
              </button>
            </div>
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
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "24px",
  padding: "32px",
  textAlign: "center",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
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
