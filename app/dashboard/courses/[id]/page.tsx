"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getCourseById, getCourseOverview, type Course, type ModuleWithProgress, type LessonWithProgress } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

// ── Page ───────────────────────────────────────────────────────

export default function CourseOverviewPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const roleCode = (userData?.role?.code ?? "") as RoleCode;
  const studentId = userData?.user?.id ?? "";

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading || !studentId) return;
    setLoading(true);
    Promise.all([
      getCourseById(courseId),
      getCourseOverview(courseId, studentId),
    ])
      .then(([c, m]) => { setCourse(c); setModules(m); })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load course."))
      .finally(() => setLoading(false));
  }, [userLoading, courseId, studentId]);

  if (loading || userLoading) return <LoadingState />;

  if (error || !course) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Error</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>{error ?? "Course not found."}</p>
        <Link href="/dashboard/courses" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>← Back to Courses</Link>
      </div>
    );
  }

  // Compute totals
  const totalLessons     = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.lessons.filter(l => l.is_complete).length, 0);
  const pct = totalLessons === 0 ? 0 : Math.round(100 * completedLessons / totalLessons);
  const isSequential = course.locking_mode === "SEQUENTIAL";

  return (
    <div>
      {/* ── Back link ─────────────────────────────────────── */}
      <Link href="/dashboard/courses" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← My Courses
      </Link>

      {/* ── Course header ─────────────────────────────────── */}
      <div style={{ ...glassCard, marginTop: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
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

          {/* Progress summary */}
          <div style={{ flexShrink: 0, textAlign: "right", minWidth: "110px" }}>
            <p style={{ ...S.label, marginBottom: "6px" }}>Progress</p>
            <p style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, color: pct === 100 ? "#0abe62" : "#034852", margin: 0 }}>{pct}%</p>
            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: "4px 0 10px" }}>{completedLessons} / {totalLessons} lessons</p>
            <div style={{ height: "6px", borderRadius: "3px", background: "rgba(3,72,82,0.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: "3px", background: pct === 100 ? "#0abe62" : "linear-gradient(90deg, #0abe62, #209379)", transition: "width 600ms ease" }} />
            </div>
          </div>
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
            const prevModuleComplete = !prevMod || (prevMod.lessons.length > 0 && prevMod.lessons.every(l => l.is_complete));
            return (
              <ModuleSection
                key={mod.id}
                module={mod}
                courseId={courseId}
                isSequential={isSequential}
                roleCode={roleCode}
                prevModuleComplete={prevModuleComplete}
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

function ModuleSection({ module, courseId, isSequential, roleCode, prevModuleComplete, prevModuleTitle }: {
  module: ModuleWithProgress;
  courseId: string;
  isSequential: boolean;
  roleCode: RoleCode;
  prevModuleComplete: boolean;
  prevModuleTitle: string;
}) {
  const done  = module.lessons.filter(l => l.is_complete).length;
  const total = module.lessons.length;
  const allDone = total > 0 && done === total;
  const isModuleLocked = isSequential && roleCode === "STUDENT" && !prevModuleComplete;

  return (
    <div style={{ ...glassCard, opacity: isModuleLocked ? 0.7 : 1 }}>
      {/* Module header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ ...S.heading, fontSize: "17px", margin: 0 }}>{module.title}</h2>
          {isModuleLocked && <span style={{ fontSize: "14px" }}>🔒</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: allDone ? "#0abe62" : "rgba(3,72,82,0.5)", fontWeight: 600 }}>
            {done} / {total} complete
          </span>
          {allDone && <span style={{ fontSize: "14px" }}>✓</span>}
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

      {/* Lessons */}
      {module.lessons.length === 0 ? (
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.4)", margin: 0 }}>No lessons in this module.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {module.lessons.map((lesson, idx) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={idx}
              module={module}
              courseId={courseId}
              isSequential={isSequential}
              isLast={idx === module.lessons.length - 1}
              roleCode={roleCode}
              isModuleLocked={isModuleLocked}
              prevModuleTitle={prevModuleTitle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lesson Row ─────────────────────────────────────────────────

function LessonRow({ lesson, index, module, courseId, isSequential, isLast, roleCode, isModuleLocked, prevModuleTitle }: {
  lesson: LessonWithProgress;
  index: number;
  module: ModuleWithProgress;
  courseId: string;
  isSequential: boolean;
  isLast: boolean;
  roleCode: RoleCode;
  isModuleLocked: boolean;
  prevModuleTitle: string;
}) {
  const [tooltip, setTooltip] = useState(false);

  const isStudent = roleCode === "STUDENT";
  // Locked if the whole module is blocked by previous module, OR if prior lesson within module is incomplete
  const isLocked = isStudent && isSequential && (isModuleLocked || (index > 0 && !module.lessons[index - 1].is_complete));
  const lockTooltip = isModuleLocked
    ? `Complete "${prevModuleTitle}" module to unlock`
    : index > 0 && !module.lessons[index - 1].is_complete
      ? `Complete "${module.lessons[index - 1].title}" to unlock`
      : null;

  const content = (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 4px",
        borderBottom: isLast ? "none" : "1px solid rgba(3,72,82,0.06)",
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
        <span style={{ fontSize: "14px", color: "#209379", flexShrink: 0 }}>▶</span>
      )}

      {/* Tooltip */}
      {tooltip && lockTooltip && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#034852", color: "#fff", borderRadius: "8px",
          padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap",
          pointerEvents: "none", zIndex: 10,
          boxShadow: "0 4px 12px rgba(3,72,82,0.3)",
        }}>
          {lockTooltip}
        </div>
      )}
    </div>
  );

  if (isLocked) return content;

  return (
    <Link href={`/dashboard/courses/${courseId}/lessons/${lesson.id}`} style={{ textDecoration: "none" }}>
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

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching course…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)", backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "24px", padding: "28px 32px", boxShadow: "0 32px 64px rgba(0,0,0,0.08)",
};

const S = {
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
