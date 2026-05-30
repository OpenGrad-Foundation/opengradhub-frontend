"use client";

import { useEffect, useState } from "react";
import { patchSubmission, type Submission } from "@/lib/api";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    NOT_STARTED: { bg: "rgba(3,72,82,0.07)",    color: "rgba(3,72,82,0.5)",  label: "Not Started" },
    SUBMITTED:   { bg: "rgba(10,190,98,0.1)",   color: "#0abe62",            label: "Submitted" },
    LATE:        { bg: "rgba(255,222,0,0.2)",   color: "#956f00",            label: "Late" },
    GRADING:     { bg: "rgba(100,149,237,0.15)", color: "#4169e1",           label: "Under Review" },
    GRADED:      { bg: "rgba(10,190,98,0.12)",  color: "#0abe62",            label: "Graded" },
  };
  const { bg, color, label } = map[status] ?? map.NOT_STARTED;
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", background: bg, color }}>{label}</span>;
}

export function GradePanel({
  submission: initialSub,
  assignmentId,
  graderId,
  onSaved,
  onClose,
}: {
  submission: Submission;
  assignmentId: string;
  graderId: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [sub, setSub]           = useState(initialSub);
  const [score, setScore]       = useState(initialSub.score?.toString() ?? "");
  const [feedback, setFeedback] = useState(initialSub.feedback ?? "");
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    if (sub.status !== "GRADING" && sub.status !== "GRADED" && sub.submitted_at) {
      void patchSubmission(assignmentId, sub.id, { status: "GRADING", graded_by: graderId })
        .then(updated => setSub(updated))
        .catch(() => {});
    }
  }, [sub.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!score.trim()) { setSaveErr("Score is required."); return; }
    const numScore = Number(score);
    if (isNaN(numScore)) { setSaveErr("Score must be a number."); return; }
    setSaving(true);
    setSaveErr(null);
    try {
      const updated = await patchSubmission(assignmentId, sub.id, {
        score:     numScore,
        feedback:  feedback.trim() || undefined,
        status:    "GRADED",
        graded_by: graderId,
      });
      setSub(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={glassCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <p style={S.label}>Grading</p>
          <h3 style={{ ...S.heading, fontSize: "16px", margin: "4px 0 2px" }}>{sub.student_name ?? "Student"}</h3>
          <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.45)", margin: 0 }}>{sub.student_roll}</p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.35)", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        <StatusBadge status={sub.status} />
        {sub.is_late && <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: "100px", fontSize: "9px", fontWeight: 700, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>LATE</span>}
      </div>

      {sub.response_text && (
        <div style={{ marginBottom: "14px" }}>
          <p style={{ ...sectionLabel, marginBottom: "8px" }}>Response</p>
          <div style={{ background: "rgba(3,72,82,0.03)", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "10px", padding: "12px 14px", fontSize: "13px", color: "#034852", lineHeight: 1.7, maxHeight: "180px", overflowY: "auto", wordBreak: "break-word" }}>
            {linkify(sub.response_text)}
          </div>
        </div>
      )}

      {sub.file_urls.length > 0 && (
        <div style={{ marginBottom: "14px" }}>
          <p style={{ ...sectionLabel, marginBottom: "8px" }}>Files</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {sub.file_urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#209379", fontWeight: 600, textDecoration: "none" }}>
                📎 {url.split("/").pop() ?? url}
              </a>
            ))}
          </div>
        </div>
      )}

      {!sub.response_text && sub.file_urls.length === 0 && (
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.4)", fontStyle: "italic", marginBottom: "14px" }}>No response submitted yet.</p>
      )}

      <div style={{ height: "1px", background: "rgba(3,72,82,0.08)", margin: "14px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <p style={{ ...sectionLabel, marginBottom: "6px" }}>Score *</p>
          <input type="number" step="0.5" min="0" value={score} onChange={e => setScore(e.target.value)} style={{ ...S.input, width: "120px" }} placeholder="e.g. 85" />
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: "6px" }}>Feedback</p>
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} placeholder="Optional feedback for the student…" style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }} />
        </div>

        {saveErr && <p style={{ fontSize: "12px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{saveErr}</p>}

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => void handleSave()} disabled={saving} style={{ ...S.primaryBtn, flex: 1, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save Grade"}
          </button>
          {saved && <span style={{ fontSize: "12px", color: "#0abe62", fontWeight: 700 }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;
function linkify(text: string): React.ReactNode[] {
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#209379", fontWeight: 600, textDecoration: "underline", wordBreak: "break-all" }}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "24px 28px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};
const S = {
  label:      { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading:    { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  input:      { width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn: { padding: "10px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", transition: "all 200ms ease" } as React.CSSProperties,
};
const sectionLabel: React.CSSProperties = { fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(3,72,82,0.5)", margin: 0 };
