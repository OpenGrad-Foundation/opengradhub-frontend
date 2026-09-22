"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Lock, PencilLine, Play } from "lucide-react";
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
              <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6 }}>{course.description}</p>
            )}
          </div>

          {/* Progress summary (learners) / preview badge (staff) */}
          {headerAside ?? (isPreview ? (
            <div style={{ flexShrink: 0, textAlign: "right", minWidth: "110px" }}>
              <span style={badgeStyle}>Staff preview</span>
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "8px 0 0" }}>{totalLessons} lessons</p>
            </div>
          ) : (
            <div style={{ flexShrink: 0, textAlign: "right", minWidth: "110px" }}>
              <p style={{ ...S.label, marginBottom: "6px" }}>Progress</p>
              <p style={{ fontSize: "28px", fontWeight: 700, color: pct === 100 ? "#08784a" : "var(--color-text)", margin: 0 }}>{pct}%</p>
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "4px 0 10px" }}>{completedLessons} / {totalLessons} lessons</p>
              <div style={{ height: "6px", borderRadius: "3px", background: "var(--color-border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: "3px", background: "var(--green)", transition: "width 600ms ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modules list ──────────────────────────────────── */}
      {modules.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={S.label}>No content</p>
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
          {isModuleLocked && <Lock size={14} aria-hidden="true" style={{ color: "var(--color-text-muted)" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isPreview ? (
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 600 }}>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <>
              <span style={{ fontSize: "12px", color: allDone ? "#08784a" : "var(--color-text-muted)", fontWeight: 600 }}>
                {done} / {total} lessons complete
              </span>
              {allDone && <Check size={14} aria-hidden="true" style={{ color: "#08784a" }} />}
            </>
          )}
        </div>
      </div>

      {isModuleLocked && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          padding: "10px 14px", borderRadius: "8px", marginBottom: "12px",
          background: "var(--color-surface-sunken)", border: "1px solid var(--color-border)",
          fontSize: "12px", color: "var(--color-text-muted)", textAlign: "center",
        }}>
          <Lock size={12} aria-hidden="true" /> Complete &ldquo;{prevModuleTitle}&rdquo; to unlock this module
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>No content in this module.</p>
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
        borderBottom: isLast && !open ? "none" : "1px solid var(--color-border)",
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
        background: lesson.is_complete ? "rgba(10,190,98,0.12)" : "var(--color-surface)",
        border: `1.5px solid ${lesson.is_complete ? "#08784a" : "var(--color-border-strong)"}`,
        fontSize: "11px",
        color: lesson.is_complete ? "#08784a" : "var(--color-text-muted)",
      }}>
        {lesson.is_complete ? <Check size={12} aria-hidden="true" /> : (index + 1)}
      </div>

      {/* Title + duration */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", lineHeight: 1.3 }}>
          {lesson.title}
        </p>
        {lesson.duration_minutes && (
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
            {lesson.duration_minutes} min
          </p>
        )}
      </div>

      {/* Lock / play icon */}
      {isLocked ? (
        <Lock size={16} aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
      ) : (
        <span style={iconSlot}>{isMaterial ? (open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />) : <Play size={14} aria-hidden="true" />}</span>
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
              <a href={lesson.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#08784a", fontWeight: 600 }}>
                Open lesson video ↗
              </a>
            )}
            {lesson.notes_html
              ? <MathContent html={lesson.notes_html} style={{ fontSize: "14px", color: "var(--color-text)" }} />
              : <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>This lesson has no notes.</p>}
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
        borderBottom: isLast && !open ? "none" : "1px solid var(--color-border)",
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
        background: quiz.is_complete ? "rgba(10,190,98,0.12)" : isLocked ? "var(--color-surface)" : "rgba(10,190,98,0.1)",
        border: `1.5px solid ${isLocked && !quiz.is_complete ? "var(--color-border-strong)" : "#08784a"}`,
        fontSize: "11px", color: isLocked && !quiz.is_complete ? "var(--color-text-muted)" : "#08784a", fontWeight: 700,
      }}>
        {quiz.is_complete ? <Check size={12} aria-hidden="true" /> : <PencilLine size={12} aria-hidden="true" />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
          {quiz.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
          Module quiz
        </p>
      </div>
      {isMaterial ? (
        <span style={iconSlot}>{open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</span>
      ) : !isPreview && (
        <span style={{ ...iconSlot, color: isLocked ? "var(--color-text-muted)" : iconSlot.color }}>
          {isLocked ? <Lock size={16} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
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
      display: "inline-block", padding: "3px 8px", borderRadius: "6px",
      fontSize: "12px", fontWeight: 600,
      background: "rgba(32,147,121,0.12)", color: "#08784a",
    }}>
      {children}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────

export const glassCard: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)",
};

const iconSlot: React.CSSProperties = { display: "inline-flex", color: "#08784a", flexShrink: 0 };

const panelStyle: React.CSSProperties = {
  padding: "12px 16px 16px 34px",
  borderBottom: "1px solid var(--color-border)",
  display: "flex", flexDirection: "column", gap: "10px",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block", padding: "3px 8px", borderRadius: "6px",
  fontSize: "12px", fontWeight: 600,
  background: "var(--color-surface-sunken)", color: "var(--color-text-muted)",
};

const tooltipStyle: React.CSSProperties = {
  position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
  transform: "translateX(-50%)",
  background: "var(--color-text)", color: "var(--color-surface)", borderRadius: "8px",
  padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap",
  pointerEvents: "none", zIndex: 10,
};

export const S = {
  label: {
    fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0,
  } as React.CSSProperties,
  heading: {
    fontWeight: 700, color: "var(--color-text)",
  } as React.CSSProperties,
  primaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
    minHeight: "44px", padding: "8px 16px", border: "1px solid var(--green)", borderRadius: "12px",
    background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600,
    fontSize: "14px", cursor: "pointer", textDecoration: "none",
  } as React.CSSProperties,
  secondaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
    minHeight: "44px", padding: "8px 16px", border: "1px solid var(--color-border)", borderRadius: "12px",
    background: "var(--color-surface)", color: "var(--color-text)", fontWeight: 600,
    fontSize: "14px", cursor: "pointer", textDecoration: "none",
  } as React.CSSProperties,
};
