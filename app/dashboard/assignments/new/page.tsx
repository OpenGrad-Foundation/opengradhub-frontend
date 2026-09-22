"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createAssignment, getCourses, getBatches, type Course, type Batch, type SubmissionType } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
export default function NewAssignmentPage() {
  const router = useRouter();
  const invalidate = useInvalidate();
  const { isLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();

  const [title, setTitle]         = useState("");
  const [instructions, setInstr]  = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [submissionType, setSubmissionType] = useState<SubmissionType>("FILE");
  const [dueAt, setDueAt]         = useState("");
  const [courseId, setCourseId]   = useState("");
  const [batchId, setBatchId]     = useState("");
  const [courses, setCourses]     = useState<Course[]>([]);
  const [batches, setBatches]     = useState<Batch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    getCourses(undefined, undefined, undefined, true)
      .then(all => setCourses(all.filter(c => c.status === "ACTIVE")))
      .catch(() => {});
    getBatches("ACTIVE")
      .then(all => setBatches(all))
      .catch(() => {});
  }, []);

  if (isLoading || permLoading) return null;
  if (!has(PERM.assignments.create)) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Access Denied</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>You don&apos;t have permission to create assignments.</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!title.trim()) { setError("Title is required."); return; }
    if (!dueAt)        { setError("Due date is required."); return; }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const a = await createAssignment({
        title:             title.trim(),
        instructions_html: instructions.trim() || undefined,
        attachment_url:    attachUrl.trim() || undefined,
        submission_type:   submissionType,
        due_at:            new Date(dueAt).toISOString(),
        course_id:         courseId || undefined,
        batch_id:          batchId || undefined,
      });
      invalidate('assignments');
      router.replace(`/dashboard/assignments/${a.id}/submissions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link href="/dashboard/assignments" style={S.outlineBtn}><ArrowLeft size={16} aria-hidden="true" />Assignments</Link>

      <div style={{ height: "20px" }} />

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: "18px" }}>

          <Field label="Title *">
            <input value={title} onChange={e => setTitle(e.target.value)} style={S.input} placeholder="e.g. Chapter 5 Essay" required />
          </Field>

          <Field label="Instructions">
            <textarea
              value={instructions}
              onChange={e => setInstr(e.target.value)}
              rows={6}
              placeholder="Describe the assignment task, requirements, and expected format…"
              style={{ ...S.input, resize: "vertical", lineHeight: 1.7 }}
            />
          </Field>

          <Field label="What students submit *">
            <select
              value={submissionType}
              onChange={e => setSubmissionType(e.target.value as SubmissionType)}
              style={S.input}
            >
              <option value="FILE">File upload — PDF, Word, or image (max 10 MB each)</option>
              <option value="LINK">Google Drive link — for video or anything large</option>
              <option value="BOTH">Either a file or a Google Drive link</option>
            </select>
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
              This can&apos;t be changed once students start submitting.
            </p>
          </Field>

          <Field label="Due Date & Time *">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={e => setDueAt(e.target.value)}
              style={S.input}
              required
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="Course (optional)">
              <select value={courseId} onChange={e => setCourseId(e.target.value)} style={S.input}>
                <option value="">No course association</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.programme_type})</option>
                ))}
              </select>
            </Field>
            <Field label="Batch (optional)">
              <select value={batchId} onChange={e => setBatchId(e.target.value)} style={S.input}>
                <option value="">No batch association</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.programme_type ? ` (${b.programme_type})` : ""}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Attachment URL (optional)">
            <input
              value={attachUrl}
              onChange={e => setAttachUrl(e.target.value)}
              style={S.input}
              placeholder="https://… (link to a reference file or resource)"
              type="url"
            />
          </Field>

          {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: "10px" }}>
            <Link href="/dashboard/assignments" style={{ ...S.outlineBtn, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              Cancel
            </Link>
            <button type="submit" disabled={submitting} style={{ ...S.primaryBtn, flex: 1, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Creating…" : "Create Assignment"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

const glassCard: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)",
};
const S = {
  label: { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 } as React.CSSProperties,
  heading: { fontWeight: 700, color: "var(--color-text)" } as React.CSSProperties,
  input: { width: "100%", minHeight: "44px", padding: "8px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--green)", borderRadius: "12px", background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600, fontSize: "14px", cursor: "pointer", textDecoration: "none" } as React.CSSProperties,
  outlineBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", color: "var(--color-text)", fontWeight: 600, fontSize: "14px", cursor: "pointer", textDecoration: "none" } as React.CSSProperties,
};
