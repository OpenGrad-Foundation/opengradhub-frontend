"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, GripVertical, MoreHorizontal, Pencil, Play, FileQuestion, Plus, Trash2 } from "lucide-react";
import styles from "../management.module.css";
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
import { extractYoutubeId, probeYoutubeDurationSeconds } from "@/lib/youtube";
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
    return <div role="status" aria-label="Loading curriculum" className={styles.loading}><div /><div /><span className="sr-only">Loading modules…</span></div>;
  }

  return (
    <div className={styles.editor}>
      {globalError && <div style={{ ...errorBox, marginBottom: "16px" }}>{globalError}</div>}

      {uploadJobId && (
        <div style={uploadBanner}>
          <span>Quiz upload: {uploadStatus}</span>
          <span style={{ opacity: 0.7 }}>It will appear in its module when saving finishes.</span>
        </div>
      )}

      {uploadExpired && (
        <div style={uploadBanner}>
          <span>This upload’s progress is no longer being tracked.</span>
          <span style={{ opacity: 0.7 }}>
            Reload to check whether the quiz has been saved.
          </span>
        </div>
      )}

      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ ...headingSt, fontSize: "20px", marginTop: "4px" }}>Modules and lessons</h3>
        <p style={subSt}>{modules.length} modules · {modules.reduce((count, module) => count + module.lessons.length, 0)} lessons · {modules.reduce((count, module) => count + module.module_quizzes.length, 0)} quizzes</p>
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
        <div className={styles.addModuleForm}>
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
            aria-label="New module title"
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
          <Plus size={16} aria-hidden="true" /> Add module
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
  const [expanded, setExpanded] = useState(module.order_index === 0);
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
    <section className={styles.module}>
      <div className={styles.moduleHeader}>
        <GripVertical size={16} className={styles.dragHandle} aria-hidden="true" />
        {editing ? (
          <>
            <input
              autoFocus
              aria-label="Module title"
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
            <button type="button" className={styles.moduleToggle} aria-expanded={expanded} aria-controls={`module-${module.id}`} onClick={() => setExpanded(!expanded)}>
              <span><span className={styles.moduleNumber}>Module {module.order_index + 1}</span><strong>{module.title}</strong><span className={styles.moduleCount}>{module.lessons.length} lessons · {module.module_quizzes.length} {module.module_quizzes.length === 1 ? "quiz" : "quizzes"}</span></span>
              <ChevronDown size={18} aria-hidden="true" className={expanded ? styles.chevronOpen : undefined} />
            </button>
            <button type="button" aria-label={`Rename ${module.title}`} title="Rename module" onClick={() => setEditing(true)} className={styles.iconButton}><Pencil size={16} aria-hidden="true" /></button>
            <button
              onClick={() => {
                if (items.length > 0) {
                  setDeleteError("Remove all items before deleting this module.");
                } else {
                  void handleDelete();
                }
              }}
              className={styles.iconButton} aria-label={`Delete module ${module.title}`} title="Delete module"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {deleteError && <div style={{ ...errorBox, marginBottom: "12px" }}>{deleteError}</div>}

      <div id={`module-${module.id}`} hidden={!expanded} className={styles.moduleBody}>
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
          <Plus size={16} aria-hidden="true" /> Add lesson
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
            <Plus size={16} aria-hidden="true" /> Add quiz
          </Link>
        )}
      </div>

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
    </section>
  );
}

function LessonRow({ lesson, onEdit, onDelete }: { lesson: CourseLesson; onEdit: () => void; onDelete: () => void }) {
  return <div className={styles.itemRow}>
    <GripVertical size={14} className={styles.dragHandle} aria-hidden="true" />
    <Play size={16} className={styles.itemIcon} aria-hidden="true" />
    <button type="button" className={styles.itemTitle} onClick={onEdit}><strong>{lesson.title}</strong><span>Lesson{lesson.duration_minutes ? ` · ${lesson.duration_minutes} min` : ""}</span></button>
    <details className={styles.itemMenu}>
      <summary aria-label={`Actions for ${lesson.title}`}><MoreHorizontal size={20} aria-hidden="true" /></summary>
      <div>
        <button type="button" onClick={onEdit}>Edit lesson</button>
        <a href={lesson.youtube_url} target="_blank" rel="noopener noreferrer">Preview video</a>
        <button type="button" className={styles.danger} onClick={onDelete}>Delete lesson</button>
      </div>
    </details>
  </div>;
}

