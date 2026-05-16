"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAuditLogs,
  getAuditLogActions,
  getAuditLogStats,
  type AuditLogEntry,
  type AuditLogStats,
  type PaginatedAuditLogs,
} from "@/lib/api";

// ── Action → Human-readable label ──────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  COURSE_CREATED: "Course Created",
  COURSE_UPDATED: "Course Updated",
  USER_CREATED: "User Created",
  USER_ROLE_CHANGED: "Role Changed",
  USERS_BULK_IMPORTED: "Bulk Import",
  STUDENT_ENROLLED: "Student Enrolled",
  BULK_ENROLMENT: "Bulk Enrolment",
  BULK_UNENROLMENT: "Bulk Unenrolment",
  MODULE_CREATED: "Module Created",
  MODULE_UPDATED: "Module Updated",
  MODULE_DELETED: "Module Deleted",
  LESSON_CREATED: "Lesson Created",
  LESSON_UPDATED: "Lesson Updated",
  LESSON_DELETED: "Lesson Deleted",
  QUIZ_CREATED: "Quiz Created",
  QUIZ_UPDATED: "Quiz Updated",
  QUIZ_PUBLISHED: "Quiz Published",
  QUESTION_CREATED: "Question Created",
  QUESTION_UPDATED: "Question Updated",
  QUESTION_DELETED: "Question Deleted",
  ASSIGNMENT_CREATED: "Assignment Created",
  ASSIGNMENT_SUBMITTED: "Assignment Submitted",
  ASSIGNMENT_GRADED: "Assignment Graded",
  ANNOUNCEMENT_CREATED: "Announcement Created",
  LIVE_CLASS_CREATED: "Live Class Created",
  LIVE_CLASS_JOINED: "Live Class Joined",
  BUNDLE_CREATED: "Bundle Created",
  RESOURCE_UPLOADED: "Resource Uploaded",
  DOUBT_POSTED: "Doubt Posted",
  SIGN_IN_TOKEN_CREATED: "Sign-In",
  PASSWORD_RESET: "Password Reset",
  USER_LOGGED_IN: "Login",
  USER_LOGGED_OUT: "Logout",
  PERMISSION_OVERRIDE_ADDED: "Override Added",
  PERMISSION_OVERRIDE_REMOVED: "Override Removed",
  SCHOOL_ASSIGNED: "School Assigned",
};

// ── Action badge colours ───────────────────────────────────────
function actionColor(action: string) {
  if (action.includes("DELETE") || action.includes("REMOVED") || action.includes("UNENROL"))
    return { bg: "rgba(229,62,62,0.08)", color: "#e53e3e", border: "rgba(229,62,62,0.2)" };
  if (action.includes("CREATED") || action.includes("ENROLLED") || action.includes("IMPORTED"))
    return { bg: "rgba(10,190,98,0.08)", color: "#0abe62", border: "rgba(10,190,98,0.2)" };
  if (action.includes("UPDATED") || action.includes("PUBLISHED") || action.includes("GRADED"))
    return { bg: "rgba(0,109,108,0.08)", color: "#006d6c", border: "rgba(0,109,108,0.2)" };
  if (action.includes("LOGIN") || action.includes("SIGN_IN") || action.includes("LOGGED_IN"))
    return { bg: "rgba(32,147,121,0.08)", color: "#209379", border: "rgba(32,147,121,0.2)" };
  return { bg: "rgba(3,72,82,0.06)", color: "#034852", border: "rgba(3,72,82,0.15)" };
}

