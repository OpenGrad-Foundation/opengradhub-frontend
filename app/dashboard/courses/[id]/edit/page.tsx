"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getCourseById, updateCourse, type Course } from "@/lib/api";
import CourseMetaForm from "../../_components/CourseMetaForm";
import type { RoleCode } from "@/lib/moduleAccess";

const ALLOWED: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const { data, isLoading: userLoading } = useCurrentUser();
  const [course, setCourse] = useState<Course | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId = data?.user?.id ?? "";

  useEffect(() => {
    if (!userLoading && courseId) {
      getCourseById(courseId)
        .then(setCourse)
        .catch((e: unknown) =>
          setFetchError(e instanceof Error ? e.message : "Failed to load course.")
        );
    }
  }, [userLoading, courseId]);

  if (userLoading || (!course && !fetchError)) {
    return <PageShell><LoadingCard /></PageShell>;
  }

  if (!ALLOWED.includes(roleCode)) {
    return (
      <PageShell>
        <div style={glassCard}>
          <p style={label}>Access Denied</p>
          <p style={title}>You do not have permission to edit courses.</p>
        </div>
      </PageShell>
    );
  }

  if (fetchError) {
    return (
      <PageShell>
        <div style={glassCard}>
          <p style={label}>Error</p>
          <p style={title}>{fetchError}</p>
        </div>
      </PageShell>
    );
  }

  async function handleSave(fields: {
    title: string;
    description: string;
    programme_type: string;
    cover_image_url: string;
    locking_mode: string;
    access_type: string;
  }) {
    await updateCourse(courseId, {
      ...fields,
      caller_id: userId,
      caller_role: roleCode,
    });
    router.push(`/dashboard/courses/${courseId}/builder`);
  }

  return (
    <PageShell>
      <div style={{ marginBottom: "28px" }}>
        <p style={label}>Courses</p>
        <h1 style={{ ...title, fontSize: "28px", margin: 0 }}>Edit Course</h1>
        <p style={subtitle}>Update course details. Changes are saved immediately.</p>
      </div>
      <CourseMetaForm
        initial={course!}
        onSave={handleSave}
        submitLabel="Save Changes"
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: "720px", margin: "0 auto" }}>{children}</div>;
}

function LoadingCard() {
  return (
    <div style={glassCard}>
      <p style={label}>Loading</p>
      <p style={{ ...title, marginTop: "12px" }}>Fetching course…</p>
    </div>
  );
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "24px",
  padding: "40px 48px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};

const label: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: "#209379",
  margin: 0,
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "22px",
  fontWeight: 700,
  color: "#034852",
  margin: 0,
};

const subtitle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
  marginTop: "4px",
};
