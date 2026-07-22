"use client";

import { useEffect, useState } from "react";
import {
  getQuestionReports, resolveQuestionReport, REPORT_CATEGORY_LABELS,
  type QuestionReportRow,
} from "@/lib/api";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInvalidate } from "@/lib/mutations/invalidation";

/**
 * Student reports filed against one bank question, with inline Resolve/Dismiss.
 *
 * Renders nothing unless the viewer can actually act on a report. The backend guards
 * the endpoints regardless — this is affordance, not a security boundary.
 */
export function QuestionReportsPanel({ questionId }: { questionId: string }) {
  const canTriage = usePermission(PERM.test_bank.manage_questions);
  const [reports, setReports] = useState<QuestionReportRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (!canTriage || !questionId) return;
    let cancelled = false;
    // The API rolls a GROUP child's reports up under the parent's id for us.
    getQuestionReports({ question_id: questionId })
      .then((rows) => { if (!cancelled) setReports(rows); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [canTriage, questionId]);

  if (!canTriage || reports.length === 0) return null;

  const openCount = reports.filter((r) => r.status === "OPEN").length;

  async function close(id: string, status: "RESOLVED" | "DISMISSED") {
    setBusyId(id);
    try {
      const updated = await resolveQuestionReport(id, status);
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      // Closing a report changes the Test Bank ⚠ badges, the reported-only filter
      // and the dashboard card — refresh them instead of waiting for a reload.
      invalidate("questionReports");
    } catch {
      // Leave the row as-is; the next open of the panel re-fetches the truth.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: "8px", paddingTop: "16px", borderTop: "1px solid rgba(3,72,82,0.08)" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.55)", margin: "0 0 10px" }}>
        Student reports ({openCount} open)
      </p>

      {reports.map((r) => (
        <div
          key={r.id}
          style={{
            padding: "12px", borderRadius: "8px", marginBottom: "8px",
            background: r.status === "OPEN" ? "rgba(229,62,62,0.04)" : "rgba(3,72,82,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#034852" }}>
              {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: r.status === "OPEN" ? "#e53e3e" : "rgba(3,72,82,0.45)" }}>
              {r.status}
            </span>
          </div>

          {/* Student-authored text — ALWAYS plain text, never dangerouslySetInnerHTML. */}
          {r.note && (
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "rgba(3,72,82,0.75)", whiteSpace: "pre-wrap" }}>
              {r.note}
            </p>
          )}

          <p style={{ margin: "6px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
            {r.student_name} · {r.quiz_title} · {new Date(r.created_at).toLocaleDateString()}
          </p>

          {/* Editing a shared question changes every quiz using it — say so before they act. */}
          {r.used_in_quizzes > 1 && (
            <p style={{ margin: "4px 0 0", fontSize: "11px", fontWeight: 600, color: "#b7791f" }}>
              ⚠ Used in {r.used_in_quizzes} quizzes — an edit affects all of them.
            </p>
          )}

          {r.status === "OPEN" && (
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => close(r.id, "RESOLVED")}
                style={{
                  background: "rgba(10,190,98,0.12)", color: "#0abe62", border: "none",
                  borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700,
                  cursor: busyId === r.id ? "default" : "pointer", opacity: busyId === r.id ? 0.6 : 1,
                }}
              >
                Resolve
              </button>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => close(r.id, "DISMISSED")}
                style={{
                  background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.7)", border: "none",
                  borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700,
                  cursor: busyId === r.id ? "default" : "pointer", opacity: busyId === r.id ? 0.6 : 1,
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
