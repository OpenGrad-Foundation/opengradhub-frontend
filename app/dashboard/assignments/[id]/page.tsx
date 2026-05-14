"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getAssignmentById,
  submitAssignment,
  type Assignment,
  type Submission,
} from "@/lib/api";

// ── Page ───────────────────────────────────────────────────────

export default function AssignmentDetailPage() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const studentId = userData?.user?.id ?? "";
  const roleCode = (userData?.role?.code ?? "") as string;
  const isStudent = roleCode === "STUDENT";

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Fetch on mount
  useEffect(() => {
    if (userLoading || !studentId) return;
    setLoading(true);
    getAssignmentById(assignmentId, studentId)
      .then(setAssignment)
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load assignment."))
      .finally(() => setLoading(false));
  }, [userLoading, assignmentId, studentId]);

  if (loading || userLoading) return <LoadingState />;

  if (error || !assignment) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Error</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>{error ?? "Assignment not found."}</p>
        <Link href="/dashboard/assignments" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
          ← Assignments
        </Link>
      </div>
    );
  }

  const status     = assignment.submission_status ?? "NOT_STARTED";
  const isGraded   = status === "GRADED";
  const isSubmitted = status === "SUBMITTED" || status === "LATE" || status === "GRADING";
  const isPastDue  = new Date() > new Date(assignment.due_at);

  function onSubmitted(sub: Submission) {
    setAssignment(prev => prev ? { ...prev, submission_status: sub.status } : prev);
  }

  return (
    <div style={{ maxWidth: "760px" }}>
      {/* Back */}
      <Link href="/dashboard/assignments" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← Assignments
      </Link>

      {/* Header card */}
      <div style={{ ...glassCard, marginTop: "16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <StatusBadge status={status} />
              {isPastDue && status !== "GRADED" && (
                <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                  Past Due
                </span>
              )}
              {assignment.course_title && (
                <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, background: "rgba(32,147,121,0.1)", color: "#209379" }}>
                  {assignment.course_title}
                </span>
              )}
            </div>
            <h1 style={{ ...S.heading, fontSize: "22px", margin: "0 0 8px" }}>{assignment.title}</h1>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", margin: 0 }}>
              Due: <strong style={{ color: isPastDue ? "#dc2626" : "#034852" }}>
                {new Date(assignment.due_at).toLocaleDateString()} at {new Date(assignment.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </strong>
            </p>
          </div>
        </div>

        {/* Instructions */}
        {assignment.instructions_html && (
          <div style={{ marginTop: "18px", paddingTop: "18px", borderTop: "1px solid rgba(3,72,82,0.08)" }}>
            <p style={{ ...S.sectionLabel, marginBottom: "10px" }}>Instructions</p>
            <div
              style={{ fontSize: "14px", color: "#034852", lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: sanitize(assignment.instructions_html) }}
            />
          </div>
        )}

        {/* Attachment */}
        {assignment.attachment_url && (
          <div style={{ marginTop: "14px" }}>
            <a
              href={assignment.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#209379", fontWeight: 600, textDecoration: "none" }}
            >
              📎 View Attachment
            </a>
          </div>
        )}
      </div>

      {/* Graded result */}
      {isGraded && isStudent && (
        <GradedResult assignmentId={assignmentId} studentId={studentId} />
      )}

      {/* Submission form — only for students, hidden once GRADED */}
      {!isGraded && isStudent && (
        <SubmissionForm
          assignmentId={assignmentId}
          studentId={studentId}
          isResubmit={isSubmitted}
          onSubmitted={onSubmitted}
        />
      )}
    </div>
  );
}

// ── Graded result banner ───────────────────────────────────────

function GradedResult({ assignmentId, studentId }: { assignmentId: string; studentId: string }) {
  const [sub, setSub] = useState<Submission | null>(null);

  useEffect(() => {
    import("@/lib/api").then(({ getSubmissions }) =>
      getSubmissions(assignmentId)
        .then(list => setSub(list.find(s => s.student_id === studentId) ?? null))
        .catch(() => {})
    );
  }, [assignmentId, studentId]);

  if (!sub) return null;

  return (
    <div style={{
      ...glassCard, marginBottom: "20px",
      border: "1px solid rgba(10,190,98,0.2)",
      background: "rgba(10,190,98,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: sub.feedback ? "14px" : 0 }}>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <p style={{ ...S.sectionLabel, marginBottom: "4px" }}>Score</p>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, color: "#0abe62", margin: 0 }}>
            {sub.score ?? "—"}
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ ...S.heading, fontSize: "16px", margin: "0 0 4px" }}>Assignment Graded ✓</p>
          {sub.is_late && <p style={{ fontSize: "12px", color: "#956f00", margin: 0 }}>Submitted late</p>}
        </div>
      </div>
      {sub.feedback && (
        <>
          <p style={{ ...S.sectionLabel, margin: "0 0 8px" }}>Feedback</p>
          <p style={{ fontSize: "14px", color: "#034852", lineHeight: 1.7, margin: 0 }}>{sub.feedback}</p>
        </>
      )}
      {sub.response_text && (
        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(3,72,82,0.08)" }}>
          <p style={{ ...S.sectionLabel, margin: "0 0 8px" }}>Your Submission</p>
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.7)", lineHeight: 1.7, margin: 0 }}>{sub.response_text}</p>
        </div>
      )}
    </div>
  );
}

// ── Submission form ────────────────────────────────────────────

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILES = 3;

function SubmissionForm({
  assignmentId,
  studentId,
  isResubmit,
  onSubmitted,
}: {
  assignmentId: string;
  studentId: string;
  isResubmit: boolean;
  onSubmitted: (s: Submission) => void;
}) {
  const [responseText, setResponseText] = useState("");
  const [files, setFiles]               = useState<File[]>([]);
  const [fileError, setFileError]       = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [submitted, setSubmitted]       = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const picked = Array.from(e.target.files ?? []);
    const combined = [...files, ...picked].slice(0, MAX_FILES);

    for (const f of picked) {
      const ext = "." + f.name.split(".").pop()!.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setFileError(`"${f.name}" is not allowed. Accepted: PDF, Word, JPEG, PNG.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFileError(`"${f.name}" exceeds ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }
    }
    setFiles(combined);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!responseText.trim() && files.length === 0) {
      setSubmitError("Add a text response or attach at least one file.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // v1: store file names as URL placeholders (real upload requires storage backend)
      const fileUrls = files.map(f => f.name);
      const sub = await submitAssignment(assignmentId, {
        student_id:    studentId,
        response_text: responseText.trim() || undefined,
        file_urls:     fileUrls,
      });
      setSubmitted(true);
      onSubmitted(sub);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ ...glassCard, textAlign: "center", padding: "40px" }}>
        <p style={{ fontSize: "32px", marginBottom: "8px" }}>✅</p>
        <p style={{ ...S.heading, fontSize: "18px", margin: "0 0 8px" }}>Submitted successfully</p>
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)", margin: 0 }}>
          Your assignment has been received. You&apos;ll be notified when it&apos;s graded.
        </p>
      </div>
    );
  }

  return (
    <div style={glassCard}>
      <p style={{ ...S.sectionLabel, marginBottom: "16px" }}>
        {isResubmit ? "Update Your Submission" : "Your Submission"}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={fieldLabel}>Text Response</p>
            <textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              rows={6}
              placeholder="Write your response here…"
              style={{ ...S.input, resize: "vertical", lineHeight: 1.7 }}
            />
          </div>

          {/* File upload */}
          <div>
            <p style={fieldLabel}>
              Attachments — up to {MAX_FILES} files, {MAX_FILE_SIZE_MB} MB each (PDF, Word, JPEG, PNG)
            </p>
            {files.length < MAX_FILES && (
              <label style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                border: "1.5px dashed rgba(3,72,82,0.25)",
                fontSize: "13px", color: "#034852", fontWeight: 600,
              }}>
                + Add file
                <input type="file" multiple hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFileChange} />
              </label>
            )}
            {fileError && <p style={{ fontSize: "12px", color: "#e53e3e", fontWeight: 600, margin: "6px 0 0" }}>{fileError}</p>}
            {files.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(3,72,82,0.04)", borderRadius: "8px", border: "1px solid rgba(3,72,82,0.1)" }}>
                    <span style={{ fontSize: "13px", color: "#034852", flex: 1 }}>📄 {f.name}</span>
                    <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.45)" }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => removeFile(i)} style={{ background: "none", border: "none", color: "rgba(220,38,38,0.6)", cursor: "pointer", fontSize: "15px", padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {submitError && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{ ...S.primaryBtn, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Submitting…" : isResubmit ? "Resubmit" : "Submit Assignment"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function sanitize(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\s+on\w+="[^"]*"/gi, "");
}

function StatusBadge({ status }: { status: string }) {
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

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching assignment…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "28px 32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};

const S = {
  label:       { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  sectionLabel:{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(3,72,82,0.5)", margin: 0 } as React.CSSProperties,
  heading:     { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  input:       { width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn:  { padding: "12px 24px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", transition: "all 220ms ease" } as React.CSSProperties,
};

const fieldLabel: React.CSSProperties = { margin: "0 0 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.6)" };
