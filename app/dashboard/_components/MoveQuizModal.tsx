"use client";

import { useEffect, useState } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import {
  getCourses,
  getCourseModules,
  getQuizMovePreflight,
  moveQuiz,
  type Course,
  type CourseModule,
  type QuizDestination,
  type QuizMovePreflight,
} from "@/lib/api";

/**
 * Moves one quiz between the global test bank and a course module.
 *
 * Everything the user needs to decide comes from the preflight, not from the
 * caller: the current scope, the attempts that will follow the quiz, and the
 * blockers that make the move impossible. The caller only says which quiz.
 */
export function MoveQuizModal({
  quizId,
  quizTitle,
  onClose,
  onMoved,
}: {
  quizId: string;
  quizTitle: string;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [preflight, setPreflight] = useState<QuizMovePreflight | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [target, setTarget] = useState<"GLOBAL" | "MODULE">("GLOBAL");
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [moduleId, setModuleId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getQuizMovePreflight(quizId)
      .then((pf) => {
        if (!live) return;
        setPreflight(pf);
        // Default to the opposite of where it is — that is the only move there is.
        setTarget(pf.current.kind === "MODULE" ? "GLOBAL" : "MODULE");
      })
      .catch((e) => live && setLoadError(e instanceof Error ? e.message : "Failed to load."));
    return () => { live = false; };
  }, [quizId]);

  // Only management-visible courses can receive a quiz; the server re-checks.
  useEffect(() => {
    if (target !== "MODULE" || courses.length) return;
    let live = true;
    getCourses(undefined, undefined, undefined, true)
      .then((cs) => live && setCourses(cs.filter((c) => c.can_manage !== false)))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Failed to load courses."));
    return () => { live = false; };
  }, [target, courses.length]);

  useEffect(() => {
    setModuleId("");
    setModules([]);
    if (!courseId) return;
    let live = true;
    getCourseModules(courseId)
      .then((ms) => live && setModules(ms))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Failed to load modules."));
    return () => { live = false; };
  }, [courseId]);

  const destination: QuizDestination | null =
    target === "GLOBAL" ? { kind: "GLOBAL" } : moduleId ? { kind: "MODULE", moduleId } : null;

  const isNoop =
    preflight != null &&
    (target === "GLOBAL"
      ? preflight.current.kind === "GLOBAL"
      : moduleId !== "" && moduleId === preflight.current.module_id);

  async function handleMove() {
    if (!destination) return;
    setSubmitting(true);
    setError(null);
    try {
      await moveQuiz(quizId, destination);
      onMoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to move quiz.");
      setSubmitting(false);
    }
  }

  const currentLabel =
    preflight?.current.kind === "MODULE"
      ? `${preflight.current.course_title ?? "Course"} → ${preflight.current.module_title ?? "Module"}`
      : "Global Test Bank";

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={header}>
          <div>
            <p style={eyebrow}>Move Quiz</p>
            <h2 style={title}>{quizTitle}</h2>
          </div>
          <button onClick={onClose} disabled={submitting} style={iconBtn} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        <div style={body}>
          {loadError && <p style={errorText}>{loadError}</p>}
          {!preflight && !loadError && <p style={muted}>Checking this quiz…</p>}

          {preflight && (
            <>
              <p style={muted}>
                Currently in <strong style={{ color: "#034852" }}>{currentLabel}</strong>.
              </p>

              {preflight.blockers.length > 0 && (
                <div style={blockerBox}>
                  {preflight.blockers.map((b) => (
                    <p key={b} style={{ margin: "0 0 6px", fontSize: "13px", color: "#8a2f2f" }}>{b}</p>
                  ))}
                </div>
              )}

              {preflight.attempts > 0 && preflight.can_move && (
                <div style={noteBox}>
                  {preflight.attempts} past attempt(s) stay attached to this quiz. Analytics will
                  count them under the new scope from now on.
                </div>
              )}

              <fieldset style={fieldset} disabled={!preflight.can_move || submitting}>
                <legend style={legend}>Move to</legend>
                <label style={radioRow}>
                  <input type="radio" checked={target === "GLOBAL"} onChange={() => setTarget("GLOBAL")} />
                  <span>Global Test Bank</span>
                </label>
                <label style={radioRow}>
                  <input type="radio" checked={target === "MODULE"} onChange={() => setTarget("MODULE")} />
                  <span>A course module</span>
                </label>

                {target === "MODULE" && (
                  <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                    <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={select}>
                      <option value="">Select a course…</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <select
                      value={moduleId}
                      onChange={(e) => setModuleId(e.target.value)}
                      style={select}
                      disabled={!courseId}
                    >
                      <option value="">{courseId ? "Select a module…" : "Pick a course first"}</option>
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>

              {error && <p style={errorText}>{error}</p>}
            </>
          )}
        </div>

        <div style={footer}>
          <button onClick={onClose} disabled={submitting} style={secondaryBtn}>Cancel</button>
          <button
            onClick={() => void handleMove()}
            disabled={submitting || !preflight?.can_move || !destination || isNoop}
            style={{
              ...primaryBtn,
              opacity: submitting || !preflight?.can_move || !destination || isNoop ? 0.5 : 1,
            }}
          >
            <ArrowRightLeft size={16} />
            {submitting ? "Moving…" : isNoop ? "Already here" : "Move Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "rgba(3,72,82,0.3)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
};
const panel: React.CSSProperties = {
  background: "#ffffff", borderRadius: "24px", width: "100%", maxWidth: "520px",
  boxShadow: "0 24px 48px rgba(3,72,82,0.15)", overflow: "hidden",
  display: "flex", flexDirection: "column", maxHeight: "90vh",
};
const header: React.CSSProperties = {
  padding: "24px", borderBottom: "1px solid rgba(3,72,82,0.06)",
  display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px",
};
const eyebrow: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379", margin: 0,
};
const title: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852", margin: "4px 0 0",
};
const iconBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)",
};
const body: React.CSSProperties = { padding: "24px", overflowY: "auto", flex: 1 };
const muted: React.CSSProperties = {
  fontSize: "14px", color: "rgba(3,72,82,0.7)", margin: "0 0 14px", lineHeight: 1.5,
};
const blockerBox: React.CSSProperties = {
  background: "rgba(229,62,62,0.06)", border: "1px solid rgba(229,62,62,0.2)",
  borderRadius: "12px", padding: "14px 16px", marginBottom: "14px",
};
const noteBox: React.CSSProperties = {
  background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.35)",
  borderRadius: "12px", padding: "12px 16px", marginBottom: "14px",
  fontSize: "13px", color: "#7a5c00", lineHeight: 1.5,
};
const fieldset: React.CSSProperties = {
  border: "1px solid rgba(3,72,82,0.1)", borderRadius: "14px", padding: "14px 16px", margin: 0,
};
const legend: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "rgba(3,72,82,0.6)", padding: "0 6px",
};
const radioRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", padding: "6px 0",
  fontSize: "14px", color: "#034852", cursor: "pointer",
};
const select: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box",
};
const errorText: React.CSSProperties = {
  fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: "14px 0 0",
};
const footer: React.CSSProperties = {
  padding: "20px 24px", background: "rgba(3,72,82,0.02)",
  borderTop: "1px solid rgba(3,72,82,0.06)",
  display: "flex", justifyContent: "flex-end", gap: "12px",
};
const secondaryBtn: React.CSSProperties = {
  padding: "10px 20px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "10px",
  background: "transparent", color: "#034852", fontFamily: "var(--font-body)",
  fontWeight: 600, fontSize: "14px", cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 20px", border: "none", borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff",
  fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px",
  cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
};