function httpMethodColor(method: string | null) {
  switch (method) {
    case "POST":   return "#0abe62";
    case "PATCH":  return "#006d6c";
    case "DELETE": return "#e53e3e";
    default:       return "#999";
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "#209379",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  color: "#034852",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 14px",
  border: "1.5px solid rgba(3,72,82,0.15)",
  borderRadius: "12px",
  fontFamily: "var(--font-body)",
  fontSize: "13px",
  color: "#034852",
  background: "#fff",
  outline: "none",
  transition: "border-color 180ms",
};

const thStyle: React.CSSProperties = {
  padding: "14px 16px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "rgba(3,72,82,0.5)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: "rgba(3,72,82,0.8)",
  whiteSpace: "nowrap",
};

// ── Page Component ─────────────────────────────────────────────

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<PaginatedAuditLogs | null>(null);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsData, statsData, actionsData] = await Promise.all([
        getAuditLogs({ search, action: actionFilter || undefined, page, pageSize: 30 }),
        getAuditLogStats(),
        getAuditLogActions(),
      ]);
      setLogs(logsData);
      setStats(statsData);
      setActions(actionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity log.");
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, page]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [search, actionFilter]);

  if (error) {
    return (
      <div style={glassCard}>
        <p style={{ ...titleStyle, color: "#e53e3e" }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <p style={labelStyle}>Administration</p>
        <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 0" }}>Activity Log</h1>
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)", marginTop: "4px" }}>
          Real-time audit trail of all platform activity
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <StatCard label="Today" value={stats.today} accent="#0abe62" />
          <StatCard label="This Week" value={stats.this_week} accent="#006d6c" />
          <StatCard
            label="Top Action"
            value={stats.top_actions[0]?.action ? ACTION_LABELS[stats.top_actions[0].action] ?? stats.top_actions[0].action : "—"}
            subValue={stats.top_actions[0] ? `${stats.top_actions[0].count} events` : ""}
            accent="#209379"
          />
          <StatCard
            label="Most Active User"
            value={stats.top_users[0]?.user_name ?? "—"}
            subValue={stats.top_users[0] ? `${stats.top_users[0].count} actions` : ""}
            accent="#034852"
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ ...glassCard, padding: "16px 20px", marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 220px" }}>
          <input
            id="audit-search"
            type="text"
            placeholder="Search actions, paths, users…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: "0 1 200px" }}>
          <select
            id="audit-action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
            ))}
          </select>
        </div>
        <button
          id="audit-refresh-btn"
          onClick={() => void fetchLogs()}
          style={{
            padding: "9px 18px",
            borderRadius: "12px",
            border: "1.5px solid rgba(0,109,108,0.2)",
            background: "rgba(0,109,108,0.06)",
            color: "#006d6c",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 180ms",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: "3px solid rgba(0,109,108,0.15)", borderTopColor: "#006d6c", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ marginTop: "12px", fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>Loading activity…</p>
          </div>
        ) : !logs || logs.items.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <p style={{ fontSize: "40px", marginBottom: "8px" }}>📋</p>
            <p style={{ ...titleStyle, fontSize: "16px" }}>No activity found</p>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", marginTop: "4px" }}>
              {search || actionFilter ? "Try adjusting your filters." : "Activity will appear here as users interact with the platform."}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(3,72,82,0.08)" }}>
                    <th style={thStyle}>When</th>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Resource</th>
                    <th style={thStyle}>Method</th>
                    <th style={thStyle}>Path</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.items.map((log) => {
                    const ac = actionColor(log.action);
                    const isExpanded = expandedRow === log.id;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                        style={{
                          borderBottom: "1px solid rgba(3,72,82,0.05)",
                          cursor: "pointer",
                          background: isExpanded ? "rgba(0,109,108,0.03)" : "transparent",
                          transition: "background 150ms",
                        }}
                        onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget).style.background = "rgba(0,0,0,0.015)"; }}
                        onMouseLeave={(e) => { (e.currentTarget).style.background = isExpanded ? "rgba(0,109,108,0.03)" : "transparent"; }}
                      >
                        <td style={tdStyle}>
                          <span title={new Date(log.created_at).toLocaleString()}>{timeAgo(log.created_at)}</span>
                        </td>
                        <td style={tdStyle}>
                          <strong style={{ color: "#034852" }}>{log.user_name ?? "System"}</strong>
                          {log.user_role && (
                            <span style={{ display: "block", fontSize: "11px", color: "rgba(3,72,82,0.45)", marginTop: "1px" }}>
                              {log.user_role}
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "100px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: ac.bg,
                            color: ac.color,
                            border: `1px solid ${ac.border}`,
                          }}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {log.resource_type && (
                            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.6)" }}>
                              {log.resource_type}
                              {log.resource_id && (
                                <span style={{ color: "rgba(3,72,82,0.35)", marginLeft: "4px" }}>
                                  #{log.resource_id.slice(0, 8)}
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {log.http_method && (
                            <span style={{ fontWeight: 700, fontSize: "11px", color: httpMethodColor(log.http_method), fontFamily: "ui-monospace, monospace" }}>
                              {log.http_method}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                            {log.path ?? "—"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {log.status_code && (
                            <span style={{
                              fontWeight: 700,
                              fontSize: "11px",
                              color: log.status_code < 400 ? "#0abe62" : "#e53e3e",
                            }}>
                              {log.status_code}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px",
              borderTop: "1px solid rgba(3,72,82,0.06)",
              fontSize: "13px",
              color: "rgba(3,72,82,0.55)",
            }}>
              <span>
                Showing {((logs.page - 1) * logs.page_size) + 1}–{Math.min(logs.page * logs.page_size, logs.total)} of {logs.total}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <PaginationBtn
                  disabled={!logs.has_prev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  label="← Prev"
                />
                <span style={{ padding: "6px 12px", fontWeight: 700, color: "#034852" }}>
                  {logs.page} / {logs.total_pages}
                </span>
                <PaginationBtn
                  disabled={!logs.has_next}
                  onClick={() => setPage((p) => p + 1)}
                  label="Next →"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, subValue, accent }: {
  label: string;
  value: string | number;
  subValue?: string;
  accent: string;
}) {
  return (
    <div style={{
      ...glassCard,
      padding: "20px 22px",
      borderLeft: `3px solid ${accent}`,
      opacity: 0,
      transform: "translateY(8px)",
      animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
    }}>
      <p style={{ ...labelStyle, color: accent, marginBottom: "6px" }}>{label}</p>
      <p style={{ ...titleStyle, fontSize: "24px", margin: 0 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subValue && (
        <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)", marginTop: "4px" }}>{subValue}</p>
      )}
    </div>
  );
}

function PaginationBtn({ disabled, onClick, label }: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: "10px",
        border: "1.5px solid rgba(3,72,82,0.12)",
        background: disabled ? "transparent" : "rgba(0,109,108,0.06)",
        color: disabled ? "rgba(3,72,82,0.25)" : "#006d6c",
        fontFamily: "var(--font-body)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        transition: "all 180ms",
      }}
    >
      {label}
    </button>
  );
}
