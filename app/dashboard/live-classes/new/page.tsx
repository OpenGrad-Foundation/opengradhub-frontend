"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createLiveClass, getCourses, type Course } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { BatchMultiPicker } from "@/components/BatchMultiPicker";
import { useAudiencePreview } from "@/lib/queries/live-classes";
import { AudienceCount } from "@/components/AudienceCount";

export default function NewLiveClassPage() {
  const router = useRouter();
  const { isLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [datetime, setDatetime] = useState("");
  const [duration, setDuration] = useState("60");
  const [meetUrl,  setMeetUrl]  = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    getCourses(undefined, undefined, undefined, true)
      .then(all => setCourses(all.filter(c => c.status === "ACTIVE")))
      .catch(() => {});
  }, []);

  // Prose alone cannot tell forty students from none. The count can.
  // Declared before any early return: hooks must run in the same order
  // on every render.
  const preview = useAudiencePreview({
    course_id: courseId || undefined,
    batch_ids: batchIds.length ? batchIds : undefined,
  });

  if (isLoading || permLoading) return null;
  if (!has(PERM.live_classes.create)) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Access Denied</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>You don&apos;t have permission to schedule live classes.</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim())   { setError("Title is required."); return; }
    if (!datetime)       { setError("Date & time is required."); return; }
    if (!meetUrl.trim()) { setError("Meeting URL is required."); return; }
    if (!courseId && batchIds.length === 0) {
      setError("Pick a course, batches, or both.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createLiveClass({
        title:            title.trim(),
        description:      desc.trim() || undefined,
        scheduled_at:     new Date(datetime).toISOString(),
        duration_minutes: Math.max(1, Number(duration) || 60),
        meeting_url:      meetUrl.trim(),
        course_id:        courseId || undefined,
        batch_ids:        batchIds.length ? batchIds : undefined,
      });
      // A class can be scheduled even when some targeted students are in no
      // batch — their attendance simply cannot be tracked. Blocking the schedule
      // would help nobody, but staying silent would hide it.
      if (created?.unresolved_students) {
        toast.warning(
          `${created.unresolved_students} targeted student${created.unresolved_students > 1 ? "s aren't" : " isn't"} in a batch, ` +
          `so their attendance can't be tracked yet.`,
          { duration: 8000 },
        );
      }
      invalidate('calendar');
      router.replace("/dashboard/live-classes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule.");
    } finally {
      setSubmitting(false);
    }
  }

  // Spelled out in words, because "course + batch" reads as addition to most
  // people and this is the opposite: each filter removes students.
  const parts: string[] = [];
  if (courseId) parts.push(`enrolled in ${courses.find(c => c.id === courseId)?.title ?? "the course"}`);
  if (batchIds.length) parts.push(`in ${batchIds.length} selected batch${batchIds.length === 1 ? "" : "es"}`);
  const audienceSummary = parts.length === 0
    ? "nobody yet — pick at least one"
    : `students ${parts.join(" AND ")}`;

  return (
    <div>
      <Link href="/dashboard/live-classes" style={S.outlineBtn}><ArrowLeft size={16} aria-hidden="true" />Live classes</Link>
      <div style={{ height: "20px" }} />

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: "18px" }}>
          <Field label="Title *">
            <input value={title} onChange={e => setTitle(e.target.value)} style={S.input} placeholder="e.g. Weekly Q&A Session" required />
          </Field>

          <Field label="Description">
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ ...S.input, resize: "vertical" }} placeholder="Optional notes for students…" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            <Field label="Date & Time *">
              <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} style={S.input} required />
            </Field>
            <Field label="Duration (minutes) *">
              <input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} style={S.input} placeholder="60" required />
            </Field>
          </div>

          <Field label="Meeting URL *">
            <input type="url" value={meetUrl} onChange={e => setMeetUrl(e.target.value)} style={S.input} placeholder="https://meet.google.com/… or https://zoom.us/j/…" required />
          </Field>

          {/* Audience: two INDEPENDENT optional filters that narrow each other.
              Picking a course and a batch means "students in that course who
              are also in that batch" — not the two audiences added up. At least
              one is required, because a class with no audience reaches nobody. */}
          <div>
            <p style={fieldLabel}>Target Audience *</p>
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "0 0 10px" }}>
              Pick any combination. Each one you add <b>narrows</b> the audience —
              a student must match all of them.
            </p>

            <div style={{ display: "grid", gap: "12px" }}>
              <Field label="Course (optional)">
                <select value={courseId} onChange={e => setCourseId(e.target.value)} style={S.input}>
                  <option value="">Any course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.programme_type})</option>
                  ))}
                </select>
              </Field>

              <Field label="Batches (optional)">
                <BatchMultiPicker value={batchIds} onChange={setBatchIds} inputStyle={S.input} />
              </Field>
            </div>

            <p style={{ fontSize: "12px", color: "#3f5f66", margin: "10px 0 0" }}>
              <b>Audience:</b> {audienceSummary}
            </p>
            <AudienceCount preview={preview} />
          </div>

          {error && <p role="alert" style={{ fontSize: "13px", color: "#c62828", fontWeight: 600, margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <Link href="/dashboard/live-classes" style={{ ...S.outlineBtn, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flex: "1 1 120px" }}>Cancel</Link>
            <button type="submit" disabled={submitting} style={{ ...S.primaryBtn, flex: "2 1 180px", opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Scheduling…" : "Schedule class"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * A real <label>, wrapping its control so the association is implicit and
 * cannot fall out of sync with an id. It used to be a <p>, which looks like a
 * label and is one to nobody: not a single field in this form was
 * programmatically labelled.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", margin: "0 0 8px", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

const fieldLabel: React.CSSProperties = { margin: "0 0 8px", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" };
const glassCard: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)",
};
const S = {
  label:      { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 } as React.CSSProperties,
  heading:    { fontWeight: 700, color: "var(--color-text)" } as React.CSSProperties,
  input:      { width: "100%", minHeight: "44px", padding: "8px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--green)", borderRadius: "12px", background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600, fontSize: "14px", cursor: "pointer", textDecoration: "none" } as React.CSSProperties,
  outlineBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", color: "var(--color-text)", fontWeight: 600, fontSize: "14px", cursor: "pointer", textDecoration: "none" } as React.CSSProperties,
};
