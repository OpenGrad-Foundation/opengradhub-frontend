"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getBundleById,
  addCourseToBundle,
  removeCourseFromBundle,
  reorderBundleCourses,
  enrolStudentInBundle,
  getCourses,
  getUsers,
  type BundleDetail,
  type BundleCourse,
  type BundleEnrolledStudent,
  type Course,
  type SafeUser,
} from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

const ALLOWED: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BundleDetailPage() {
  const { id: bundleId } = useParams<{ id: string }>();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const roleCode  = (userData?.role?.code ?? "") as RoleCode;
  const callerId  = userData?.user?.id ?? "";

  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Modal toggles
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [assignStudentOpen, setAssignStudentOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const reload = useCallback(async () => {
    try {
      const b = await getBundleById(bundleId);
      setBundle(b);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to load bundle.");
    }
  }, [bundleId]);

  useEffect(() => {
    if (userLoading) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [userLoading, reload]);

  if (userLoading || loading) return <Shell><LoadingCard /></Shell>;
  if (!ALLOWED.includes(roleCode)) {
    return (
      <Shell>
        <div style={glassCard}>
          <p style={labelSt}>Access Denied</p>
          <p style={{ ...headingSt, marginTop: "12px", fontSize: "18px" }}>
            Only Super Admins and Program Managers can manage bundles.
          </p>
        </div>
      </Shell>
    );
  }
  if (!bundle) {
    return <Shell><div style={glassCard}><p style={{ color: "#e53e3e", fontWeight: 600 }}>{globalError ?? "Bundle not found."}</p></div></Shell>;
  }

  return (
    <Shell>
      {/* ── Header ───────────────────────────────────────────── */}
      <Link href="/dashboard/bundles" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← Back to Bundles
      </Link>
      <div style={{ margin: "16px 0 28px" }}>
        <p style={labelSt}>Bundle</p>
        <h1 style={{ ...headingSt, fontSize: "26px", margin: "4px 0 0" }}>{bundle.name}</h1>
        {bundle.description && (
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "6px" }}>{bundle.description}</p>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <Chip icon="📚" value={bundle.courses.length} label="course" />
          <Chip icon="👤" value={bundle.enrolled_students.length} label="student" />
        </div>
      </div>

      {globalError && <div style={{ ...errorBox, marginBottom: "20px" }}>{globalError}</div>}

      {/* ── Section 1: Courses ───────────────────────────────── */}
      <Section
        title="Courses in this Bundle"
        subtitle="Drag to reorder. Students enrolled in this bundle are automatically given access to all courses here."
        action={
          <button onClick={() => setAddCourseOpen(true)} style={primaryBtn}>
            + Add Course
          </button>
        }
      >
        <CourseList
          bundleId={bundleId}
          courses={bundle.courses}
          callerId={callerId}
          callerRole={roleCode}
          studentCount={bundle.enrolled_students.length}
          onRemoved={() => { void reload(); }}
          onReordered={() => { void reload(); }}
          setGlobalError={setGlobalError}
        />
      </Section>

      {/* ── Section 2: Students ──────────────────────────────── */}
      <Section
        title="Students Enrolled"
        subtitle="All students enrolled in this bundle have access to every course listed above."
        action={
          <button onClick={() => setAssignStudentOpen(true)} style={primaryBtn}>
            + Assign to Student
          </button>
        }
      >
        <StudentTable students={bundle.enrolled_students} />
      </Section>

      {/* ── Modals ───────────────────────────────────────────── */}
      {addCourseOpen && (
        <AddCourseModal
          bundleId={bundleId}
          existingCourseIds={bundle.courses.map((c) => c.id)}
          enrolledStudentCount={bundle.enrolled_students.length}
          callerId={callerId}
          callerRole={roleCode}
          onClose={() => setAddCourseOpen(false)}
          onAdded={(msg) => { setAddCourseOpen(false); void reload(); showToast(msg); }}
        />
      )}

      {assignStudentOpen && (
        <AssignStudentModal
          bundleId={bundleId}
          existingStudentIds={bundle.enrolled_students.map((s) => s.id)}
          callerId={callerId}
          callerRole={roleCode}
          onClose={() => setAssignStudentOpen(false)}
          onAssigned={(msg) => { setAssignStudentOpen(false); void reload(); showToast(msg); }}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(135deg, #034852 0%, #006d6c 100%)",
          color: "#fff", padding: "12px 24px", borderRadius: "100px",
          fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
          boxShadow: "0 8px 24px rgba(3,72,82,0.3)", zIndex: 200,
          animation: "floatIn 0.3s ease forwards",
        }}>
          ✓ {toast}
        </div>
      )}
    </Shell>
  );
}

// ── Course list with DnD ──────────────────────────────────────────────────────

function CourseList({
  bundleId, courses, callerId, callerRole, studentCount,
  onRemoved, onReordered, setGlobalError,
}: {
  bundleId: string;
  courses: BundleCourse[];
  callerId: string;
  callerRole: string;
  studentCount: number;
  onRemoved: () => void;
  onReordered: () => void;
  setGlobalError: (e: string | null) => void;
}) {
  const [localCourses, setLocalCourses] = useState(courses);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => { setLocalCourses(courses); }, [courses]);

  async function onDrop(dropIdx: number) {
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) { setDragOverIdx(null); return; }
    const next = [...localCourses];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(dropIdx, 0, moved);
    setLocalCourses(next);
    setDragOverIdx(null);
    dragIdx.current = null;
    try {
      await reorderBundleCourses(bundleId, next.map((c) => c.id), callerId, callerRole);
      onReordered();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Reorder failed.");
      setLocalCourses(courses);
    }
  }

  async function handleRemove(courseId: string, title: string) {
    if (!confirm(`Remove "${title}" from this bundle?\n\nStudents already enrolled will keep their individual course access.`)) return;
    try {
      await removeCourseFromBundle(bundleId, courseId, callerId, callerRole);
      onRemoved();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to remove course.");
    }
  }

  if (localCourses.length === 0) {
    return (
      <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.45)", padding: "16px 0" }}>
        No courses yet. Click "+ Add Course" to get started.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {localCourses.map((course, idx) => (
        <div
          key={course.id}
          draggable
          onDragStart={() => { dragIdx.current = idx; }}
          onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
          onDrop={() => void onDrop(idx)}
          onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null); }}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 14px",
            borderRadius: "12px",
            background: dragOverIdx === idx ? "rgba(10,190,98,0.06)" : "rgba(3,72,82,0.025)",
            border: `1px solid ${dragOverIdx === idx ? "rgba(10,190,98,0.25)" : "rgba(3,72,82,0.07)"}`,
            marginBottom: "6px",
            cursor: "grab",
            transition: "all 120ms ease",
            opacity: dragOverIdx === idx ? 0.7 : 1,
          }}
        >
          <span style={{ fontSize: "15px", color: "rgba(3,72,82,0.3)", flexShrink: 0, cursor: "grab" }}>⠿</span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.3)", minWidth: "20px" }}>{idx + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {course.title}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
              {course.programme_type}
              {studentCount > 0 && <span style={{ marginLeft: "8px", color: "#0abe62" }}>✓ {studentCount} student{studentCount !== 1 ? "s" : ""} enrolled</span>}
            </p>
          </div>
          <span style={{
            padding: "3px 9px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
            background: course.status === "ACTIVE" ? "rgba(10,190,98,0.1)" : "rgba(255,222,0,0.2)",
            color: course.status === "ACTIVE" ? "#0abe62" : "#956f00",
          }}>
            {course.status}
          </span>
          <button
            onClick={() => void handleRemove(course.id, course.title)}
            style={{ background: "none", border: "none", fontSize: "14px", color: "rgba(229,62,62,0.6)", cursor: "pointer", padding: "4px 6px", borderRadius: "8px", flexShrink: 0 }}
            title="Remove from bundle"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Student table ─────────────────────────────────────────────────────────────

