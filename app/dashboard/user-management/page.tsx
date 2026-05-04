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
  type SafeUser,
  type Course,
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
  const [assignStudent, setAssignStudent] = useState<SafeUser | null>(null);
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

      {/* ── Assign Course Modal ───────────────────────────── */}
      {assignStudent && (
        <AssignCourseModal
          student={assignStudent}
          assignedBy={currentUserId}
          onClose={() => setAssignStudent(null)}
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
                  {["Name", "Email", "Role", "Programme", "Status", "Created", "Actions"].map((h) => (
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
                    <td style={tdStyle}>
                      {u.role === "STUDENT" && (
                        <button
                          onClick={() => setAssignStudent(u)}
                          style={{
                            padding: "5px 12px", border: "1.5px solid rgba(10,190,98,0.4)",
                            borderRadius: "8px", background: "transparent",
                            color: "#0abe62", fontFamily: "var(--font-body)",
                            fontSize: "11px", fontWeight: 700, cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Assign Course
                        </button>
                      )}
                    </td>
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
                        <input id="user-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={inputStyle} placeholder="School name (optional)" />
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
                        <input id="user-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={inputStyle} placeholder="School name (optional)" />
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
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.18)",
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

// ── Bulk Upload Panel ──────────────────────────────────────────

function BulkUploadPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[]; credentials?: Array<{ name: string; rollNumber: string; tempPassword?: string }> } | null>(null);
  const [templateRole, setTemplateRole] = useState<string>("COMMON");
  const [preview, setPreview] = useState<{ headers: string[]; rows: Array<Record<string, string>> } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreview(null);
    setPreviewError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled) return;
      const text = typeof reader.result === "string" ? reader.result : "";
      try {
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          preview: 50,
          skipEmptyLines: true,
          transform: (v) => (typeof v === "string" ? v.trim() : String(v ?? "")),
        });

        if (parsed.errors && parsed.errors.length > 0) {
          const first = parsed.errors[0];
          setPreviewError(first.message || "Invalid CSV format.");
          return;
        }

        const headers = (parsed.meta.fields ?? []).filter(Boolean);
        const rows = (parsed.data ?? []).filter((r) => r && Object.keys(r).length > 0);

        if (headers.length === 0) {
          setPreviewError("Could not detect CSV headers. Please use the downloaded template.");
          return;
        }

        setPreview({ headers, rows: rows.slice(0, 25) });
      } catch {
        setPreviewError("Failed to parse CSV. Please use the downloaded template.");
      }
    };
    reader.onerror = () => {
      if (cancelled) return;
      setPreviewError("Could not read the file.");
    };

    reader.readAsText(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

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

  function downloadCredentials() {
    if (!result?.credentials || result.credentials.length === 0) return;
    const csvContent = "Name,Roll Number,Temporary Password\n" + 
      result.credentials.map(c => `"${c.name}","${c.rollNumber}","${c.tempPassword || ''}"`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opengrad_ug_credentials.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ ...glassCard, textAlign: "left", marginBottom: "24px", animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards", opacity: 0, transform: "translateY(12px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={labelStyle}>Bulk Upload Users</p>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* Template download */}
      <a
        href={getUserTemplateUrl(templateRole === "COMMON" ? undefined : templateRole)}
        download={
          templateRole === "COMMON"
            ? "opengrad_users_template_common.csv"
            : `opengrad_users_template_${templateRole.toLowerCase()}.csv`
        }
        id="download-template-btn"
        style={{ ...primaryButton, display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", fontSize: "12px", padding: "10px 20px", background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)" }}
      >
        ↓ Download Template CSV
      </a>

      <div style={{ marginTop: "14px" }}>
        <label style={formLabelStyle}>Template Type</label>
        <select
          id="bulk-template-role"
          value={templateRole}
          onChange={(e) => setTemplateRole(e.target.value)}
          style={inputStyle}
        >
          <option value="COMMON">Common (all roles)</option>
          {ALL_ROLES.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
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
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ ...inputStyle, padding: "10px" }}
        />
      </div>

      {/* Preview */}
      {(previewError || preview) && (
        <div style={{ marginTop: "14px" }}>
          <p style={formLabelStyle}>Preview</p>
          {previewError ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(3,72,82,0.06)",
                border: "1px solid rgba(3,72,82,0.14)",
                color: "#034852",
                fontSize: "12px",
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {previewError}
            </div>
          ) : (
            <div
              style={{
                maxHeight: "190px",
                overflow: "auto",
                borderRadius: "12px",
                border: "1px solid rgba(3,72,82,0.10)",
                background: "rgba(255,255,255,0.55)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  minWidth: "720px",
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(3,72,82,0.06)", textAlign: "left" }}>
                    {preview!.headers.slice(0, 10).map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(3,72,82,0.08)",
                          color: "rgba(3,72,82,0.75)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          fontSize: "10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    {preview!.headers.length > 10 && (
                      <th
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(3,72,82,0.08)",
                          color: "rgba(3,72,82,0.45)",
                          fontSize: "10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        +{preview!.headers.length - 10} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview!.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.min(preview!.headers.length, 11)}
                        style={{ padding: "12px", color: "rgba(3,72,82,0.6)" }}
                      >
                        No data rows detected.
                      </td>
                    </tr>
                  ) : (
                    preview!.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.65)" : "rgba(3,72,82,0.03)" }}
                      >
                        {preview!.headers.slice(0, 10).map((h) => (
                          <td
                            key={h}
                            style={{
                              padding: "9px 10px",
                              borderBottom: "1px solid rgba(3,72,82,0.06)",
                              color: "#034852",
                              maxWidth: "240px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={(row?.[h] ?? "").toString()}
                          >
                            {(row?.[h] ?? "").toString()}
                          </td>
                        ))}
                        {preview!.headers.length > 10 && (
                          <td
                            style={{
                              padding: "9px 10px",
                              borderBottom: "1px solid rgba(3,72,82,0.06)",
                              color: "rgba(3,72,82,0.45)",
                              fontSize: "11px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            …
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {preview && (
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.55)", lineHeight: 1.5 }}>
              Showing {preview.rows.length} row{preview.rows.length !== 1 ? "s" : ""} and up to 10 columns.
            </p>
          )}
        </div>
      )}

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
          {result.credentials && result.credentials.some(c => c.tempPassword) && (
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
