"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
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
          <p style={label}>Access denied</p>
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
        {/* The other way in: start from a course another programme already
            built. Browse is read-only; the copy lands in your programme. */}
        <div style={callout}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
            Already exists in another programme?
          </p>
          <Link href="/dashboard/courses/duplicate" style={calloutBtn}>
            <Copy size={16} aria-hidden="true" />Duplicate a course
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
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px, 4vw, 24px)",
};

const label: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
  margin: 0,
};

const title: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "var(--color-text)",
  margin: 0,
};

const callout: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
  marginTop: "18px", padding: "14px 18px", borderRadius: "12px",
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
};
const calloutBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
  minHeight: "44px", padding: "8px 16px", borderRadius: "12px", whiteSpace: "nowrap",
  border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)",
  fontSize: "14px", fontWeight: 600, textDecoration: "none",
};
