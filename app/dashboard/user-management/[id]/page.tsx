"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { UserDetailPanel } from "@/app/dashboard/_components/UserDetailPanel";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { useStaffProfile } from "@/lib/queries/users";
import { RoleBadge } from "../_components/role-badge";
import { card, Kpi, BRAND, muted, formatDate } from "./_components/section-card";
import {
  OrgSection, TasksSection, DoubtsSection, SchoolsSection, AttendanceSection, ContentSection, ActivitySection,
} from "./_components/profile-sections";

const backLinkStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 700, color: "#0abe62", textDecoration: "none" };

/**
 * One page per non-student user: identity, reporting line, and whatever sections
 * the server returned. Presence of a key == the caller is allowed to see it; the
 * page never decides permissions itself.
 */
export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isPending, error } = useStaffProfile(id);
  const { data: me } = useCurrentUser();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(false);

  if (error) {
    return (
      <div>
        <BackLink fallback="/dashboard/user-management" style={backLinkStyle} />
        <p style={{ color: BRAND.red, fontWeight: 600, marginTop: "16px" }}>
          {error instanceof Error ? error.message : "User not found."}
        </p>
      </div>
    );
  }
  if (isPending || !data) {
    return (
      <div>
        <BackLink fallback="/dashboard/user-management" style={backLinkStyle} />
        <p style={{ ...muted, marginTop: "16px" }}>Loading profile…</p>
      </div>
    );
  }

  const { user, org, tracker, doubts, schools, attendance, content, activity } = data;
  const meta = [
    ...user.programmes.map((p) => p.name),
    user.zone, user.district, user.state,
    user.status === "ACTIVE" ? null : user.status,
  ].filter(Boolean) as string[];
  const callerId = me?.user?.id ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <BackLink fallback="/dashboard/user-management" style={backLinkStyle} />

      <div style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 700, color: BRAND.dark, margin: 0 }}>
            {user.name}
          </h1>
          <RoleBadge role={user.role} />
          {data.caps.edit && data.edit_user && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: "10px", border: "1px solid rgba(3,72,82,0.15)",
                       background: "#fff", fontWeight: 700, fontSize: "13px", color: BRAND.dark, cursor: "pointer" }}
            >
              Edit user
            </button>
          )}
        </div>
        {meta.length > 0 && (
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "8px 0 0" }}>{meta.join(" · ")}</p>
        )}
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "4px 0 0" }}>
          Joined {formatDate(user.created_at)} · Last check-in {formatDate(user.last_check_in_at)}
          {user.email !== undefined && <> · {user.email ?? "no email"}</>}
          {user.phone !== undefined && <> · {user.phone ?? "no phone"}</>}
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
        {tracker && <Kpi label="Open tasks" value={String(tracker.counts.total - tracker.counts.done)} />}
        {tracker && <Kpi label="Overdue" value={String(tracker.counts.overdue)} />}
        {doubts && <Kpi label="Open doubts" value={String(doubts.open_for_responsibility)} />}
        {schools && <Kpi label="Schools" value={String(schools.total)} />}
        <Kpi label="Direct reports" value={String(org.reports_total)} />
      </div>

      <OrgSection org={org} />
      {tracker && <TasksSection tracker={tracker} userId={user.id} />}
      {doubts && <DoubtsSection doubts={doubts} />}
      {schools && <SchoolsSection schools={schools} />}
      {attendance && <AttendanceSection attendance={attendance} />}
      {content && <ContentSection content={content} />}
      <ActivitySection activity={activity} />

      {editing && data.edit_user && callerId && (
        <UserDetailPanel
          user={data.edit_user}
          callerId={callerId}
          onClose={() => setEditing(false)}
          onUpdated={() => { invalidate("users"); }}
          onDeleted={() => { setEditing(false); invalidate("users"); router.push("/dashboard/user-management"); }}
          onAssignCourse={() => {}}
          onAssignBundle={() => {}}
          onAssignBatch={() => {}}
        />
      )}
    </div>
  );
}
