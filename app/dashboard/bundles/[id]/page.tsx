"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check, FileText, GripVertical, Plus, TriangleAlert, User, X } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getBundleById,
  deleteBundle,
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
import { useInvalidate } from "@/lib/mutations/invalidation";
import { Tabs, type TabDef } from "@/app/dashboard/_components/Tabs";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BundleDetailPage() {
  const { id: bundleId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const { isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = useCallback(async () => {
    if (!bundle) return;
    const ok = window.confirm(
      `Delete bundle "${bundle.name}"? This removes the bundle and its course/quiz groupings. Students keep access to courses they were already enrolled in. This cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteBundle(bundleId);
      // batch_bundles rows cascade away via FK — every batch that held this
      // bundle loses it and its derived courses.
      invalidate('bundles', 'batches');
      await queryClient.invalidateQueries({ queryKey: ["og", "bundles"] });
      router.push("/dashboard/bundles");
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to delete bundle.");
      setDeleting(false);
    }
  }, [bundle, bundleId, queryClient, router]);

  if (userLoading || loading) return <Shell><LoadingCard /></Shell>;
  if (!has(PERM.bundles.edit)) {
    return (
      <Shell>
        <div style={glassCard}>
          <p style={labelSt}>Access denied</p>
          <p style={{ ...headingSt, marginTop: "12px", fontSize: "18px" }}>
            Only Super Admins and Program Managers can manage bundles.
          </p>
        </div>
      </Shell>
    );
  }
  if (!bundle) {
    return <Shell><div style={glassCard}><p style={{ color: "#b83232", fontWeight: 600, margin: 0 }}>{globalError ?? "Bundle not found."}</p></div></Shell>;
  }

  // Panels are declared up front so the conditional Settings tab stays typed;
  // <Tabs> renders only the active one.
  const tabs: TabDef[] = [
    {
      key: "courses",
      label: "Courses",
      panel: (
        <Section
          title="Courses in this Bundle"
          action={
            <button onClick={() => setAddCourseOpen(true)} style={primaryBtn}>
              <Plus size={16} aria-hidden="true" />Add Course
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
      ),
    },
    {
      key: "students",
      label: "Students",
      panel: (
        <Section
          title="Students Enrolled"
          action={
            <button onClick={() => setAssignStudentOpen(true)} style={primaryBtn}>
              <Plus size={16} aria-hidden="true" />Assign to Student
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
      ),
    },
    {
      key: "quizzes",
      label: "Quizzes",
      panel: (
        <Section
          title="Quizzes in this Bundle"
          action={
            <button onClick={() => setAddTestOpen(true)} style={primaryBtn}>
              <Plus size={16} aria-hidden="true" />Add Quiz
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
      ),
    },
  ];

  if (has(PERM.bundles.delete)) {
    tabs.push({
      key: "settings",
      label: "Settings",
      panel: (
        <Section title="Danger Zone">
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "0 0 16px" }}>
            Deleting a bundle removes it and its course/quiz groupings, and drops it from
            every batch that holds it. Students keep access to courses they were already
            enrolled in. This cannot be undone.
          </p>
          <button onClick={handleDelete} disabled={deleting} style={{ ...dangerBtn, opacity: deleting ? 0.6 : 1 }}>
            {deleting ? "Deleting…" : "Delete Bundle"}
          </button>
        </Section>
      ),
    });
  }

  return (
    <Shell>
      {/* ── Header ───────────────────────────────────────────── */}
      <BackLink fallback="/dashboard/bundles" style={ghostBtn}>
        <ArrowLeft size={16} aria-hidden="true" />Back to Bundles
      </BackLink>
      <div style={{ margin: "16px 0 28px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <h2 style={{ ...headingSt, fontSize: "24px", margin: 0 }}>{bundle.name}</h2>
          {bundle.description && (
            <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginTop: "6px" }}>{bundle.description}</p>
          )}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <Chip icon={<BookOpen size={14} aria-hidden="true" />} value={bundle.courses.length} label="course" />
            <Chip icon={<User size={14} aria-hidden="true" />} value={bundle.enrolled_students.length} label="student" />
            <Chip icon={<FileText size={14} aria-hidden="true" />} value={bundle.tests.length} label="quiz" />
          </div>
        </div>
      </div>

      {globalError && <div style={{ ...errorBox, marginBottom: "20px" }}>{globalError}</div>}

      <Tabs tabs={tabs} ariaLabel="Bundle sections" />

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
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "var(--color-text)", color: "var(--color-surface)",
          padding: "12px 20px", borderRadius: "12px",
          fontWeight: 600, fontSize: "14px",
          zIndex: 200,
          animation: "floatIn 0.3s ease forwards",
        }}>
          <Check size={16} aria-hidden="true" />{toast}
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
  const invalidate = useInvalidate();
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
      invalidate('bundles');
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
      // Enrolments survive by design, but batches reaching this course only via
      // the bundle lose it from their derived course list.
      invalidate('bundles', 'batches');
      onRemoved();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to remove course.");
    }
  }

  if (localCourses.length === 0) {
    return (
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", padding: "16px 0" }}>
        No courses yet. Click &quot;+ Add Course&quot; to get started.
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
            background: dragOverIdx === idx ? "rgba(10,190,98,0.06)" : "var(--color-surface)",
            border: `1px solid ${dragOverIdx === idx ? "var(--green)" : "var(--color-border)"}`,
            marginBottom: "6px",
            cursor: "grab",
            transition: "all 120ms ease",
            opacity: dragOverIdx === idx ? 0.7 : 1,
          }}
        >
          <GripVertical size={16} aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0, cursor: "grab" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", minWidth: "20px" }}>{idx + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {course.title}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
              {course.programme_type}
              {studentCount > 0 && <span style={{ marginLeft: "8px", color: "#08784a", display: "inline-flex", alignItems: "center", gap: "4px" }}><Check size={12} aria-hidden="true" />{studentCount} student{studentCount !== 1 ? "s" : ""} enrolled</span>}
            </p>
          </div>
          <span style={{
            padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
            background: course.status === "ACTIVE" ? "rgba(10,190,98,0.1)" : "rgba(255,222,0,0.2)",
            color: course.status === "ACTIVE" ? "#08784a" : "#956f00",
          }}>
            {course.status}
          </span>
          <button
            onClick={() => void handleRemove(course.id, course.title)}
            style={iconBtn}
            title="Remove from bundle"
            aria-label="Remove from bundle"
          >
            <X size={16} aria-hidden="true" />
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
  const invalidate = useInvalidate();
  async function handleRemove(studentId: string, studentName: string) {
    if (!confirm(`Remove ${studentName} from this bundle? They will lose access to courses not assigned elsewhere.`)) return;
    try {
      await removeStudentFromBundle(bundleId, studentId);
      invalidate('bundles', 'enrolment');
      onRemoved();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to remove student.");
    }
  }

  if (students.length === 0) {
    return (
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", padding: "16px 0" }}>
        No students enrolled yet. Click &quot;+ Assign to Student&quot; to add one.
      </p>
    );
  }
  return (
    <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "var(--color-surface-sunken)", borderBottom: "1px solid var(--color-border)" }}>
            {["Name", "Roll Number", "Email", "Enrolled", ""].map((h) => (
              <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td style={tdSt}>
                <strong style={{ color: "var(--color-text)" }}>{s.name}</strong>
                {s.via_batch_name && (
                  <span style={{ marginLeft: "8px", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, background: "var(--color-surface-sunken)", color: "var(--color-text-muted)" }}>
                    via {s.via_batch_name}
                  </span>
                )}
              </td>
              <td style={tdSt}>{s.roll_number ?? "—"}</td>
              <td style={tdSt}>{s.email || "—"}</td>
              <td style={tdSt}>{new Date(s.enrolled_at).toLocaleDateString()}</td>
              <td style={{ ...tdSt, textAlign: "right" }}>
                {s.via_batch_name ? (
                  <span
                    style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 600 }}
                    title="Granted via a batch — remove the student or bundle from the batch instead"
                  >
                    Managed by batch
                  </span>
                ) : (
                  <button
                    onClick={() => void handleRemove(s.id, s.name)}
                    style={{ background: "none", border: "none", fontSize: "12px", color: "#b83232", cursor: "pointer", padding: "4px 8px", borderRadius: "8px", fontFamily: "var(--font-body)", fontWeight: 600 }}
                    title={`Remove ${s.name} from bundle`}
                  >
                    Remove
                  </button>
                )}
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
  const invalidate = useInvalidate();
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      // Back-end back-fills course_enrolments for every bundle subscriber and
      // the course joins the derived course list of every batch holding this
      // bundle — so the student/course views and batch views both go stale.
      invalidate('bundles', 'enrolment', 'batches');
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
              <TriangleAlert size={16} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: "6px" }} />Adding {nSelected === 1 ? "this course" : `these ${nSelected} courses`} will automatically enrol{" "}
              <strong>{enrolledStudentCount} existing student{enrolledStudentCount !== 1 ? "s" : ""}</strong>. Continue?
            </p>
          </div>
          {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600 }}>{error}</p>}
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
          <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "12px", marginBottom: "12px" }}>
            {loadingCourses ? (
              <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>Loading courses…</p>
            ) : filtered.length === 0 ? (
              <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
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
                    borderBottom: "1px solid var(--color-border)",
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
                    style={{ accentColor: "#08784a", width: "14px", height: "14px", flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                      {alreadyAdded && <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "6px" }}>already in bundle</span>}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
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
                <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px 3px 10px", borderRadius: "6px", background: "rgba(10,190,98,0.1)", border: "1px solid rgba(10,190,98,0.25)", fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                  {c.title}
                  <button onClick={() => toggleCourse(c.id)} aria-label={`Remove ${c.title}`} style={{ display: "inline-flex", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: "0 2px" }}><X size={12} strokeWidth={3} aria-hidden="true" /></button>
                </span>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginBottom: "10px" }}>{error}</p>}

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
  const invalidate = useInvalidate();
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
      invalidate('bundles', 'enrolment');
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
      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "12px", marginBottom: "16px" }}>
        {loadingStudents ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>Loading students…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
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
                borderLeft: `3px solid ${active ? "var(--green)" : "transparent"}`,
                transition: "all 130ms ease",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{u.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {u.roll_number ?? u.email ?? "—"} · {u.programme_type ?? "—"}
                </p>
              </div>
              {active && <Check size={16} aria-hidden="true" style={{ color: "#08784a" }} />}
            </div>
          );
        })}
      </div>
      {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
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
  const invalidate = useInvalidate();
  const { has } = usePermissions();
  const currentUrl = useCurrentUrl();
  async function handleRemove(quizId: string, title: string) {
    if (!confirm(`Remove "${title}" from this bundle?\n\nExisting student attempts are not affected.`)) return;
    try {
      await removeTestFromBundle(bundleId, quizId);
      invalidate('bundles', 'quizzes');
      onRemoved();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to remove quiz.");
    }
  }

  if (tests.length === 0) {
    return (
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", padding: "16px 0" }}>
        No quizzes yet. Click &quot;+ Add Quiz&quot; to attach a global quiz.
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
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <FileText size={16} aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {test.title}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
              {test.question_count} question{test.question_count !== 1 ? "s" : ""}
              {test.duration_minutes != null && ` · ${test.duration_minutes} min`}
              {test.max_attempts != null && test.max_attempts > 0 && ` · max ${test.max_attempts} attempt${test.max_attempts !== 1 ? "s" : ""}`}
            </p>
          </div>
          <span style={{
            padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
            background: test.published ? "rgba(10,190,98,0.1)" : "rgba(255,222,0,0.2)",
            color: test.published ? "#08784a" : "#956f00",
          }}>
            {test.published ? "Published" : "Draft"}
          </span>
          {has(PERM.test_bank.edit) && (
            <Link
              href={withFrom(`/dashboard/quiz-builder/${test.id}`, currentUrl)}
              style={{
                ...ghostBtn, flexShrink: 0, minHeight: "36px", padding: "4px 12px", fontSize: "13px",
              }}
              title="Edit questions & settings in the builder"
            >
              Edit<ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
          <button
            onClick={() => void handleRemove(test.id, test.title)}
            style={iconBtn}
            title="Remove from bundle"
            aria-label="Remove from bundle"
          >
            <X size={16} aria-hidden="true" />
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
  const invalidate = useInvalidate();
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
      invalidate('bundles', 'quizzes');
      onAdded(`"${selected.title}" added to bundle.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add Quiz to Bundle">
      <input
        autoFocus
        type="text"
        placeholder="Search published global quizzes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputSt, marginBottom: "12px" }}
      />
      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "12px", marginBottom: "16px" }}>
        {loadingQuizzes ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>Loading quizzes…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
            {search ? "No matching quizzes." : "No published global quizzes available."}
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
                borderLeft: `3px solid ${active ? "var(--green)" : "transparent"}`,
                transition: "all 130ms ease",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{q.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {q.duration_minutes != null ? `${q.duration_minutes} min` : "No time limit"}
                  {q.max_attempts != null && q.max_attempts > 0 && ` · max ${q.max_attempts} attempt${q.max_attempts !== 1 ? "s" : ""}`}
                </p>
              </div>
              {active && <Check size={16} aria-hidden="true" style={{ color: "#08784a" }} />}
            </div>
          );
        })}
      </div>
      {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onClose} style={ghostBtnSm}>Cancel</button>
        <button
          onClick={() => void handleAdd()}
          disabled={!selected || submitting}
          style={{ ...primaryBtnSm, opacity: (!selected || submitting) ? 0.45 : 1 }}
        >
          {submitting ? "Adding…" : "Add Quiz"}
        </button>
      </div>
    </Modal>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: "800px", margin: "0 auto" }}>{children}</div>;
}

