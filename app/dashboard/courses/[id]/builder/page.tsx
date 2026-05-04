"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getCourseById,
  getCourseModules,
  updateCourse,
  createModule,
  reorderModules,
  updateModule,
  deleteModule,
  createLesson,
  reorderLessons,
  updateLesson,
  deleteLesson,
  type Course,
  type CourseModule,
  type CourseLesson,
} from "@/lib/api";

// ── Page ───────────────────────────────────────────────────────

export default function BuilderPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const { data: userData } = useCurrentUser();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Lesson slide-over state
  const [slideOver, setSlideOver] = useState<{
    moduleId: string;
    lesson?: CourseLesson;
  } | null>(null);

  const callerId = userData?.user?.id ?? "";
  const callerRole = userData?.role?.code ?? "";

  const reload = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        getCourseById(courseId),
        getCourseModules(courseId),
      ]);
      setCourse(c);
      setModules(m);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, [courseId]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  async function handlePublish() {
    if (!course) return;
    setPublishing(true);
    setGlobalError(null);
    try {
      const newStatus = course.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
      const updated = await updateCourse(courseId, {
        status: newStatus,
        caller_id: callerId,
        caller_role: callerRole,
      });
      setCourse(updated);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <Shell><LoadingCard /></Shell>;
  if (!course) return <Shell><ErrorCard message={globalError ?? "Course not found."} /></Shell>;

  return (
    <Shell>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px" }}>
        <div>
          <p style={labelSt}>Curriculum Builder</p>
          <h1 style={{ ...headingSt, fontSize: "26px", margin: "4px 0 0" }}>{course.title}</h1>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
            <StatusBadge status={course.status} />
            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>{course.programme_type}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
          <Link href={`/dashboard/courses/${courseId}/edit`} style={ghostBtn}>
            ✏ Edit Metadata
          </Link>
          <button
            onClick={handlePublish}
            disabled={publishingBtn(course.status) || publishing}
            style={{
              ...primaryBtn,
              background: course.status === "ACTIVE"
                ? "linear-gradient(135deg, #034852 0%, #006d6c 100%)"
                : "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
              opacity: publishing ? 0.7 : 1,
            }}
          >
            {publishing ? "Updating…" : course.status === "ACTIVE" ? "Unpublish" : "Publish Course"}
          </button>
        </div>
      </div>

      {globalError && (
        <div style={{ ...errorBox, marginBottom: "20px" }}>{globalError}</div>
      )}

      {/* ── Modules list ─────────────────────────────────────── */}
      <ModuleList
        courseId={courseId}
        modules={modules}
        setModules={setModules}
        onOpenSlideOver={(moduleId, lesson) => setSlideOver({ moduleId, lesson })}
        setGlobalError={setGlobalError}
      />

      {/* ── Lesson slide-over ─────────────────────────────────── */}
      {slideOver && (
        <LessonSlideOver
          moduleId={slideOver.moduleId}
          lesson={slideOver.lesson}
          onClose={() => setSlideOver(null)}
          onSaved={() => { setSlideOver(null); void reload(); }}
        />
      )}
    </Shell>
  );
}

// ── Module list (handles DnD + add module) ─────────────────────

function ModuleList({
  courseId,
  modules,
  setModules,
  onOpenSlideOver,
  setGlobalError,
}: {
  courseId: string;
  modules: CourseModule[];
  setModules: React.Dispatch<React.SetStateAction<CourseModule[]>>;
  onOpenSlideOver: (moduleId: string, lesson?: CourseLesson) => void;
  setGlobalError: (e: string | null) => void;
}) {
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [savingModule, setSavingModule] = useState(false);

  // DnD state for modules
  const dragModuleIdx = useRef<number | null>(null);
  const [dragOverModuleIdx, setDragOverModuleIdx] = useState<number | null>(null);

  function onModuleDragStart(idx: number) { dragModuleIdx.current = idx; }
  function onModuleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverModuleIdx(idx);
  }
  async function onModuleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    const fromIdx = dragModuleIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) { setDragOverModuleIdx(null); return; }
    const reordered = [...modules];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setModules(reordered);
    setDragOverModuleIdx(null);
    dragModuleIdx.current = null;
    try {
      await reorderModules(courseId, reordered.map((m) => m.id));
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Reorder failed.");
    }
  }
  function onModuleDragEnd() { dragModuleIdx.current = null; setDragOverModuleIdx(null); }

  async function handleAddModule() {
    if (!newModuleTitle.trim()) return;
    setSavingModule(true);
    try {
      const mod = await createModule(courseId, newModuleTitle.trim());
      setModules((prev) => [...prev, mod]);
      setNewModuleTitle("");
      setAddingModule(false);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to create module.");
    } finally {
      setSavingModule(false);
    }
  }

  return (
    <div>
      {modules.length === 0 && !addingModule && (
        <div style={{ ...glassCard, textAlign: "center", marginBottom: "20px" }}>
          <p style={labelSt}>No modules yet</p>
          <p style={{ ...subSt, marginTop: "8px" }}>Add your first module to start building the curriculum.</p>
        </div>
      )}

      {modules.map((mod, idx) => (
        <div
          key={mod.id}
          draggable
          onDragStart={() => onModuleDragStart(idx)}
          onDragOver={(e) => onModuleDragOver(e, idx)}
          onDrop={(e) => onModuleDrop(e, idx)}
          onDragEnd={onModuleDragEnd}
          style={{
            marginBottom: "16px",
            opacity: dragOverModuleIdx === idx ? 0.5 : 1,
            transition: "opacity 150ms",
          }}
        >
          <ModuleItem
            module={mod}
            courseId={courseId}
            setModules={setModules}
            onOpenSlideOver={onOpenSlideOver}
            setGlobalError={setGlobalError}
          />
        </div>
      ))}

      {/* Add Module inline form */}
      {addingModule ? (
        <div style={{ ...glassCard, display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            autoFocus
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAddModule(); if (e.key === "Escape") setAddingModule(false); }}
            placeholder="Module title…"
            style={{ ...inputSt, flex: 1 }}
          />
          <button onClick={() => void handleAddModule()} disabled={savingModule || !newModuleTitle.trim()} style={{ ...primaryBtn, opacity: savingModule ? 0.6 : 1 }}>
            {savingModule ? "Adding…" : "Add"}
          </button>
          <button onClick={() => { setAddingModule(false); setNewModuleTitle(""); }} style={ghostBtn}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAddingModule(true)} style={{ ...ghostBtn, width: "100%", justifyContent: "center", padding: "14px" }}>
          + Add Module
        </button>
      )}
    </div>
  );
}

