"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { updateLiveClass, getCourses, type Course } from "@/lib/api";
import { useLiveClasses } from "@/lib/queries/live-classes";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { BatchMultiPicker } from "@/components/BatchMultiPicker";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";

function datetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditLiveClassPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const { data: classes = [], isPending: classesLoading } = useLiveClasses();
  const invalidate = useInvalidate();

  const cls = classes.find(c => c.id === id);

  const [title,      setTitle]      = useState("");
  const [desc,       setDesc]       = useState("");
  const [datetime,   setDatetime]   = useState("");
  const [duration,   setDuration]   = useState("60");
  const [meetUrl,    setMeetUrl]    = useState("");
  const [courseId,   setCourseId]   = useState("");
  const [progType,   setProgType]   = useState("UG");
  const [batchIds,   setBatchIds]   = useState<string[]>([]);
  const [courses,    setCourses]    = useState<Course[]>([]);
  const [ready,      setReady]      = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Pre-populate once the class is available from cache.
  useEffect(() => {
    if (!cls || ready) return;
    setTitle(cls.title);
    setDesc(cls.description ?? "");
    setDatetime(datetimeLocalValue(cls.scheduled_at));
    setDuration(String(cls.duration_minutes));
    setMeetUrl(cls.meeting_url);
    // Load every target the class actually carries. Guessing a single "kind"
    // and hydrating only that one silently dropped the others on save.
    setCourseId(cls.course_id ?? "");
    setProgType(cls.programme_type ?? "");
    setBatchIds(cls.batch_ids ?? []);
    setReady(true);
  }, [cls, ready]);

  useEffect(() => {
    getCourses(undefined, undefined, undefined, true)
      .then(all => setCourses(all.filter(c => c.status === "ACTIVE")))
      .catch(() => {});
  }, []);

  if (userLoading || permLoading) return null;

  if (!has(PERM.live_classes.edit)) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Access Denied</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>You don&apos;t have permission to edit live classes.</p>
      </div>
    );
  }

  if (classesLoading || !ready) {
    return (
      <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={S.label}>Loading</p>
          <p style={{ ...S.heading, marginTop: "12px" }}>Fetching class details…</p>
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Not Found</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Live class not found.</p>
        <Link href="/dashboard/live-classes" style={{ ...S.outlineBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>← Back</Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim())   { setError("Title is required."); return; }
    if (!datetime)       { setError("Date & time is required."); return; }
    if (!meetUrl.trim()) { setError("Meeting URL is required."); return; }
    if (!courseId && !progType && batchIds.length === 0) {
      setError("Pick at least one of course, programme or batches.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // PATCH leaves omitted fields alone, so the targets NOT chosen have to be
      // sent as explicit nulls. Omitting them kept the previous audience
      // attached alongside the new one — which either leaks the class to the
      // cohort the editor just dropped, or trips the mixed-mode guard for a
      // change that was actually fine.
      const created = await updateLiveClass(id, {
        title:            title.trim(),
        description:      desc.trim() || undefined,
        scheduled_at:     new Date(datetime).toISOString(),
        duration_minutes: Math.max(1, Number(duration) || 60),
        meeting_url:      meetUrl.trim(),
        // Explicit nulls for what is NOT set: PATCH leaves omitted fields alone,
        // so clearing a filter has to be said out loud.
        course_id:        courseId || null,
        programme_type:   progType || null,
        batch_ids:        batchIds,
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
      invalidate("calendar");
      router.replace("/dashboard/live-classes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSubmitting(false);
    }
  }

  // Spelled out, because "course + batch" reads as addition to most people and
  // this is the opposite: each filter removes students.
  const parts: string[] = [];
  if (courseId) parts.push(`enrolled in ${courses.find(c => c.id === courseId)?.title ?? "the course"}`);
  if (progType) parts.push(`in the ${progType} programme`);
  if (batchIds.length) parts.push(`in ${batchIds.length} selected batch${batchIds.length === 1 ? "" : "es"}`);
  const audienceSummary = parts.length === 0
    ? "nobody yet — pick at least one"
    : `students ${parts.join(" AND ")}`;

  return (
    <div style={{ maxWidth: "640px" }}>
      <Link href="/dashboard/live-classes" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>← Live Classes</Link>
      <div style={{ marginTop: "14px", marginBottom: "24px" }}>
        <p style={S.label}>Edit</p>
        <h1 style={{ ...S.heading, fontSize: "26px", margin: "4px 0 0" }}>Edit Live Class</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: "18px" }}>
          <Field label="Title *">
            <input value={title} onChange={e => setTitle(e.target.value)} style={S.input} placeholder="e.g. Weekly Q&A Session" required />
          </Field>

          <Field label="Description">
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ ...S.input, resize: "vertical" }} placeholder="Optional notes for students…" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
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

          {/* Three independent optional filters that NARROW each other. */}
          <div>
            <p style={fieldLabel}>Target Audience *</p>
            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.6)", margin: "0 0 10px" }}>
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

              <Field label="Programme (optional)">
                <select value={progType} onChange={e => setProgType(e.target.value)} style={S.input}>
                  <option value="">Any programme</option>
                  {PROGRAMME_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Batches (optional)">
                <BatchMultiPicker value={batchIds} onChange={setBatchIds} inputStyle={S.input} />
              </Field>
            </div>

            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.7)", margin: "10px 0 0" }}>
              <b>Audience:</b> {audienceSummary}
            </p>
          </div>

          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: "10px" }}>
            <Link href="/dashboard/live-classes" style={{ ...S.outlineBtn, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Cancel</Link>
            <button type="submit" disabled={submitting} style={{ ...S.primaryBtn, flex: 1, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Saving…" : "Save Changes"}
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

const fieldLabel: React.CSSProperties = { margin: "0 0 8px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.6)" };
const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" };
const S = {
  label:      { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading:    { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  input:      { width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn: { padding: "11px 22px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", transition: "all 220ms ease" } as React.CSSProperties,
  outlineBtn: { padding: "11px 20px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "10px", background: "transparent", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer" } as React.CSSProperties,
};
