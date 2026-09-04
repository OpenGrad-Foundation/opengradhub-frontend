"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createCourse } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import CourseMetaForm from "../_components/CourseMetaForm";

export default function NewCoursePage() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const invalidate = useInvalidate();

  const userId = data?.user?.id ?? "";

  if (isLoading || permLoading) return <PageShell><LoadingCard /></PageShell>;

  if (!has(PERM.courses.create)) {
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
    });
    invalidate('courses');
    router.push(`/dashboard/courses/${course.id}/builder`);
  }

  return (
    <PageShell>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ ...title, fontSize: "28px", margin: 0 }}>New Course</h1>
        {/* The other way in: start from a course another programme already
            built. Browse is read-only; the copy lands in your programme. */}
        <div style={callout}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#034852" }}>
            Already exists in another programme?
          </p>
          <Link href="/dashboard/courses/duplicate" style={calloutBtn}>
            Duplicate a course →
          </Link>
        </div>
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

const callout: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
  marginTop: "18px", padding: "14px 18px", borderRadius: "14px",
  background: "rgba(147,32,121,0.05)", border: "1px solid rgba(147,32,121,0.16)",
};
const calloutBtn: React.CSSProperties = {
  padding: "10px 18px", borderRadius: "10px", whiteSpace: "nowrap",
  border: "1px solid rgba(147,32,121,0.3)", background: "#ffffff", color: "#932079",
  fontSize: "13px", fontWeight: 700, textDecoration: "none",
};