// ── Module item ────────────────────────────────────────────────

function ModuleItem({
  module,
  courseId,
  setModules,
  onOpenSlideOver,
  setGlobalError,
}: {
  module: CourseModule;
  courseId: string;
  setModules: React.Dispatch<React.SetStateAction<CourseModule[]>>;
  onOpenSlideOver: (moduleId: string, lesson?: CourseLesson) => void;
  setGlobalError: (e: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(module.title);
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // DnD for lessons inside this module
  const dragLessonIdx = useRef<number | null>(null);
  const [dragOverLessonIdx, setDragOverLessonIdx] = useState<number | null>(null);

  function onLessonDragStart(idx: number) { dragLessonIdx.current = idx; }
  function onLessonDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); e.stopPropagation(); setDragOverLessonIdx(idx); }
  async function onLessonDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = dragLessonIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) { setDragOverLessonIdx(null); return; }
    const reordered = [...module.lessons];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setModules((prev) =>
      prev.map((m) => m.id === module.id ? { ...m, lessons: reordered } : m)
    );
    setDragOverLessonIdx(null);
    dragLessonIdx.current = null;
    try {
      await reorderLessons(module.id, reordered.map((l) => l.id));
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Lesson reorder failed.");
    }
  }
  function onLessonDragEnd() { dragLessonIdx.current = null; setDragOverLessonIdx(null); }

  async function saveTitle() {
    if (!editTitle.trim() || editTitle === module.title) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateModule(module.id, editTitle.trim());
      setModules((prev) => prev.map((m) => m.id === module.id ? { ...m, title: editTitle.trim() } : m));
      setEditing(false);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to update module.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteModule(module.id);
      setModules((prev) => prev.filter((m) => m.id !== module.id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Cannot delete module.");
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson?")) return;
    try {
      await deleteLesson(lessonId);
      setModules((prev) =>
        prev.map((m) =>
          m.id === module.id ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
        )
      );
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to delete lesson.");
    }
  }

  return (
    <div style={moduleCard}>
      {/* Module header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={dragHandle} title="Drag to reorder">⠿</span>
        {editing ? (
          <>
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void saveTitle(); if (e.key === "Escape") { setEditing(false); setEditTitle(module.title); } }}
              style={{ ...inputSt, flex: 1, fontSize: "15px", fontWeight: 700 }}
            />
            <button onClick={() => void saveTitle()} disabled={saving} style={{ ...primaryBtn, padding: "6px 14px", fontSize: "12px" }}>
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setEditTitle(module.title); }} style={{ ...ghostBtn, padding: "6px 12px", fontSize: "12px" }}>Cancel</button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "15px", color: "#034852" }}>{module.title}</span>
            <button onClick={() => setEditing(true)} style={iconBtn} title="Edit title">✏</button>
            <button
              onClick={() => { if (module.lessons.length > 0) { setDeleteError("Remove all lessons before deleting this module."); } else { void handleDelete(); } }}
              style={{ ...iconBtn, color: "#e53e3e" }}
              title="Delete module"
            >
              🗑
            </button>
          </>
        )}
      </div>

      {/* Module test indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "-6px 0 14px", paddingLeft: "28px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.55)" }}>
          Module Test
        </span>
        {module.module_quiz ? (
          <>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#034852" }}>
              {module.module_quiz.title}
            </span>
            <span style={{
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              background: module.module_quiz.published ? "rgba(10,190,98,0.12)" : "rgba(255,222,0,0.22)",
              color: module.module_quiz.published ? "#0abe62" : "#956f00",
            }}>
              {module.module_quiz.published ? "Published" : "Unpublished"}
            </span>
            {!module.module_quiz.published && (
              <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.45)" }}>
                (won’t show to students)
              </span>
            )}
            <Link
              href={`/dashboard/quiz-builder/${module.module_quiz.id}?course_id=${courseId}`}
              style={{ fontSize: "12px", fontWeight: 700, color: "#209379", textDecoration: "none" }}
              title="Edit module test"
            >
              Edit →
            </Link>
          </>
        ) : (
          <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>None</span>
        )}
      </div>

      {deleteError && <div style={{ ...errorBox, marginBottom: "12px" }}>{deleteError}</div>}

      {/* Lessons */}
      {module.lessons.length === 0 && (
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.4)", marginBottom: "12px", paddingLeft: "28px" }}>No lessons yet.</p>
      )}
      {module.lessons.map((lesson, idx) => (
        <div
          key={lesson.id}
          draggable
          onDragStart={() => onLessonDragStart(idx)}
          onDragOver={(e) => onLessonDragOver(e, idx)}
          onDrop={(e) => onLessonDrop(e, idx)}
          onDragEnd={onLessonDragEnd}
          style={{
            opacity: dragOverLessonIdx === idx ? 0.4 : 1,
            transition: "opacity 120ms",
          }}
        >
          <LessonRow
            lesson={lesson}
            onEdit={() => onOpenSlideOver(module.id, lesson)}
            onDelete={() => void handleDeleteLesson(lesson.id)}
          />
        </div>
      ))}

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button
          onClick={() => onOpenSlideOver(module.id)}
          style={{ ...ghostBtn, flex: 1, justifyContent: "center", padding: "10px", fontSize: "13px" }}
        >
          + Add Lesson
        </button>
        <Link
          href={`/dashboard/quiz-builder/new?module_id=${module.id}&course_id=${courseId}`}
          style={{ ...ghostBtn, flex: 1, justifyContent: "center", padding: "10px", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", color: "#209379", borderColor: "rgba(32,147,121,0.3)" }}
        >
          {module.module_quiz ? "+ New Module Test" : "+ Add Module Test"}
        </Link>
      </div>
    </div>
  );
}

// ── Lesson row ─────────────────────────────────────────────────

function LessonRow({ lesson, onEdit, onDelete }: { lesson: CourseLesson; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "10px",
      background: "rgba(3,72,82,0.03)",
      border: "1px solid rgba(3,72,82,0.07)",
      marginBottom: "6px",
      cursor: "grab",
    }}>
      <span style={{ ...dragHandle, fontSize: "14px" }}>⠿</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "#034852", flex: 1 }}>{lesson.title}</span>
      {lesson.duration_minutes && (
        <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)", whiteSpace: "nowrap" }}>{lesson.duration_minutes} min</span>
      )}
      <a href={lesson.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#209379", textDecoration: "none" }}>▶ Preview</a>
      <button onClick={onEdit} style={iconBtn} title="Edit">✏</button>
      <button onClick={onDelete} style={{ ...iconBtn, color: "#e53e3e" }} title="Delete">🗑</button>
    </div>
  );
}