function StudentTable({ students }: { students: BundleEnrolledStudent[] }) {
  if (students.length === 0) {
    return (
      <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.45)", padding: "16px 0" }}>
        No students enrolled yet. Click "+ Assign to Student" to add one.
      </p>
    );
  }
  return (
    <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.08)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "rgba(32,147,121,0.04)", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
            {["Name", "Roll Number", "Email", "Enrolled"].map((h) => (
              <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid rgba(3,72,82,0.05)" }}>
              <td style={tdSt}><strong style={{ color: "#034852" }}>{s.name}</strong></td>
              <td style={tdSt}>{s.roll_number ?? "—"}</td>
              <td style={tdSt}>{s.email || "—"}</td>
              <td style={tdSt}>{new Date(s.enrolled_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Add Course Modal ──────────────────────────────────────────────────────────

function AddCourseModal({
  bundleId, existingCourseIds, enrolledStudentCount, callerId, callerRole, onClose, onAdded,
}: {
  bundleId: string;
  existingCourseIds: string[];
  enrolledStudentCount: number;
  callerId: string;
  callerRole: string;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Course | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCourses(undefined, undefined, undefined, true)
      .then((data) => setCourses(data.filter((c) => c.status === "ACTIVE" && !existingCourseIds.includes(c.id))))
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false));
  }, [existingCourseIds]);

  const filtered = courses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  function handleSelect(course: Course) {
    setSelected(course);
    setConfirming(false);
    setError(null);
  }

  function handleConfirmClick() {
    if (!selected) return;
    if (enrolledStudentCount > 0) {
      setConfirming(true);
    } else {
      void doAdd();
    }
  }

  async function doAdd() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await addCourseToBundle(bundleId, selected.id, callerId, callerRole);
      const msg = result.students_enrolled > 0
        ? `"${selected.title}" added and ${result.students_enrolled} student${result.students_enrolled !== 1 ? "s" : ""} enrolled.`
        : `"${selected.title}" added to bundle.`;
      onAdded(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add course.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add Course to Bundle">
      {confirming && selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{
            background: "rgba(255,222,0,0.1)", border: "1px solid rgba(255,222,0,0.4)",
            borderRadius: "12px", padding: "16px",
          }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#7a5f00" }}>
              ⚠️ Adding this course will automatically enrol{" "}
              <strong>{enrolledStudentCount} existing student{enrolledStudentCount !== 1 ? "s" : ""}</strong> in "{selected.title}". Continue?
            </p>
          </div>
          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{error}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setConfirming(false)} style={ghostBtnSm}>Go Back</button>
            <button onClick={() => void doAdd()} disabled={submitting} style={{ ...primaryBtnSm, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Adding…" : "Yes, Add Course"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            autoFocus
            type="text"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputSt, marginBottom: "12px" }}
          />
          <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "12px", marginBottom: "16px" }}>
            {loadingCourses ? (
              <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading courses…</p>
            ) : filtered.length === 0 ? (
              <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
                {search ? "No matching courses." : "No active courses available."}
              </p>
            ) : filtered.map((c) => {
              const active = selected?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{
                    padding: "12px 16px", cursor: "pointer",
                    background: active ? "rgba(10,190,98,0.07)" : "transparent",
                    borderLeft: `3px solid ${active ? "#0abe62" : "transparent"}`,
                    transition: "all 130ms ease",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{c.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                      {c.programme_type} · {c.lesson_count} lesson{c.lesson_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {active && <span style={{ color: "#0abe62", fontSize: "16px" }}>✓</span>}
                </div>
              );
            })}
          </div>
          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onClose} style={ghostBtnSm}>Cancel</button>
            <button
              onClick={handleConfirmClick}
              disabled={!selected}
              style={{ ...primaryBtnSm, opacity: !selected ? 0.45 : 1 }}
            >
              Add Course
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Assign Student Modal ──────────────────────────────────────────────────────

function AssignStudentModal({
  bundleId, existingStudentIds, callerId, callerRole, onClose, onAssigned,
}: {
  bundleId: string;
  existingStudentIds: string[];
  callerId: string;
  callerRole: string;
  onClose: () => void;
  onAssigned: (msg: string) => void;
}) {
  const [students, setStudents] = useState<SafeUser[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SafeUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsers("STUDENT")
      .then((data) => setStudents(data.filter((u) => !existingStudentIds.includes(u.id))))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [existingStudentIds]);

  const filtered = students.filter((u) => {
    const q = search.toLowerCase();
    return (u.name ?? "").toLowerCase().includes(q) || (u.roll_number ?? "").toLowerCase().includes(q);
  });

  async function handleAssign() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await enrolStudentInBundle(bundleId, selected.id, callerId, callerRole);
      onAssigned(`${selected.name} enrolled in bundle (${result.courses_enrolled} course${result.courses_enrolled !== 1 ? "s" : ""} assigned).`);
    } catch (e) {
      const status = (e instanceof Error && "status" in e) ? (e as { status: number }).status : 0;
      if (status === 409) {
        setError("This student is already enrolled in this bundle.");
      } else {
        setError(e instanceof Error ? e.message : "Enrolment failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Assign Bundle to Student">
      <input
        autoFocus
        type="text"
        placeholder="Search by name or roll number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputSt, marginBottom: "12px" }}
      />
      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "12px", marginBottom: "16px" }}>
        {loadingStudents ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading students…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
            {search ? "No matching students." : "No students available."}
          </p>
        ) : filtered.map((u) => {
          const active = selected?.id === u.id;
          return (
            <div
              key={u.id}
              onClick={() => { setSelected(u); setError(null); }}
              style={{
                padding: "12px 16px", cursor: "pointer",
                background: active ? "rgba(10,190,98,0.07)" : "transparent",
                borderLeft: `3px solid ${active ? "#0abe62" : "transparent"}`,
                transition: "all 130ms ease",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{u.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                  {u.roll_number ?? u.email ?? "—"} · {u.programme_type ?? "—"}
                </p>
              </div>
              {active && <span style={{ color: "#0abe62", fontSize: "16px" }}>✓</span>}
            </div>
          );
        })}
      </div>
      {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onClose} style={ghostBtnSm}>Cancel</button>
        <button onClick={() => void handleAssign()} disabled={!selected || submitting} style={{ ...primaryBtnSm, opacity: (!selected || submitting) ? 0.45 : 1 }}>
          {submitting ? "Enrolling…" : "Confirm Enrolment"}
        </button>
      </div>
    </Modal>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: "800px", margin: "0 auto" }}>{children}</div>;
}

function Section({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ ...glassCard, marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: subtitle ? "4px" : "20px" }}>
        <h2 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h2>
        {action}
      </div>
      {subtitle && (
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", margin: "0 0 18px" }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,20,30,0.3)", backdropFilter: "blur(4px)", zIndex: 50 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(480px, 92vw)", zIndex: 51 }}>
        <div style={{
          background: "rgba(255,255,255,0.97)", backdropFilter: "blur(24px)",
          borderRadius: "24px", padding: "32px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.18)",
          border: "1px solid rgba(255,255,255,0.3)",
          opacity: 0, transform: "translateY(12px)",
          animation: "floatIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.45)", cursor: "pointer", padding: "4px 8px" }}>✕</button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function Chip({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "4px 10px", borderRadius: "100px",
      background: "rgba(3,72,82,0.06)", fontSize: "12px",
      fontWeight: 600, color: "#034852",
    }}>
      {icon} {value} {label}{value !== 1 ? "s" : ""}
    </span>
  );
}

function LoadingCard() {
  return (
    <div style={{ ...glassCard, textAlign: "center" }}>
      <p style={labelSt}>Loading</p>
      <p style={{ ...headingSt, marginTop: "12px", fontSize: "18px" }}>Fetching bundle…</p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "28px 32px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379", margin: 0,
};

const headingSt: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", margin: 0,
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 18px", border: "none", borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
  boxShadow: "0 4px 12px rgba(10,190,98,0.2)",
};

const primaryBtnSm: React.CSSProperties = {
  flex: 2, padding: "11px 18px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "14px", cursor: "pointer",
};

const ghostBtnSm: React.CSSProperties = {
  flex: 1, padding: "11px 14px",
  border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "12px",
  background: "rgba(255,255,255,0.7)", color: "#034852",
  fontFamily: "var(--font-heading)", fontWeight: 600,
  fontSize: "14px", cursor: "pointer", textAlign: "center",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(3,72,82,0.03)",
  border: "1px solid rgba(3,72,82,0.12)",
  borderRadius: "10px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
};

const tdSt: React.CSSProperties = {
  padding: "11px 16px", textAlign: "left", color: "rgba(3,72,82,0.75)", fontSize: "13px",
};

const errorBox: React.CSSProperties = {
  padding: "10px 14px", borderRadius: "10px",
  background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.2)",
  fontSize: "13px", color: "#c53030", fontWeight: 500,
};
