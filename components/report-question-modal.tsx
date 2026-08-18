"use client";

import { useState } from "react";
import {
  reportQuestion, REPORT_CATEGORIES, REPORT_CATEGORY_LABELS,
  type ReportCategory, type QuestionReport,
} from "@/lib/api";

const NOTE_MAX = 1000;

/**
 * Lets a student flag a problem with the question they are looking at.
 *
 * Deliberately self-contained and side-effect free with respect to the attempt: it
 * only ever reads `snapshotId`, so it can never disturb answers, autosave, the timer
 * or submission. The server derives the question/quiz from the snapshot.
 */
export function ReportQuestionButton({
  snapshotId, alreadyReported = false, onReported,
}: {
  snapshotId: string;
  alreadyReported?: boolean;
  onReported?: (r: QuestionReport) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("WRONG_ANSWER");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReported = reported || alreadyReported;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const r = await reportQuestion(snapshotId, category, note.trim() || null);
      setReported(true);
      setOpen(false);
      setNote("");
      onReported?.(r);
    } catch {
      setError("Could not submit. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !isReported && setOpen(true)}
        disabled={isReported}
        title={isReported ? "You already reported this question" : "Report an issue with this question"}
        style={{
          background: "transparent",
          color: isReported ? "rgba(3,72,82,0.35)" : "rgba(3,72,82,0.5)",
          border: "none",
          borderRadius: "8px",
          padding: "6px 14px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: isReported ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ⚐ {isReported ? "Reported" : "Report issue"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report an issue with this question"
          onClick={() => !saving && setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "12px", padding: "24px",
              width: "100%", maxWidth: "420px",
            }}
          >
            <p style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 800, color: "#034852" }}>
              What&apos;s wrong with this question?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {REPORT_CATEGORIES.map((c) => (
                <label key={c} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="report-category"
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                    style={{ accentColor: "#006d6c" }}
                  />
                  {REPORT_CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>

            <textarea
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add details (optional)"
              rows={3}
              style={{
                width: "100%", padding: "8px", fontSize: "14px", borderRadius: "8px",
                border: "1px solid rgba(3,72,82,0.2)", resize: "vertical", fontFamily: "inherit",
              }}
            />
            <p style={{ margin: "4px 0 16px", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
              {note.length}/{NOTE_MAX}
            </p>

            {error && <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#e53e3e" }}>{error}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                style={{
                  background: "rgba(3,72,82,0.06)", color: "#034852", border: "none",
                  borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                style={{
                  background: "#034852", color: "#fff", border: "none", borderRadius: "8px",
                  padding: "8px 16px", fontSize: "13px", fontWeight: 700,
                  cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Sending..." : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
