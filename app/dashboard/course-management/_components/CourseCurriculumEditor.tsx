"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  deleteQuiz,
  getCourseModules,
  reorderModuleItems,
  reorderModules,
  updateLesson,
  updateModule,
  type CourseLesson,
  type CourseModule,
} from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { useBulkSaveJob } from "@/hooks/use-bulk-save-job";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { MoveQuizModal } from "@/app/dashboard/_components/MoveQuizModal";

export default function CourseCurriculumEditor({ courseId }: { courseId: string }) {
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [slideOver, setSlideOver] = useState<{ moduleId: string; lesson?: CourseLesson } | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getCourseModules(courseId);
      setModules(data);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Failed to load curriculum.");
    }
  }, [courseId]);

  useEffect(() => {
    setLoading(true);
    void reload().finally(() => setLoading(false));
  }, [reload]);

  // A bulk-uploaded module quiz is saved by a background worker, so it is not
  // in the curriculum yet when the user lands back here. Poll it in.
  const { jobId: uploadJobId, status: uploadStatus, expired: uploadExpired } = useBulkSaveJob({
    cleanupUrl: `/dashboard/course-management/${courseId}`,
    onCompleted: reload,
  });

  if (loading) {
    return (
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelSt}>Curriculum</p>
        <p style={{ ...headingSt, marginTop: "12px" }}>Loading module structure…</p>
      </div>
    );
  }

  return (
    <div>
      {globalError && <div style={{ ...errorBox, marginBottom: "16px" }}>{globalError}</div>}

      {uploadJobId && (
        <div style={uploadBanner}>
          <span>⏳ Bulk uploaded quiz — {uploadStatus}</span>
          <span style={{ opacity: 0.7 }}>It will appear in its module when saving finishes.</span>
        </div>
      )}

      {uploadExpired && (
        <div style={uploadBanner}>
          <span>This upload’s progress is no longer being tracked.</span>
          <span style={{ opacity: 0.7 }}>
            It may still have saved — reload the page to see the current curriculum.
          </span>
        </div>
      )}

      <div style={{ marginBottom: "18px" }}>
        <p style={labelSt}>Curriculum</p>
        <h3 style={{ ...headingSt, fontSize: "20px", marginTop: "4px" }}>Modules and lessons</h3>
        <p style={subSt}>Reorder modules, edit lessons, and manage module quizzes inside the course workspace.</p>
      </div>

      <ModuleList
        courseId={courseId}
        modules={modules}
        setModules={setModules}
        onOpenSlideOver={(moduleId, lesson) => setSlideOver({ moduleId, lesson })}
        setGlobalError={setGlobalError}
        onReload={reload}
      />

      {slideOver && (
        <LessonSlideOver
          moduleId={slideOver.moduleId}
          lesson={slideOver.lesson}
          onClose={() => setSlideOver(null)}
          onSaved={() => {
            setSlideOver(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function ModuleList({
  courseId,
  modules,
  setModules,
  onOpenSlideOver,
  setGlobalError,
  onReload,
}: {
  courseId: string;
  modules: CourseModule[];
  setModules: React.Dispatch<React.SetStateAction<CourseModule[]>>;
  onOpenSlideOver: (moduleId: string, lesson?: CourseLesson) => void;
  setGlobalError: (value: string | null) => void;
  onReload: () => Promise<void>;
}) {
  const invalidate = useInvalidate();
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [savingModule, setSavingModule] = useState(false);
  const dragModuleIdx = useRef<number | null>(null);
  const [dragOverModuleIdx, setDragOverModuleIdx] = useState<number | null>(null);

  const dragItemRef = useRef<{ moduleId: string; idx: number } | null>(null);
  const [dragOverItemInfo, setDragOverItemInfo] = useState<{ moduleId: string; idx: number } | null>(null);

  function onModuleDragStart(idx: number) {
    dragModuleIdx.current = idx;
  }

  function onModuleDragOver(event: React.DragEvent, idx: number) {
    if (dragItemRef.current) return;
    event.preventDefault();
    setDragOverModuleIdx(idx);
  }

  async function onModuleDrop(event: React.DragEvent, dropIdx: number) {
    event.preventDefault();
    const fromIdx = dragModuleIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) {
      setDragOverModuleIdx(null);
      return;
    }

    const reordered = [...modules];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setModules(reordered);
    setDragOverModuleIdx(null);
    dragModuleIdx.current = null;

    try {
      await reorderModules(courseId, reordered.map((item) => item.id));
      invalidate('courses');
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Module reorder failed.");
    }
  }

  async function handleAddModule() {
    if (!newModuleTitle.trim()) return;
    setSavingModule(true);
    try {
      const created = await createModule(courseId, newModuleTitle.trim());
      invalidate('courses');
      setModules((prev) => [...prev, created]);
      setNewModuleTitle("");
      setAddingModule(false);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Failed to create module.");
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

      {modules.map((module, idx) => (
        <div
          key={module.id}
          draggable
          onDragStart={() => onModuleDragStart(idx)}
          onDragOver={(event) => onModuleDragOver(event, idx)}
          onDrop={(event) => void onModuleDrop(event, idx)}
          onDragEnd={() => {
            dragModuleIdx.current = null;
            setDragOverModuleIdx(null);
          }}
          style={{ marginBottom: "16px", opacity: dragOverModuleIdx === idx ? 0.5 : 1 }}
        >
          <ModuleItem
            module={module}
            courseId={courseId}
            modules={modules}
            setModules={setModules}
            onOpenSlideOver={onOpenSlideOver}
            setGlobalError={setGlobalError}
            onReload={onReload}
            dragItemRef={dragItemRef}
            dragOverItemInfo={dragOverItemInfo}
            setDragOverItemInfo={setDragOverItemInfo}
          />
        </div>
      ))}

      {addingModule ? (
        <div style={{ ...glassCard, display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            autoFocus
            value={newModuleTitle}
            onChange={(event) => setNewModuleTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleAddModule();
              if (event.key === "Escape") {
                setAddingModule(false);
                setNewModuleTitle("");
              }
            }}
            placeholder="Module title…"
            style={{ ...inputSt, flex: 1 }}
          />
          <button
            onClick={() => void handleAddModule()}
            disabled={savingModule || !newModuleTitle.trim()}
            style={{ ...primaryBtn, opacity: savingModule ? 0.7 : 1 }}
          >
            {savingModule ? "Adding…" : "Add"}
          </button>
          <button
            onClick={() => {
              setAddingModule(false);
              setNewModuleTitle("");
            }}
            style={ghostBtn}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingModule(true)}
          style={{ ...ghostBtn, width: "100%", justifyContent: "center", padding: "14px" }}
        >
          + Add Module
        </button>
      )}
    </div>
  );
}

function ModuleItem({
  module,
  courseId,
  modules,
  setModules,
  onOpenSlideOver,
  setGlobalError,
  onReload,
  dragItemRef,
  dragOverItemInfo,
  setDragOverItemInfo,
}: {
  module: CourseModule;
  courseId: string;
  modules: CourseModule[];
  setModules: React.Dispatch<React.SetStateAction<CourseModule[]>>;
  onOpenSlideOver: (moduleId: string, lesson?: CourseLesson) => void;
  setGlobalError: (value: string | null) => void;
  onReload: () => Promise<void>;
  dragItemRef: React.MutableRefObject<{ moduleId: string; idx: number } | null>;
  dragOverItemInfo: { moduleId: string; idx: number } | null;
  setDragOverItemInfo: React.Dispatch<React.SetStateAction<{ moduleId: string; idx: number } | null>>;
}) {
  const invalidate = useInvalidate();
  const { has } = usePermissions();
  const canCreateQuiz = has(PERM.test_bank.create);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(module.title);
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [quizToMove, setQuizToMove] = useState<{ id: string; title: string } | null>(null);

  const items = [
    ...module.lessons.map(l => ({ ...l, itemType: 'LESSON' as const })),
    ...module.module_quizzes.map(q => ({ ...q, itemType: 'QUIZ' as const }))
  ].sort((a, b) => a.order_index - b.order_index);

  async function saveTitle() {
    if (!editTitle.trim() || editTitle === module.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateModule(module.id, editTitle.trim());
      invalidate('courses');
      setModules((prev) => prev.map((item) => (item.id === module.id ? { ...item, title: editTitle.trim() } : item)));
      setEditing(false);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Failed to update module.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteModule(module.id);
      invalidate('courses');
      setModules((prev) => prev.filter((item) => item.id !== module.id));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Cannot delete module.");
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson?")) return;
    try {
      await deleteLesson(lessonId);
      invalidate('courses');
      setModules((prev) =>
        prev.map((item) =>
          item.id === module.id ? { ...item, lessons: item.lessons.filter((lesson) => lesson.id !== lessonId) } : item,
        ),
      );
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Failed to delete lesson.");
    }
  }

  async function handleDeleteQuiz(quizId: string) {
    if (!confirm("Delete this quiz?")) return;
    try {
      await deleteQuiz(quizId);
      invalidate('courses');
      setModules((prev) =>
        prev.map((item) =>
          item.id === module.id ? { ...item, module_quizzes: item.module_quizzes.filter((quiz) => quiz.id !== quizId) } : item,
        ),
      );
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Failed to delete quiz.");
    }
  }

  async function onItemDrop(event: React.DragEvent, dropIdx: number, currentItems: typeof items) {
    event.preventDefault();
    event.stopPropagation();
    
    const dragInfo = dragItemRef.current;
    if (!dragInfo) {
      setDragOverItemInfo(null);
      return;
    }
    const { moduleId: sourceModuleId, idx: sourceIdx } = dragInfo;
    
    if (sourceModuleId === module.id && sourceIdx === dropIdx) {
      setDragOverItemInfo(null);
      dragItemRef.current = null;
      return;
    }

    const sourceModule = modules.find(m => m.id === sourceModuleId);
    if (!sourceModule) return;

    const sourceItems = [
      ...sourceModule.lessons.map(l => ({ ...l, itemType: 'LESSON' as const })),
      ...sourceModule.module_quizzes.map(q => ({ ...q, itemType: 'QUIZ' as const }))
    ].sort((a, b) => a.order_index - b.order_index);

    const targetItems = sourceModuleId === module.id ? sourceItems : [...currentItems];

    const [moved] = sourceItems.splice(sourceIdx, 1);
    targetItems.splice(dropIdx, 0, moved);
    
    targetItems.forEach((item, index) => {
      item.order_index = index;
    });

    if (sourceModuleId !== module.id) {
      sourceItems.forEach((item, index) => {
        item.order_index = index;
      });
    }

    const newTargetLessons = targetItems.filter(item => item.itemType === 'LESSON') as CourseLesson[];
    const newTargetQuizzes = targetItems.filter(item => item.itemType === 'QUIZ') as CourseModule['module_quizzes'];

    const newSourceLessons = sourceItems.filter(item => item.itemType === 'LESSON') as CourseLesson[];
    const newSourceQuizzes = sourceItems.filter(item => item.itemType === 'QUIZ') as CourseModule['module_quizzes'];

    setModules((prev) => prev.map((m) => {
      if (m.id === module.id) return { ...m, lessons: newTargetLessons, module_quizzes: newTargetQuizzes };
      if (m.id === sourceModuleId) return { ...m, lessons: newSourceLessons, module_quizzes: newSourceQuizzes };
      return m;
    }));

    setDragOverItemInfo(null);
    dragItemRef.current = null;
    
    try {
      if (sourceModuleId !== module.id) {
        await reorderModuleItems(sourceModuleId, sourceItems.map((item) => ({ id: item.id, type: item.itemType })));
      }
      await reorderModuleItems(module.id, targetItems.map((item) => ({ id: item.id, type: item.itemType })));
      invalidate('courses');
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Item reorder failed.");
    }
  }

  return (
    <div style={moduleCard}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={dragHandle} title="Drag to reorder">⠿</span>
        {editing ? (
          <>
            <input
              autoFocus
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveTitle();
                if (event.key === "Escape") {
                  setEditing(false);
                  setEditTitle(module.title);
                }
              }}
              style={{ ...inputSt, flex: 1, fontSize: "15px", fontWeight: 700 }}
            />
            <button onClick={() => void saveTitle()} disabled={saving} style={{ ...primaryBtn, padding: "6px 14px", fontSize: "12px" }}>
              {saving ? "…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditTitle(module.title);
              }}
              style={{ ...ghostBtn, padding: "6px 12px", fontSize: "12px" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "15px", color: "#034852" }}>
              {module.title}
            </span>
            <button onClick={() => setEditing(true)} style={{ fontSize: "12px", fontWeight: 700, color: "#209379", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>Edit</button>
            <button
              onClick={() => {
                if (items.length > 0) {
                  setDeleteError("Remove all items before deleting this module.");
                } else {
                  void handleDelete();
                }
              }}
              style={{ fontSize: "12px", fontWeight: 700, color: "#e53e3e", background: "none", border: "none", cursor: "pointer", padding: "4px" }}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {deleteError && <div style={{ ...errorBox, marginBottom: "12px" }}>{deleteError}</div>}

      {items.length === 0 && (
        <div 
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragOverItemInfo({ moduleId: module.id, idx: 0 });
          }}
          onDrop={(event) => void onItemDrop(event, 0, items)}
          style={{ opacity: dragOverItemInfo?.moduleId === module.id ? 0.4 : 1, padding: "8px 0" }}
        >
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.4)", marginBottom: "12px", paddingLeft: "28px" }}>No items yet.</p>
        </div>
      )}

      {items.map((item, idx) => (
        <div
          key={item.itemType + item.id}
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            dragItemRef.current = { moduleId: module.id, idx };
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragOverItemInfo({ moduleId: module.id, idx });
          }}
          onDrop={(event) => void onItemDrop(event, idx, items)}
          onDragEnd={(event) => {
            event.stopPropagation();
            dragItemRef.current = null;
            setDragOverItemInfo(null);
          }}
          style={{ opacity: dragOverItemInfo?.moduleId === module.id && dragOverItemInfo?.idx === idx ? 0.4 : 1 }}
        >
          {item.itemType === 'LESSON' ? (
            <LessonRow
              lesson={item}
              onEdit={() => onOpenSlideOver(module.id, item)}
              onDelete={() => void handleDeleteLesson(item.id)}
            />
          ) : (
            <QuizRow
              quiz={item}
              courseId={courseId}
              onDelete={() => void handleDeleteQuiz(item.id)}
              onMove={() => setQuizToMove({ id: item.id, title: item.title })}
            />
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
        <button
          onClick={() => onOpenSlideOver(module.id)}
          style={{ ...ghostBtn, flex: 1, justifyContent: "center", padding: "10px", fontSize: "13px" }}
        >
          + Add Lesson
        </button>
        {/* The destination page is gated on test_bank.create and the server
            re-checks course authority — this only avoids offering a dead end. */}
        {canCreateQuiz && (
          <Link
            href={`/dashboard/quiz-builder/new?module_id=${module.id}&course_id=${courseId}`}
            style={{
              ...ghostBtn,
              flex: 1,
              justifyContent: "center",
              padding: "10px",
              fontSize: "13px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              color: "#209379",
              borderColor: "rgba(32,147,121,0.3)",
            }}
          >
            + Add Module Quiz
          </Link>
        )}
      </div>

      {quizToMove && (
        <MoveQuizModal
          quizId={quizToMove.id}
          quizTitle={quizToMove.title}
          onClose={() => setQuizToMove(null)}
          onMoved={() => {
            setQuizToMove(null);
            invalidate('courses');
            // The quiz may have landed in another module of this course, so
            // reload the whole curriculum rather than patching this one.
            void onReload();
          }}
        />
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: CourseLesson;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        background: "rgba(3,72,82,0.03)",
        border: "1px solid rgba(3,72,82,0.07)",
        marginBottom: "6px",
        cursor: "grab",
      }}
    >
      <span style={{ ...dragHandle, fontSize: "14px" }}>⠿</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "#034852", flex: 1 }}>{lesson.title}</span>
      {lesson.duration_minutes && (
        <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)", whiteSpace: "nowrap" }}>{lesson.duration_minutes} min</span>
      )}
      <a href={lesson.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#209379", textDecoration: "none" }}>
        Preview
      </a>
      <button onClick={onEdit} style={{ fontSize: "11px", fontWeight: 700, color: "#209379", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>Edit</button>
      <button onClick={onDelete} style={{ fontSize: "11px", fontWeight: 700, color: "#e53e3e", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>Delete</button>
    </div>
  );
}

function QuizRow({
  quiz,
  courseId,
  onDelete,
  onMove,
}: {
  quiz: { id: string; title: string; published: boolean };
  courseId: string;
  onDelete: () => void;
  onMove: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        background: "rgba(3,72,82,0.03)",
        border: "1px solid rgba(3,72,82,0.07)",
        marginBottom: "6px",
        cursor: "grab",
      }}
    >
      <span style={{ ...dragHandle, fontSize: "14px" }}>⠿</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "#034852", flex: 1 }}>{quiz.title} (Quiz)</span>
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "999px",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.06em",
          background: quiz.published ? "rgba(10,190,98,0.12)" : "rgba(255,222,0,0.22)",
          color: quiz.published ? "#0abe62" : "#956f00",
        }}
      >
        {quiz.published ? "Published" : "Unpublished"}
      </span>
      <Link
        href={`/dashboard/quiz-builder/${quiz.id}?course_id=${courseId}`}
        style={{ fontSize: "11px", fontWeight: 700, color: "#209379", textDecoration: "none", padding: "4px" }}
      >
        Edit
      </Link>
      <button onClick={onMove} style={{ fontSize: "11px", fontWeight: 700, color: "#209379", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
        Move
      </button>
      <button onClick={onDelete} style={{ fontSize: "11px", fontWeight: 700, color: "#e53e3e", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
        Delete
      </button>
    </div>
  );
}

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
  const invalidate = useInvalidate();
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(lesson?.youtube_url ?? "");
  const [duration, setDuration] = useState(lesson?.duration_minutes?.toString() ?? "");
  const [notes, setNotes] = useState(lesson?.notes_html ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!youtubeUrl.trim()) {
      setError("YouTube URL is required.");
      return;
    }
    setSaving(true);
    try {
      if (lesson) {
        await updateLesson(lesson.id, {
          title: title.trim(),
          youtube_url: youtubeUrl.trim(),
          duration_minutes: duration ? Number(duration) : null,
          notes_html: notes.trim() || null,
        });
        invalidate('courses');
      } else {
        await createLesson(moduleId, {
          title: title.trim(),
          youtube_url: youtubeUrl.trim(),
          duration_minutes: duration ? Number(duration) : undefined,
          notes_html: notes.trim() || undefined,
        });
        invalidate('courses');
      }
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,20,30,0.35)", zIndex: 40, backdropFilter: "blur(2px)" }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          background: "rgba(255,255,255,0.96)",
          boxShadow: "-16px 0 48px rgba(0,0,0,0.12)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={labelSt}>{lesson ? "Edit Lesson" : "Add Lesson"}</p>
            <h2 style={{ ...headingSt, fontSize: "18px", margin: "4px 0 0" }}>{lesson ? lesson.title : "New Lesson"}</h2>
          </div>
          <button onClick={onClose} style={{ ...iconBtn, fontSize: "18px", padding: "6px" }}>✕</button>
        </div>

        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          <FieldGroup label="Title *">
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Introduction to Python" style={inputSt} />
          </FieldGroup>

          <FieldGroup label="YouTube URL *">
            <input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://youtube.com/watch?v=…" style={inputSt} />
          </FieldGroup>

          <FieldGroup label="Duration (minutes)">
            <input type="number" min={1} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="e.g. 12" style={{ ...inputSt, width: "120px" }} />
          </FieldGroup>

          <FieldGroup label="Notes">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Supplementary notes, links, key points…" rows={8} style={{ ...inputSt, resize: "vertical", fontFamily: "var(--font-body)" }} />
          </FieldGroup>

          {error && <div style={errorBox}>{error}</div>}
        </div>

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

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "32px 36px",
  boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
};

const moduleCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
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
  marginTop: "4px",
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
  whiteSpace: "nowrap",
  textDecoration: "none",
  display: "inline-block",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 18px",
  border: "1.5px solid rgba(3,72,82,0.2)",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#034852",
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  whiteSpace: "nowrap",
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
};

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid rgba(3,72,82,0.12)",
  background: "rgba(3,72,82,0.03)",
  fontSize: "14px",
  color: "#034852",
  outline: "none",
  boxSizing: "border-box",
};

const uploadBanner: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "10px 14px",
  borderRadius: "12px",
  marginBottom: "16px",
  background: "rgba(147,32,121,0.06)",
  border: "1px solid rgba(147,32,121,0.16)",
  color: "#932079",
  fontSize: "13px",
  fontWeight: 600,
};

const errorBox: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "12px",
  background: "rgba(229,62,62,0.08)",
  border: "1px solid rgba(229,62,62,0.16)",
  color: "#b83232",
  fontSize: "13px",
  fontWeight: 600,
};

const dragHandle: React.CSSProperties = {
  color: "rgba(3,72,82,0.35)",
  cursor: "grab",
  fontSize: "18px",
  lineHeight: 1,
};
