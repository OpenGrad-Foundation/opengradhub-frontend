"use client";

import { useState } from "react";
import Link from "next/link";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import { QuizQuestions } from "@/components/quiz-material-view";
import type { Course, ModuleWithProgress, LessonWithProgress } from "@/lib/api";
import type { MaterialNode } from "@/lib/duplicate-material";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

/**
 * How the course view sources its content.
 *
 *   live      the learner's or staff member's real course. Rows navigate to the
 *             lesson and quiz routes, progress and sequential locking apply.
 *   material  a duplicate-preview payload. Everything is already in hand, so
 *             rows open their content in place instead of navigating to routes
 *             that would refuse a course belonging to another programme.
 */
export type CourseViewVariant = "live" | "material";

export type CourseViewProps = {
  course: Course;
  modules: ModuleWithProgress[];
  courseId: string;
  /** Read-only: no progress column, no quiz taking. True for all staff. */
  isPreview: boolean;
  variant?: CourseViewVariant;
  /** material only: quiz id → its question tree, opened from the quiz row. */
  quizMaterial?: Record<string, MaterialNode>;
  /** Rendered in the header, where the progress panel sits for a learner. */
  headerAside?: React.ReactNode;
};

export function CourseView({
  course,
  modules,
  courseId,
  isPreview,
  variant = "live",
  quizMaterial,
  headerAside,
}: CourseViewProps) {
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.lessons.filter(l => l.is_complete).length, 0);
  const pct = totalLessons === 0 ? 0 : Math.round(100 * completedLessons / totalLessons);
  const isSequential = course.locking_mode === "SEQUENTIAL";

  return (
    <div>
      {/* ── Course header ─────────────────────────────────── */}
      <div style={{ ...glassCard, marginTop: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Cover thumbnail */}
          <div style={{
            width: "120px", height: "80px", borderRadius: "12px", flexShrink: 0,
            background: course.cover_image_url
              ? `url(${course.cover_image_url}) center/cover`
              : "linear-gradient(135deg, #006d6c 0%, #034852 100%)",
          }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <Pill>{course.programme_type}</Pill>
              <Pill>{course.locking_mode}</Pill>
            </div>
            <h1 style={{ ...S.heading, fontSize: "24px", margin: "0 0 8px" }}>{course.title}</h1>
            {course.description && (
              <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", margin: 0, lineHeight: 1.6 }}>{course.description}</p>
            )}
          </div>

          {/* Progress summary (learners) / preview badge (staff) */}
          {headerAside ?? (isPreview ? (
            <div style={{ flexShrink: 0, textAlign: "right", minWidth: "110px" }}>
              <span style={badgeStyle}>STAFF PREVIEW</span>
              <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: "8px 0 0" }}>{totalLessons} lessons</p>
            </div>
          ) : (
            <div style={{ flexShrink: 0, textAlign: "right", minWidth: "110px" }}>
              <p style={{ ...S.label, marginBottom: "6px" }}>Progress</p>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, color: pct === 100 ? "#0abe62" : "#034852", margin: 0 }}>{pct}%</p>
              <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: "4px 0 10px" }}>{completedLessons} / {totalLessons} lessons</p>
              <div style={{ height: "6px", borderRadius: "3px", background: "rgba(3,72,82,0.1)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: "3px", background: pct === 100 ? "#0abe62" : "linear-gradient(90deg, #0abe62, #209379)", transition: "width 600ms ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modules list ──────────────────────────────────── */}
      {modules.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={S.label}>No Content</p>
          <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>No lessons added yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {modules.map((mod, modIdx) => {
            const prevMod = modIdx > 0 ? modules[modIdx - 1] : null;
            return (
              <ModuleSection
                key={mod.id}
                module={mod}
                courseId={courseId}
                isSequential={isSequential}
                isPreview={isPreview}
                variant={variant}
                quizMaterial={quizMaterial}
                prevModuleTitle={prevMod?.title ?? ""}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Module Section ─────────────────────────────────────────────

function ModuleSection({ module, courseId, isSequential, isPreview, variant, quizMaterial, prevModuleTitle }: {
  module: ModuleWithProgress;
  courseId: string;
  isSequential: boolean;
  isPreview: boolean;
  variant: CourseViewVariant;
  quizMaterial?: Record<string, MaterialNode>;
  prevModuleTitle: string;
}) {
  const currentUrl = useCurrentUrl();
  const done  = module.lessons.filter(l => l.is_complete).length;
  const total = module.lessons.length;
  const allDone = module.is_module_complete;
  const isModuleLocked = isSequential && !isPreview && module.is_locked;

  const items = [
    ...module.lessons.map(l => ({ ...l, itemType: 'LESSON' as const })),
    // An unpublished quiz is hidden from the live course but still travels with
    // a duplicate, so the material variant lists every one of them.
    ...module.module_quizzes
      .filter(q => variant === "material" || q.published)
      .map(q => ({ ...q, itemType: 'QUIZ' as const })),
  ].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  return (
    <div style={{ ...glassCard, opacity: isModuleLocked ? 0.7 : 1 }}>
      {/* Module header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ ...S.heading, fontSize: "17px", margin: 0 }}>{module.title}</h2>
          {isModuleLocked && <span style={{ fontSize: "14px" }}>🔒</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isPreview ? (
            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", fontWeight: 600 }}>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <>
              <span style={{ fontSize: "12px", color: allDone ? "#0abe62" : "rgba(3,72,82,0.5)", fontWeight: 600 }}>
                {done} / {total} lessons complete
              </span>
              {allDone && <span style={{ fontSize: "14px" }}>✓</span>}
            </>
          )}
        </div>
      </div>

      {isModuleLocked && (
        <div style={{
          padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
          background: "rgba(3,72,82,0.04)", border: "1px solid rgba(3,72,82,0.08)",
          fontSize: "12px", color: "rgba(3,72,82,0.5)", textAlign: "center",
        }}>
          🔒 Complete &ldquo;{prevModuleTitle}&rdquo; to unlock this module
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.4)", margin: 0 }}>No content in this module.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {items.map((item, idx) => {
            const isStudent = !isPreview;
            const isItemLocked = isStudent && isSequential && (isModuleLocked || (idx > 0 && !items[idx - 1].is_complete));
            const lockTooltip = isModuleLocked
              ? `Complete "${prevModuleTitle}" module to unlock`
              : idx > 0 && !items[idx - 1].is_complete
                ? `Complete "${items[idx - 1].title}" to unlock`
                : null;

            if (item.itemType === 'LESSON') {
              return (
                <LessonRow
                  key={item.itemType + item.id}
                  lesson={item as LessonWithProgress}
                  index={idx}
                  courseId={courseId}
                  isLast={idx === items.length - 1}
                  isLocked={isItemLocked}
                  lockTooltip={lockTooltip}
                  currentUrl={currentUrl}
                  variant={variant}
                />
              );
            }
            return (
              <QuizRow
                key={item.itemType + item.id}
                quiz={item as { id: string; title: string; published: boolean; is_complete?: boolean }}
                isLast={idx === items.length - 1}
                isPreview={isPreview}
                isLocked={isItemLocked}
                lockTooltip={lockTooltip}
                currentUrl={currentUrl}
                variant={variant}
                material={quizMaterial?.[item.id]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Lesson Row ─────────────────────────────────────────────────

function LessonRow({ lesson, index, courseId, isLast, isLocked, lockTooltip, currentUrl, variant }: {
  lesson: LessonWithProgress;
  index: number;
  courseId: string;
  isLast: boolean;
  isLocked: boolean | null;
  lockTooltip: string | null;
  currentUrl: string;
  variant: CourseViewVariant;
}) {
  const [tooltip, setTooltip] = useState(false);
  const [open, setOpen] = useState(false);
  const isMaterial = variant === "material";

  const content = (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 4px",
        borderBottom: isLast && !open ? "none" : "1px solid rgba(3,72,82,0.06)",
        opacity: isLocked ? 0.5 : 1,
        cursor: isLocked ? "not-allowed" : "pointer",
        transition: "background 150ms ease",
        borderRadius: isLast ? "0 0 12px 12px" : "0",
        position: "relative",
      }}
      onMouseEnter={() => isLocked && setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      {/* Completion indicator */}
      <div style={{
        width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: lesson.is_complete ? "rgba(10,190,98,0.12)" : "rgba(3,72,82,0.06)",
        border: `1.5px solid ${lesson.is_complete ? "#0abe62" : "rgba(3,72,82,0.15)"}`,
        fontSize: "11px",
        color: lesson.is_complete ? "#0abe62" : "rgba(3,72,82,0.3)",
      }}>
        {lesson.is_complete ? "✓" : (index + 1)}
      </div>

      {/* Title + duration */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", lineHeight: 1.3 }}>
          {lesson.title}
        </p>
        {lesson.duration_minutes && (
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>
            {lesson.duration_minutes} min
          </p>
        )}
      </div>

      {/* Lock / play icon */}
      {isLocked ? (
        <span style={{ fontSize: "16px", color: "rgba(3,72,82,0.3)", flexShrink: 0 }}>🔒</span>
      ) : (
        <span style={{ fontSize: "14px", color: "#209379", flexShrink: 0 }}>{isMaterial ? (open ? "▾" : "▸") : "▶"}</span>
      )}

      {/* Tooltip */}
      {tooltip && lockTooltip && (
        <div style={tooltipStyle}>{lockTooltip}</div>
      )}
    </div>
  );

  if (isMaterial) {
    return (
      <div>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        >
          {content}
        </div>
        {open && (
          <div style={panelStyle}>
            {lesson.youtube_url && (
              <a href={lesson.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#209379", fontWeight: 600 }}>
                Open lesson video ↗
              </a>
            )}
            {lesson.notes_html
              ? <MathContent html={lesson.notes_html} style={{ fontSize: "14px", color: "#034852" }} />
              : <p style={{ margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.45)" }}>This lesson has no notes.</p>}
          </div>
        )}
      </div>
    );
  }

  if (isLocked) return content;

  return (
    <Link href={withFrom(`/dashboard/courses/${courseId}/lessons/${lesson.id}`, currentUrl)} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
}

// ── Quiz Row ─────────────────────────────────────────────────

function QuizRow({ quiz, isLast, isPreview, isLocked, lockTooltip, currentUrl, variant, material }: {
  quiz: { id: string; title: string; published: boolean; is_complete?: boolean };
  isLast: boolean;
  isPreview: boolean;
  isLocked: boolean | null;
  lockTooltip: string | null;
  currentUrl: string;
  variant: CourseViewVariant;
  material?: MaterialNode;
}) {
  const [tooltip, setTooltip] = useState(false);
  const [open, setOpen] = useState(false);
  const isMaterial = variant === "material";

  const content = (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 4px",
        borderBottom: isLast && !open ? "none" : "1px solid rgba(3,72,82,0.06)",
        opacity: isLocked ? 0.5 : 1,
        cursor: isMaterial ? "pointer" : isPreview ? "default" : isLocked ? "not-allowed" : "pointer",
        transition: "background 150ms ease",
        borderRadius: isLast ? "0 0 12px 12px" : "0",
        position: "relative",
      }}
      onMouseEnter={() => isLocked && setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <div style={{
        width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: quiz.is_complete ? "rgba(10,190,98,0.12)" : isLocked ? "rgba(3,72,82,0.06)" : "rgba(10,190,98,0.1)",
        border: `1.5px solid ${quiz.is_complete ? "#0abe62" : isLocked ? "rgba(3,72,82,0.15)" : "#0abe62"}`,
        fontSize: "11px", color: quiz.is_complete ? "#0abe62" : isLocked ? "rgba(3,72,82,0.3)" : "#0abe62", fontWeight: 700,
      }}>
        {quiz.is_complete ? "✓" : "✎"}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852" }}>
          {quiz.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>
          Module quiz
        </p>
      </div>
      {isMaterial ? (
        <span style={{ fontSize: "14px", color: "#209379", flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      ) : !isPreview && (
        <span style={{ fontSize: "14px", color: isLocked ? "rgba(3,72,82,0.3)" : "#209379", flexShrink: 0 }}>
          {isLocked ? "🔒" : "▶"}
        </span>
      )}
      {tooltip && lockTooltip && (
        <div style={tooltipStyle}>{lockTooltip}</div>
      )}
    </div>
  );

  if (isMaterial) {
    return (
      <div>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        >
          {content}
        </div>
        {open && (
          <div style={panelStyle}>
            <QuizQuestions
              sections={material?.sections as Parameters<typeof QuizQuestions>[0]["sections"]}
              questions={material?.questions as Parameters<typeof QuizQuestions>[0]["questions"]}
            />
          </div>
        )}
      </div>
    );
  }

  if (isPreview || isLocked) return content;

  return (
    <Link href={withFrom(`/dashboard/quiz/${quiz.id}`, currentUrl)} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
}

// ── Small helpers ──────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "100px",
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
      background: "rgba(32,147,121,0.12)", color: "#209379",
    }}>
      {children}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────

export const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "28px 32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};

const panelStyle: React.CSSProperties = {
  padding: "12px 16px 16px 34px",
  borderBottom: "1px solid rgba(3,72,82,0.06)",
  display: "flex", flexDirection: "column", gap: "10px",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block", padding: "4px 12px", borderRadius: "100px",
  fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
  background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.6)",
};

const tooltipStyle: React.CSSProperties = {
  position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
  transform: "translateX(-50%)",
  background: "#034852", color: "#fff", borderRadius: "8px",
  padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap",
  pointerEvents: "none", zIndex: 10,
  boxShadow: "0 4px 12px rgba(3,72,82,0.3)",
};

export const S = {
  label: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.28em", color: "#209379", margin: 0,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852",
  } as React.CSSProperties,
  primaryBtn: {
    padding: "10px 20px", border: "none", borderRadius: "10px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
    fontSize: "13px", cursor: "pointer",
  } as React.CSSProperties,
};
