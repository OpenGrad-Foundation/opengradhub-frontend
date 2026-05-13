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
  removeStudentFromBundle,
  addTestToBundle,
  removeTestFromBundle,
  getCourses,
  getQuizzes,
  getUsers,
  type BundleDetail,
  type BundleCourse,
  type BundleTest,
  type BundleEnrolledStudent,
  type Course,
  type Quiz,
  type SafeUser,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BundleDetailPage() {
  const { id: bundleId } = useParams<{ id: string }>();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();

  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Modal toggles
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [assignStudentOpen, setAssignStudentOpen] = useState(false);
  const [addTestOpen, setAddTestOpen] = useState(false);

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
  if (!has(PERM.bundles.edit)) {
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
          <Chip icon="📝" value={bundle.tests.length} label="test" />
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
        <StudentTable
          bundleId={bundleId}
          students={bundle.enrolled_students}
          onRemoved={() => { void reload(); }}
          setGlobalError={setGlobalError}
        />
      </Section>

      {/* ── Section 3: Tests ─────────────────────────────────── */}
      <Section
        title="Tests in this Bundle"
        subtitle="Published global tests attached to this bundle. Enrolled students can see and take these from their Assessments page."
        action={
          <button onClick={() => setAddTestOpen(true)} style={primaryBtn}>
            + Add Test
          </button>
        }
      >
        <TestList
          bundleId={bundleId}
          tests={bundle.tests}
          onRemoved={() => { void reload(); }}
          setGlobalError={setGlobalError}
        />
      </Section>

      {/* ── Modals ───────────────────────────────────────────── */}
      {addCourseOpen && (
        <AddCourseModal
          bundleId={bundleId}
          existingCourseIds={bundle.courses.map((c) => c.id)}
          enrolledStudentCount={bundle.enrolled_students.length}
          onClose={() => setAddCourseOpen(false)}
          onAdded={(msg) => { setAddCourseOpen(false); void reload(); showToast(msg); }}
        />
      )}

      {assignStudentOpen && (
        <AssignStudentModal
          bundleId={bundleId}
          existingStudentIds={bundle.enrolled_students.map((s) => s.id)}
          onClose={() => setAssignStudentOpen(false)}
          onAssigned={(msg) => { setAssignStudentOpen(false); void reload(); showToast(msg); }}
        />
      )}

      {addTestOpen && (
        <AddTestModal
          bundleId={bundleId}
          existingTestIds={bundle.tests.map((t) => t.id)}
          onClose={() => setAddTestOpen(false)}
          onAdded={(msg) => { setAddTestOpen(false); void reload(); showToast(msg); }}
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
  bundleId, courses, studentCount,
  onRemoved, onReordered, setGlobalError,
}: {
  bundleId: string;
  courses: BundleCourse[];
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
      await reorderBundleCourses(bundleId, next.map((c) => c.id));
      onReordered();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Reorder failed.");
      setLocalCourses(courses);
    }
  }

  async function handleRemove(courseId: string, title: string) {
    if (!confirm(`Remove "${title}" from this bundle?\n\nStudents already enrolled will keep their individual course access.`)) return;
    try {
      await removeCourseFromBundle(bundleId, courseId);
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

function StudentTable({
  bundleId, students, onRemoved, setGlobalError,
}: {
  bundleId: string;
  students: BundleEnrolledStudent[];
  onRemoved: () => void;
  setGlobalError: (e: string | null) => void;
}) {
  async function handleRemove(studentId: string, studentName: string) {
    if (!confirm(`Remove ${studentName} from this bundle? They will lose access to courses not assigned elsewhere.`)) return;
    try {
      await removeStudentFromBundle(bundleId, studentId);
      onRemoved();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to remove student.");
    }
  }

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
            {["Name", "Roll Number", "Email", "Enrolled", ""].map((h) => (
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
              <td style={{ ...tdSt, textAlign: "right" }}>
                <button
                  onClick={() => void handleRemove(s.id, s.name)}
                  style={{ background: "none", border: "none", fontSize: "12px", color: "rgba(229,62,62,0.7)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px", fontFamily: "var(--font-body)", fontWeight: 600 }}
                  title={`Remove ${s.name} from bundle`}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Add Course Modal ──────────────────────────────────────────────────────────

function AddCourseModal({
  bundleId, existingCourseIds, enrolledStudentCount, onClose, onAdded,
}: {
  bundleId: string;
  existingCourseIds: string[];
  enrolledStudentCount: number;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [allCourses,    setAllCourses]    = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [search,        setSearch]        = useState("");
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [confirming,    setConfirming]    = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [progress,      setProgress]      = useState("");
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    getCourses(undefined, undefined, undefined, true)
      .then((data) => setAllCourses(data.filter((c) => c.status === "ACTIVE")))
      .catch(() => setAllCourses([]))
      .finally(() => setLoadingCourses(false));
  }, []);

  function toggleCourse(id: string) {
    if (existingCourseIds.includes(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setError(null);
  }

  const filtered       = allCourses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const selectedCourses = allCourses.filter((c) => selectedIds.has(c.id));
  const nSelected      = selectedIds.size;

  function handleConfirmClick() {
    if (nSelected === 0) return;
    if (enrolledStudentCount > 0) {
      setConfirming(true);
    } else {
      void doAdd();
    }
  }

  async function doAdd() {
    setSubmitting(true);
    setError(null);
    let totalStudentsEnrolled = 0;
    const courseList = allCourses.filter((c) => selectedIds.has(c.id));
    try {
      for (let i = 0; i < courseList.length; i++) {
        const c = courseList[i];
        setProgress(`Adding ${i + 1} of ${courseList.length}…`);
        const result = await addCourseToBundle(bundleId, c.id);
        totalStudentsEnrolled += result.students_enrolled;
      }
      const noun = courseList.length === 1 ? `"${courseList[0].title}"` : `${courseList.length} courses`;
      const msg = totalStudentsEnrolled > 0
        ? `${noun} added and ${totalStudentsEnrolled} student${totalStudentsEnrolled !== 1 ? "s" : ""} enrolled.`
        : `${noun} added to bundle.`;
      onAdded(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add course.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  }

  return (
    <Modal onClose={!submitting ? onClose : undefined} title="Add Courses to Bundle">
      {confirming ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "rgba(255,222,0,0.1)", border: "1px solid rgba(255,222,0,0.4)", borderRadius: "12px", padding: "16px" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#7a5f00" }}>
              ⚠️ Adding {nSelected === 1 ? "this course" : `these ${nSelected} courses`} will automatically enrol{" "}
              <strong>{enrolledStudentCount} existing student{enrolledStudentCount !== 1 ? "s" : ""}</strong>. Continue?
            </p>
          </div>
          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{error}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setConfirming(false)} style={ghostBtnSm} disabled={submitting}>Go Back</button>
            <button onClick={() => void doAdd()} disabled={submitting} style={{ ...primaryBtnSm, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? (progress || "Adding…") : `Yes, Add ${nSelected} Course${nSelected !== 1 ? "s" : ""}`}
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
            style={{ ...inputSt, marginBottom: "10px" }}
          />

          {/* Course list with checkboxes */}
          <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "12px", marginBottom: "12px" }}>
            {loadingCourses ? (
              <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading courses…</p>
            ) : filtered.length === 0 ? (
              <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
                {search ? "No matching courses." : "No active courses available."}
              </p>
            ) : filtered.map((c) => {
              const alreadyAdded = existingCourseIds.includes(c.id);
              const checked      = selectedIds.has(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px", cursor: alreadyAdded ? "default" : "pointer",
                    borderBottom: "1px solid rgba(3,72,82,0.05)",
                    background: checked ? "rgba(10,190,98,0.07)" : "transparent",
                    opacity: alreadyAdded ? 0.45 : 1,
                    transition: "background 100ms",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={alreadyAdded}
                    onChange={() => toggleCourse(c.id)}
                    style={{ accentColor: "#0abe62", width: "14px", height: "14px", flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#034852", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                      {alreadyAdded && <span style={{ fontWeight: 400, color: "rgba(3,72,82,0.5)", marginLeft: "6px" }}>already in bundle</span>}
                    </span>
                    <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                      {c.programme_type} · {c.lesson_count} lesson{c.lesson_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {/* Selected tags */}
          {selectedCourses.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
              {selectedCourses.map((c) => (
                <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px 3px 10px", borderRadius: "100px", background: "rgba(10,190,98,0.1)", border: "1px solid rgba(10,190,98,0.25)", fontSize: "12px", fontWeight: 600, color: "#034852" }}>
                  {c.title}
                  <button onClick={() => toggleCourse(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)", fontSize: "14px", lineHeight: 1, padding: "0 2px", fontWeight: 700 }}>×</button>
                </span>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "10px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onClose} style={ghostBtnSm}>Cancel</button>
            <button
              onClick={handleConfirmClick}
              disabled={nSelected === 0}
              style={{ ...primaryBtnSm, opacity: nSelected === 0 ? 0.45 : 1 }}
            >
              {nSelected === 0 ? "Add Courses" : `Add ${nSelected} Course${nSelected !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Assign Student Modal ──────────────────────────────────────────────────────

function AssignStudentModal({
  bundleId, existingStudentIds, onClose, onAssigned,
}: {
  bundleId: string;
  existingStudentIds: string[];
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
      const result = await enrolStudentInBundle(bundleId, selected.id);
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

// ── Test list ─────────────────────────────────────────────────────────────────

function TestList({
  bundleId, tests, onRemoved, setGlobalError,
}: {
  bundleId: string;
  tests: BundleTest[];
  onRemoved: () => void;
  setGlobalError: (e: string | null) => void;
}) {
  async function handleRemove(quizId: string, title: string) {
    if (!confirm(`Remove "${title}" from this bundle?\n\nExisting student attempts are not affected.`)) return;
    try {
      await removeTestFromBundle(bundleId, quizId);
      onRemoved();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to remove test.");
    }
  }

  if (tests.length === 0) {
    return (
      <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.45)", padding: "16px 0" }}>
        No tests yet. Click "+ Add Test" to attach a global test.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {tests.map((test) => (
        <div
          key={test.id}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 14px", borderRadius: "12px",
            background: "rgba(3,72,82,0.025)",
            border: "1px solid rgba(3,72,82,0.07)",
          }}
        >
          <span style={{ fontSize: "16px", flexShrink: 0 }}>📝</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {test.title}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
              {test.question_count} question{test.question_count !== 1 ? "s" : ""}
              {test.duration_minutes != null && ` · ${test.duration_minutes} min`}
              {test.max_attempts != null && ` · max ${test.max_attempts} attempt${test.max_attempts !== 1 ? "s" : ""}`}
            </p>
          </div>
          <span style={{
            padding: "3px 9px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
            background: test.published ? "rgba(10,190,98,0.1)" : "rgba(255,222,0,0.2)",
            color: test.published ? "#0abe62" : "#956f00",
          }}>
            {test.published ? "Published" : "Draft"}
          </span>
          <button
            onClick={() => void handleRemove(test.id, test.title)}
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

// ── Add Test Modal ────────────────────────────────────────────────────────────

function AddTestModal({
  bundleId, existingTestIds, onClose, onAdded,
}: {
  bundleId: string;
  existingTestIds: string[];
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [quizzes, setQuizzes] = useState<Omit<Quiz, "questions">[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Omit<Quiz, "questions"> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuizzes({ quiz_type: "GLOBAL_TEST" })
      .then((data) => setQuizzes(
        data.filter((q) => q.published && !existingTestIds.includes(q.id))
      ))
      .catch(() => setQuizzes([]))
      .finally(() => setLoadingQuizzes(false));
  }, [existingTestIds]);

  const filtered = quizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await addTestToBundle(bundleId, selected.id);
      onAdded(`"${selected.title}" added to bundle.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add test.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add Test to Bundle">
      <input
        autoFocus
        type="text"
        placeholder="Search published global tests…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputSt, marginBottom: "12px" }}
      />
      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "12px", marginBottom: "16px" }}>
        {loadingQuizzes ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading tests…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
            {search ? "No matching tests." : "No published global tests available."}
          </p>
        ) : filtered.map((q) => {
          const active = selected?.id === q.id;
          return (
            <div
              key={q.id}
              onClick={() => { setSelected(q); setError(null); }}
              style={{
                padding: "12px 16px", cursor: "pointer",
                background: active ? "rgba(10,190,98,0.07)" : "transparent",
                borderLeft: `3px solid ${active ? "#0abe62" : "transparent"}`,
                transition: "all 130ms ease",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{q.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                  {q.duration_minutes != null ? `${q.duration_minutes} min` : "No time limit"}
                  {q.max_attempts != null && ` · max ${q.max_attempts} attempt${q.max_attempts !== 1 ? "s" : ""}`}
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
          onClick={() => void handleAdd()}
          disabled={!selected || submitting}
          style={{ ...primaryBtnSm, opacity: (!selected || submitting) ? 0.45 : 1 }}
        >
          {submitting ? "Adding…" : "Add Test"}
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

function Modal({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,20,30,0.3)", backdropFilter: "blur(4px)", zIndex: 50 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(500px, 92vw)", zIndex: 51 }}>
        <div style={{
          background: "#ffffff",
          borderRadius: "24px", padding: "32px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          border: "1px solid rgba(255,255,255,0.3)",
          opacity: 0, transform: "translateY(12px)",
          animation: "floatIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h3>
            {onClose && <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.45)", cursor: "pointer", padding: "4px 8px" }}>✕</button>}
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
  background: "#ffffff", color: "#034852",
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