function Section({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ ...glassCard, marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "20px" }}>
        <h2 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,20,30,0.3)", zIndex: 50 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(500px, 92vw)", zIndex: 51 }}>
        <div style={{
          background: "var(--color-surface)",
          borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)",
          border: "1px solid var(--color-border)",
          opacity: 0, transform: "translateY(12px)",
          animation: "floatIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h3>
            {onClose && <button onClick={onClose} aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "44px", minHeight: "44px", background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", padding: 0 }}><X size={18} aria-hidden="true" /></button>}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function Chip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 8px", borderRadius: "6px",
      background: "var(--color-surface-sunken)", fontSize: "12px",
      fontWeight: 600, color: "var(--color-text)",
    }}>
      {icon} {value} {label}{value !== 1 ? (label.endsWith("z") ? "zes" : "s") : ""}
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
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px, 4vw, 24px)",
};

const labelSt: React.CSSProperties = {
  fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0,
};

const headingSt: React.CSSProperties = {
  fontWeight: 700, color: "var(--color-text)", margin: 0,
};

const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
  minHeight: "44px", padding: "8px 16px", borderRadius: "12px",
  fontWeight: 600, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
};

const primaryBtn: React.CSSProperties = {
  ...btnBase, border: "1px solid var(--green)", background: "var(--green)", color: "var(--dark-teal)",
};

const ghostBtn: React.CSSProperties = {
  ...btnBase, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)",
};

const dangerBtn: React.CSSProperties = {
  ...btnBase, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "#b83232",
};

const primaryBtnSm: React.CSSProperties = { ...primaryBtn, flex: 2 };

const ghostBtnSm: React.CSSProperties = { ...ghostBtn, flex: 1, textAlign: "center" };

const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "36px", minHeight: "36px",
  background: "none", border: "none", color: "#b83232", cursor: "pointer", padding: 0, borderRadius: "8px", flexShrink: 0,
};

const inputSt: React.CSSProperties = {
  width: "100%", minHeight: "44px", padding: "8px 12px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "8px", color: "var(--color-text)",
  fontSize: "14px", boxSizing: "border-box",
};

const tdSt: React.CSSProperties = {
  padding: "11px 16px", textAlign: "left", color: "var(--color-text-muted)", fontSize: "13px",
};

const errorBox: React.CSSProperties = {
  padding: "10px 14px", borderRadius: "8px",
  background: "var(--color-danger-surface)", border: "1px solid rgba(184,50,50,0.2)",
  fontSize: "13px", color: "#b83232", fontWeight: 500,
};
