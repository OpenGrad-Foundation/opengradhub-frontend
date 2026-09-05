"use client";

import { useEffect, useState } from "react";
import { BackLink } from "@/components/back-link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DuplicateAction } from "@/components/duplicate-action";
import { useCurrentUser } from "@/hooks/use-current-user";
import { hasEffectiveSelfScope } from "@/lib/permissions";
import { getCourseById, getCourseOverview, type Course, type ModuleWithProgress } from "@/lib/api";
import { getDuplicatePreview, materialToCourseView } from "@/lib/duplicate-material";
import { CourseView, glassCard, S } from "../_components/CourseView";

// ── Page ───────────────────────────────────────────────────────

export default function CourseOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // Duplication review reads the dedicated material API — the course's own
  // endpoints refuse another programme's course — but draws it through the same
  // course view, so a reviewer walks the course rather than reading a field dump.
  if (searchParams.get("mode") === "duplicate") return <CourseMaterialView key={id} courseId={id} />;
  return <CourseOverview />;
}

function CourseMaterialView({ courseId }: { courseId: string }) {
  const preview = useQuery({
    queryKey: ["og", "duplicate", "courses", "preview", courseId],
    queryFn: () => getDuplicatePreview("courses", courseId),
  });

  if (preview.isPending) return <LoadingState />;

  if (preview.error || !preview.data) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Error</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>{preview.error?.message ?? "Course material not found."}</p>
        <BackLink fallback="/dashboard/courses/duplicate" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>← Back to browse</BackLink>
      </div>
    );
  }

  const { course, modules, quizMaterial } = materialToCourseView(preview.data);

  return (
    <div>
      <BackLink fallback="/dashboard/courses/duplicate" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← Browse courses to duplicate
      </BackLink>
      <CourseView
        course={course}
        modules={modules}
        courseId={courseId}
        isPreview
        variant="material"
        quizMaterial={quizMaterial}
        headerAside={
          <div style={{ flexShrink: 0, minWidth: "240px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
            <span style={{
              display: "inline-block", padding: "4px 12px", borderRadius: "100px",
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
              background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.6)",
            }}>
              DUPLICATION REVIEW
            </span>
            <DuplicateAction kind="courses" sourceId={courseId} />
          </div>
        }
      />
      <p style={{ marginTop: "18px", fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
        Copies share question-bank questions; editing a shared question changes every use. Learner records are never copied.
      </p>
    </div>
  );
}

function CourseOverview() {
  const { id: courseId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const fromManagement = searchParams.get("from") === "management";
  const backHref = fromManagement ? `/dashboard/course-management/${courseId}` : "/dashboard/courses";
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const isLearner = hasEffectiveSelfScope(userData?.permissions);
  const studentId = userData?.user?.id ?? "";

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading || !studentId) return;
    setLoading(true);
    Promise.all([
      getCourseById(courseId),
      getCourseOverview(courseId, isLearner ? studentId : undefined),
    ])
      .then(([c, m]) => { setCourse(c); setModules(m); })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load course."))
      .finally(() => setLoading(false));
  }, [userLoading, courseId, studentId, isLearner]);

  if (loading || userLoading) return <LoadingState />;

  if (error || !course) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Error</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>{error ?? "Course not found."}</p>
        <BackLink fallback={backHref} style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>{fromManagement ? "← Back to Course Management" : "← Back to Courses"}</BackLink>
      </div>
    );
  }

  // Staff scopes with courses.view receive a read-only preview:
  // course structure + content, no personal progress, no locking, no quiz-taking.
  const isPreview = !isLearner;

  return (
    <div>
      {/* ── Back link ─────────────────────────────────────── */}
      <BackLink fallback={backHref} style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        {fromManagement ? "← Course Management" : isPreview ? "← Courses" : "← My Courses"}
      </BackLink>

      <CourseView
        course={course}
        modules={modules}
        courseId={courseId}
        isPreview={isPreview}
        variant="live"
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching course…</p>
      </div>
    </div>
  );
}