function QuizRow({ quiz, courseId, onDelete, onMove }: { quiz: { id: string; title: string; published: boolean }; courseId: string; onDelete: () => void; onMove: () => void }) {
  return <div className={styles.itemRow}>
    <GripVertical size={14} className={styles.dragHandle} aria-hidden="true" />
    <FileQuestion size={16} className={styles.itemIcon} aria-hidden="true" />
    <Link href={`/dashboard/quiz-builder/${quiz.id}?course_id=${courseId}`} className={styles.itemTitle}><strong>{quiz.title}</strong><span>Quiz · {quiz.published ? "Published" : "Draft"}</span></Link>
    <details className={styles.itemMenu}>
      <summary aria-label={`Actions for ${quiz.title}`}><MoreHorizontal size={20} aria-hidden="true" /></summary>
      <div>
        <Link href={`/dashboard/quiz-builder/${quiz.id}?course_id=${courseId}`}>Edit quiz</Link>
        <button type="button" onClick={onMove}>Move quiz</button>
        <button type="button" className={styles.danger} onClick={onDelete}>Delete quiz</button>
      </div>
    </details>
  </div>;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  const invalidate = useInvalidate();
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(lesson?.youtube_url ?? "");
  const [duration, setDuration] = useState(lesson?.duration_minutes?.toString() ?? "");
  const [notes, setNotes] = useState(lesson?.notes_html ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Duration autofill ──────────────────────────────────────────
  // Read the length straight off a hidden IFrame player rather than asking the
  // YouTube Data API, so no API key or quota is involved. Only ever *fills* an
  // empty field — a duration the author typed is never overwritten.
  const [probingDuration, setProbingDuration] = useState(false);
  const probedUrlRef = useRef<string | null>(null);

  const autofillDuration = useCallback(async (rawUrl: string) => {
    const videoId = extractYoutubeId(rawUrl);
    if (!videoId || probedUrlRef.current === rawUrl) return;
    probedUrlRef.current = rawUrl;

    setProbingDuration(true);
    const seconds = await probeYoutubeDurationSeconds(videoId);
    setProbingDuration(false);
    if (seconds == null) return; // private / embed-disabled / offline — stay silent

    // Guard against a slow probe landing after the author typed their own value.
    setDuration((current) => (current.trim() ? current : String(Math.max(1, Math.round(seconds / 60)))));
  }, []);

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
      <dialog ref={dialogRef} className={styles.lessonDrawer} aria-label={lesson ? "Edit lesson" : "Add lesson"} onCancel={event => { event.preventDefault(); onClose(); }}>
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={labelSt}>{lesson ? "Edit Lesson" : "Add Lesson"}</p>
            <h2 style={{ ...headingSt, fontSize: "18px", margin: "4px 0 0" }}>{lesson ? lesson.title : "New Lesson"}</h2>
          </div>
          <button aria-label="Close lesson editor" onClick={onClose} style={{ ...iconBtn, fontSize: "18px", padding: "6px" }}>✕</button>
        </div>

        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          <FieldGroup label="Title *">
            <input aria-label="Title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Introduction to Python" style={inputSt} />
          </FieldGroup>

          <FieldGroup label="YouTube URL *">
            <input
              aria-label="YouTube URL"
              value={youtubeUrl}
              onChange={(event) => {
                setYoutubeUrl(event.target.value);
                void autofillDuration(event.target.value);
              }}
              onBlur={(event) => void autofillDuration(event.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              style={inputSt}
            />
          </FieldGroup>

          <FieldGroup label="Duration (minutes)">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input aria-label="Duration (minutes)" type="number" min={1} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="e.g. 12" style={{ ...inputSt, width: "120px" }} />
              {probingDuration && (
                <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>Reading from YouTube…</span>
              )}
            </div>
          </FieldGroup>

          <FieldGroup label="Notes">
            <textarea aria-label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Supplementary notes, links, key points…" rows={8} style={{ ...inputSt, resize: "vertical", fontFamily: "var(--font-body)" }} />
          </FieldGroup>

          {error && <div role="alert" style={errorBox}>{error}</div>}
        </div>

        <div style={{ padding: "20px 32px", borderTop: "1px solid rgba(3,72,82,0.08)", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : lesson ? "Save Changes" : "Add Lesson"}
          </button>
        </div>
      </dialog>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", fontWeight: 700,  letterSpacing: "0.06em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "12px",
  padding: "20px",

};

const labelSt: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,


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
  minHeight: "44px",
  padding: "10px 16px",
  border: "none",
  borderRadius: "12px",
  background: "var(--green)",
  color: "var(--dark-teal)",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",

  transition: "all 200ms ease",
  whiteSpace: "nowrap",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const ghostBtn: React.CSSProperties = {
  minHeight: "44px",
  padding: "10px 16px",
  border: "1.5px solid rgba(3,72,82,0.2)",
  borderRadius: "12px",
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

  boxSizing: "border-box",
};

const uploadBanner: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "10px 14px",
  borderRadius: "12px",
  marginBottom: "16px",
  background: "var(--color-success-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--dark-teal)",
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
