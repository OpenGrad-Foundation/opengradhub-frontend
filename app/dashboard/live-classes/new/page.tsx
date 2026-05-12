"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createLiveClass, getCourses, type Course } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

type Target = "course" | "programme";

export default function NewLiveClassPage() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId   = data?.user?.id ?? "";

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [datetime, setDatetime] = useState("");
  const [duration, setDuration] = useState("60");
  const [meetUrl,  setMeetUrl]  = useState("");
  const [target,   setTarget]   = useState<Target>("course");
  const [courseId, setCourseId] = useState("");
  const [progType, setProgType] = useState("UG");
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    getCourses(undefined, undefined, undefined, true)
      .then(all => setCourses(all.filter(c => c.status === "ACTIVE")))
      .catch(() => {});
  }, []);

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
    if (target === "course" && !courseId) { setError("Select a course."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await createLiveClass({
        title:            title.trim(),
        description:      desc.trim() || undefined,
        scheduled_at:     new Date(datetime).toISOString(),
        duration_minutes: Math.max(1, Number(duration) || 60),
        meeting_url:      meetUrl.trim(),
        course_id:        target === "course" ? courseId : undefined,
        programme_type:   target === "programme" ? progType : undefined,
        caller_id:        userId,
        caller_role:      roleCode,
      });
      router.replace("/dashboard/live-classes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      <Link href="/dashboard/live-classes" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>← Live Classes</Link>
      <div style={{ marginTop: "14px", marginBottom: "24px" }}>
        <p style={S.label}>Schedule</p>
        <h1 style={{ ...S.heading, fontSize: "26px", margin: "4px 0 0" }}>New Live Class</h1>
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

          {/* Target radio */}
          <div>
            <p style={fieldLabel}>Target Audience *</p>
            <div style={{ display: "flex", gap: "10px" }}>
              {(["course", "programme"] as Target[]).map(t => (
                <button key={t} type="button" onClick={() => setTarget(t)} style={{
                  padding: "8px 18px", borderRadius: "10px", cursor: "pointer",
                  border: target === t ? "1.5px solid #034852" : "1.5px solid rgba(3,72,82,0.18)",
                  background: target === t ? "rgba(3,72,82,0.07)" : "transparent",
                  color: target === t ? "#034852" : "rgba(3,72,82,0.55)",
                  fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: target === t ? 700 : 500,
                  transition: "all 180ms ease",
                }}>
                  {t === "course" ? "Specific Course" : "All students in programme"}
                </button>
              ))}
            </div>
          </div>

          {target === "course" ? (
            <Field label="Course">
              <select value={courseId} onChange={e => setCourseId(e.target.value)} style={S.input}>
                <option value="">Select active course…</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.programme_type})</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Programme Type">
              <select value={progType} onChange={e => setProgType(e.target.value)} style={S.input}>
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </Field>
          )}

          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: "10px" }}>
            <Link href="/dashboard/live-classes" style={{ ...S.outlineBtn, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Cancel</Link>
            <button type="submit" disabled={submitting} style={{ ...S.primaryBtn, flex: 1, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Scheduling…" : "Schedule Class"}
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
