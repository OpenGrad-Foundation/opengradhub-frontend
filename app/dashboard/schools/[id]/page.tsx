"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BackLink } from "@/components/back-link";
import {
  fetchSchoolRosterDetail,
  getSchoolDetail,
  updateUser,
  type SchoolRosterDetail,
  type SchoolDetail as SchoolAnalytics,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { SchoolFormModal } from "../SchoolFormModal";
import { AddStudentsPanel } from "./AddStudentsPanel";
import {
  labelStyle, titleStyle, primaryButton, secondaryButton, thStyle, tdStyle, linkBtnStyle,
} from "../styles";

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { has } = usePermissions();
  const canEditSchool = has(PERM.schools.edit);
  const canEditRoster = has(PERM.user_management.edit);
  const invalidate = useInvalidate();

  const [detail, setDetail] = useState<SchoolRosterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const [analytics, setAnalytics] = useState<SchoolAnalytics | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchSchoolRosterDetail(id);
      setDetail(d);
      hasLoadedRef.current = true;
      setError(null);
      setRosterError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load school.";
      // A failed refetch must not unmount the page (or an open panel) when we
      // already have data — surface it inline instead.
      if (hasLoadedRef.current) setRosterError(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Analytics summary degrades silently: roles without analytics.view_fellow
  // get a 403 here and simply see no card.
  useEffect(() => {
    let cancelled = false;
    getSchoolDetail(id)
      .then((a) => { if (!cancelled) setAnalytics(a); })
      .catch(() => { if (!cancelled) setAnalytics(null); });
    return () => { cancelled = true; };
  }, [id]);

  async function removeStudent(studentId: string) {
    setRemovingId(studentId);
    setRosterError(null);
    try {
      // "" → NULL on the backend (users.service: school_id = patch.school_id || null)
      await updateUser(studentId, { school_id: "" });
      invalidate("schools", "users");
      setConfirmRemoveId(null);
      await load();
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : "Failed to remove student.");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) return <p style={{ color: "rgba(3,72,82,0.6)" }}>Loading school…</p>;

  if (error || !detail) {
    return (
      <div>
        <BackLink fallback="/dashboard/schools" style={backLinkStyle} />
        <p style={{ color: "#c53030", fontWeight: 600, marginTop: "16px" }}>
          {error ?? "School not found."}
        </p>
      </div>
    );
  }

  const { school, stats, students } = detail;

  return (
    <div>
      <BackLink fallback="/dashboard/schools" style={backLinkStyle} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={{ margin: "12px 0 24px" }}>
        <div>
          <p style={labelStyle}>School</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 8px" }}>{school.name}</h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {school.code && <span style={chipStyle}>{school.code}</span>}
            {school.state && <span style={chipStyle}>{school.state}</span>}
            {school.district && <span style={chipStyle}>{school.district}</span>}
          </div>
        </div>
        {canEditSchool && (
          <button onClick={() => setShowEdit(true)} style={secondaryButton}>Edit School</button>
        )}
      </div>

      {showEdit && (
        <SchoolFormModal
          mode="edit"
          school={school}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); void load(); }}
        />
      )}

      {/* Fellow + stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={cardStyle}>
          <p style={cardLabelStyle}>Assigned Fellow</p>
          {school.fellow_name ? (
            <>
              <p style={cardValueStyle}>{school.fellow_name}</p>
              {school.fellow_email && (
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.6)" }}>{school.fellow_email}</p>
              )}
            </>
          ) : (
            <p style={{ ...cardValueStyle, color: "rgba(3,72,82,0.45)" }}>Unassigned</p>
          )}
        </div>
        <div style={cardStyle}>
          <p style={cardLabelStyle}>Students</p>
          <p style={cardValueStyle}>{stats.student_count}</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {stats.programmes.map((p) => (
              <span key={p.programme ?? "none"} style={chipStyle}>
                {p.programme ?? "No programme"}: {p.count}
              </span>
            ))}
          </div>
        </div>
        {analytics && (
          <div style={cardStyle}>
            <p style={cardLabelStyle}>Avg Completion</p>
            <p style={cardValueStyle}>{analytics.avg_completion}%</p>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.6)" }}>
              {analytics.at_risk_count} at-risk student{analytics.at_risk_count === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      {/* Analytics: section scores */}
      {analytics && analytics.section_scores.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <p style={cardLabelStyle}>Avg Quiz Score by Section</p>
          <div style={{ display: "grid", gap: "8px" }}>
            {analytics.section_scores.slice(0, 8).map((row) => (
              <div key={row.section} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ flex: "0 0 220px", fontSize: "13px", color: "#034852", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.section}
                </span>
                <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "rgba(3,72,82,0.08)" }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, row.avg_score))}%`, height: "100%", borderRadius: "4px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)" }} />
                </div>
                <span style={{ flex: "0 0 48px", fontSize: "13px", fontWeight: 700, color: "#034852", textAlign: "right" }}>
                  {row.avg_score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h2 style={{ ...titleStyle, fontSize: "18px", margin: 0 }}>
          Students ({stats.student_count})
        </h2>
        {canEditRoster && (
          <button onClick={() => setShowAdd(true)} style={primaryButton}>+ Add Students</button>
        )}
      </div>

      {rosterError && (
        <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px" }}>{rosterError}</p>
      )}

      <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "rgba(3,72,82,0.05)", textAlign: "left" }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Roll Number</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Programme</th>
              {canEditRoster && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={canEditRoster ? 5 : 4} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>
                  No students assigned to this school yet.
                </td>
              </tr>
            ) : students.map((st) => (
              <tr key={st.id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                <td style={tdStyle}>{st.name}</td>
                <td style={tdStyle}>{st.roll_number ?? "—"}</td>
                <td style={tdStyle}>{st.email ?? "—"}</td>
                <td style={tdStyle}>{st.programme ?? "—"}</td>
                {canEditRoster && (
                  <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                    {confirmRemoveId === st.id ? (
                      <>
                        <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.7)", marginRight: "8px" }}>
                          Remove from school?
                        </span>
                        <button
                          onClick={() => void removeStudent(st.id)}
                          disabled={removingId === st.id}
                          style={{ ...linkBtnStyle, color: "#c53030", opacity: removingId === st.id ? 0.5 : 1 }}
                        >
                          {removingId === st.id ? "Removing…" : "Yes"}
                        </button>
                        <button onClick={() => { setConfirmRemoveId(null); setRosterError(null); }} style={{ ...linkBtnStyle, marginLeft: "8px" }}>
                          No
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmRemoveId(st.id)} style={{ ...linkBtnStyle, color: "#c53030" }}>
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddStudentsPanel
          schoolId={school.id}
          schoolName={school.name}
          currentStudentIds={students.map((s) => s.id)}
          onClose={() => setShowAdd(false)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

const backLinkStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 700, color: "#0abe62", textDecoration: "none" };
const chipStyle: React.CSSProperties = { display: "inline-block", padding: "4px 10px", borderRadius: "999px", background: "rgba(3,72,82,0.06)", fontSize: "12px", fontWeight: 600, color: "#034852" };
const cardStyle: React.CSSProperties = { padding: "20px", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" };
const cardLabelStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" };
const cardValueStyle: React.CSSProperties = { margin: "0 0 6px", fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 700, color: "#034852" };