// ── Lesson slide-over ──────────────────────────────────────────

function LessonSlideOver({
  moduleId,
  lesson,
  onClose,
  onSaved,
}: {
  moduleId: string;
  lesson?: CourseLesson;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(lesson?.youtube_url ?? "");
  const [duration, setDuration] = useState(lesson?.duration_minutes?.toString() ?? "");
  const [notes, setNotes] = useState(lesson?.notes_html ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (!youtubeUrl.trim()) { setError("YouTube URL is required."); return; }
    setSaving(true);
    try {
      if (lesson) {
        await updateLesson(lesson.id, {
          title: title.trim(),
          youtube_url: youtubeUrl.trim(),
          duration_minutes: duration ? Number(duration) : null,
          notes_html: notes.trim() || null,
        });
      } else {
        await createLesson(moduleId, {
          title: title.trim(),
          youtube_url: youtubeUrl.trim(),
          duration_minutes: duration ? Number(duration) : undefined,
          notes_html: notes.trim() || undefined,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,20,30,0.35)", zIndex: 40, backdropFilter: "blur(2px)" }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(480px, 100vw)",
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(24px)",
        boxShadow: "-16px 0 48px rgba(0,0,0,0.12)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Panel header */}
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={labelSt}>{lesson ? "Edit Lesson" : "Add Lesson"}</p>
            <h2 style={{ ...headingSt, fontSize: "18px", margin: "4px 0 0" }}>
              {lesson ? lesson.title : "New Lesson"}
            </h2>
          </div>
          <button onClick={onClose} style={{ ...iconBtn, fontSize: "18px", padding: "6px" }}>✕</button>
        </div>

        {/* Fields */}
        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          <FieldGroup label="Title *">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Python"
              style={inputSt}
            />
          </FieldGroup>

          <FieldGroup label="YouTube URL *">
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              style={inputSt}
            />
          </FieldGroup>

          <FieldGroup label="Duration (minutes)">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 12"
              style={{ ...inputSt, width: "120px" }}
            />
          </FieldGroup>

          <FieldGroup label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Supplementary notes, links, key points…"
              rows={8}
              style={{ ...inputSt, resize: "vertical" as const, fontFamily: "var(--font-body)" }}
            />
          </FieldGroup>

          {error && <div style={errorBox}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 32px", borderTop: "1px solid rgba(3,72,82,0.08)", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : lesson ? "Save Changes" : "Add Lesson"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Shared helpers ─────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: "800px", margin: "0 auto" }}>{children}</div>;
}

function LoadingCard() {
  return <div style={{ ...glassCard, textAlign: "center" }}><p style={labelSt}>Loading</p><p style={{ ...headingSt, marginTop: "12px" }}>Building your curriculum…</p></div>;
}

function ErrorCard({ message }: { message: string }) {
  return <div style={{ ...glassCard, textAlign: "center" }}><p style={labelSt}>Error</p><p style={{ ...headingSt, marginTop: "12px" }}>{message}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "ACTIVE" ? "#0abe62" : status === "ARCHIVED" ? "#e53e3e" : "#ffde00";
  const textColor = status === "DRAFT" ? "#034852" : status === "ACTIVE" ? "#fff" : "#fff";
  return (
    <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", background: color, color: textColor }}>
      {status}
    </span>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}

function publishingBtn(_status: string) { return false; }

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "32px 36px",
  boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
};

const moduleCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(3,72,82,0.1)",
  borderRadius: "18px",
  padding: "20px 24px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
};

const labelSt: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: "#209379",
  margin: 0,
};

const headingSt: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  color: "#034852",
  margin: 0,
};

const subSt: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.55)",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 22px",
  border: "none",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(10,190,98,0.2)",
  transition: "all 200ms ease",
  whiteSpace: "nowrap" as const,
  textDecoration: "none",
  display: "inline-block",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 18px",
  border: "1.5px solid rgba(3,72,82,0.2)",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.7)",
  color: "#034852",
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  transition: "all 180ms ease",
};

const iconBtn: React.CSSProperties = {
  padding: "5px 8px",
  border: "none",
  borderRadius: "8px",
  background: "transparent",
  color: "rgba(3,72,82,0.55)",
  fontSize: "14px",
  cursor: "pointer",
  transition: "background 150ms",
  flexShrink: 0,
};

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(3,72,82,0.03)",
  border: "1px solid rgba(3,72,82,0.12)",
  borderRadius: "10px",
  color: "#034852",
  fontFamily: "var(--font-body)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box" as const,
};

const dragHandle: React.CSSProperties = {
  fontSize: "16px",
  color: "rgba(3,72,82,0.3)",
  cursor: "grab",
  userSelect: "none",
  flexShrink: 0,
};

const errorBox: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "10px",
  background: "rgba(229,62,62,0.08)",
  border: "1px solid rgba(229,62,62,0.2)",
  fontSize: "13px",
  color: "#c53030",
  fontWeight: 500,
};
