"use client";

import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createCourse } from "@/lib/api";
import CourseMetaForm from "../_components/CourseMetaForm";
import type { RoleCode } from "@/lib/moduleAccess";

const ALLOWED: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

export default function NewCoursePage() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();

  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId = data?.user?.id ?? "";

  if (isLoading) return <PageShell><LoadingCard /></PageShell>;

  if (!ALLOWED.includes(roleCode)) {
    return (
      <PageShell>
        <div style={glassCard}>
          <p style={label}>Access Denied</p>
          <p style={title}>You do not have permission to create courses.</p>
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
    const course = await createCourse({
      ...fields,
      created_by: userId,
      role: roleCode,
    });
    router.push(`/dashboard/courses/${course.id}/builder`);
  }

  return (
    <PageShell>
      <div style={{ marginBottom: "28px" }}>
        <p style={label}>Courses</p>
        <h1 style={{ ...title, fontSize: "28px", margin: 0 }}>New Course</h1>
        <p style={subtitle}>Fill in the details below, then save as a draft.</p>
      </div>
      <CourseMetaForm onSave={handleSave} submitLabel="Save as Draft" />
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
      <p style={{ ...title, marginTop: "12px" }}>Preparing form…</p>
    </div>
  );
}

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "24px",
  padding: "40px 48px",
  boxShadow: "0 32px 64px rgba(0,0,0,0.08)",
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
