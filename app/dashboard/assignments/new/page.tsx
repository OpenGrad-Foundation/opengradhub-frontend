"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createAssignment, getCourses, getBatches, type Course, type Batch } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
export default function NewAssignmentPage() {
  const router = useRouter();
  const invalidate = useInvalidate();
  const { isLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();

  const [title, setTitle]         = useState("");
  const [instructions, setInstr]  = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [dueAt, setDueAt]         = useState("");
  const [courseId, setCourseId]   = useState("");
  const [batchId, setBatchId]     = useState("");
  const [courses, setCourses]     = useState<Course[]>([]);
  const [batches, setBatches]     = useState<Batch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

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
    if (!title.trim()) { setError("Title is required."); return; }
    if (!dueAt)        { setError("Due date is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const a = await createAssignment({
        title:             title.trim(),
        instructions_html: instructions.trim() || undefined,
        attachment_url:    attachUrl.trim() || undefined,
        due_at:            new Date(dueAt).toISOString(),
        course_id:         courseId || undefined,
        batch_id:          batchId || undefined,
      });
      invalidate('assignments');
      router.replace(`/dashboard/assignments/${a.id}/submissions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "680px" }}>
      <Link href="/dashboard/assignments" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>← Assignments</Link>

      <div style={{ marginTop: "14px", marginBottom: "24px" }}>
        <p style={S.label}>New Assignment</p>
        <h1 style={{ ...S.heading, fontSize: "26px", margin: "4px 0 0" }}>Create Assignment</h1>
      </div>

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

          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{error}</p>}

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
      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.6)" }}>{label}</p>
      {children}
    </div>
  );
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};
const S = {
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  input: { width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn: { padding: "11px 22px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", transition: "all 220ms ease" } as React.CSSProperties,
  outlineBtn: { padding: "11px 20px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "10px", background: "transparent", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer" } as React.CSSProperties,
};
