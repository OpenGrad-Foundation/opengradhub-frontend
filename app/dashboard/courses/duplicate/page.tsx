"use client";

import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import CourseCatalogue from "../_components/CourseCatalogue";

/** Browse every programme's published courses to pick one to duplicate. */
export default function DuplicateCoursePage() {
  const { has, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!has(PERM.courses.create)) {
    return (
      <div style={{ maxWidth: "720px", margin: "0 auto", background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "24px", padding: "40px 48px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 }}>Access Denied</p>
        <p style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852", margin: "12px 0 0" }}>You do not have permission to duplicate courses.</p>
      </div>
    );
  }
  return <CourseCatalogue mode="duplicate" />;
}
