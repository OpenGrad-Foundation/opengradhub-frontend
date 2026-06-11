"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  createAnnouncement,
  sendNotification,
  fetchSchools,
  type SchoolOption,
} from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";

// ── Types ──────────────────────────────────────────────────────

type Channel = "notification" | "announcement";
type NotificationScope = "all_my_students" | "schools";
// NOTE: scope='users' is hidden this round — no search endpoint exists yet.
// TODO: re-enable when GET /users/search endpoint is available.

const ALL_ROLES: { code: string; label: string }[] = [
  { code: "SUPER_ADMIN",      label: "Super Admin" },
  { code: "PROGRAM_MANAGER",  label: "Program Manager" },
  { code: "ZONAL_MANAGER",    label: "Zonal Manager" },
  { code: "FELLOW",           label: "Fellow" },
  { code: "STUDENT",          label: "Student" },
  { code: "GOVERNMENT",       label: "Government" },
  { code: "FUNDING_PARTNER",  label: "Funding Partner" },
];

// ── Props ──────────────────────────────────────────────────────

export interface ComposeMessageModalProps {
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────

export function ComposeMessageModal({ onClose }: ComposeMessageModalProps) {
  const { data, isLoading: userLoading } = useCurrentUser();
  const canCreateAnnouncement = usePermission(PERM.announcements.create);
  const canSendNotification   = usePermission(PERM.notifications.send);
  const invalidate = useInvalidate();

  // Channel defaults to announcement if allowed; otherwise forced to notification.
  const [channel, setChannel] = useState<Channel>(
    canCreateAnnouncement ? "announcement" : "notification",
  );

  // Announcement fields
  const [title,       setTitle]       = useState("");
  const [body,        setBody]        = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [programme,   setProgramme]   = useState("");
  // Note: batch_ids not included in ComposeMessageModal — handled by the
  // existing CreateAnnouncementModal in announcements/page.tsx.

  // Notification fields
  const [scope,      setScope]      = useState<NotificationScope>("all_my_students");
  const [schools,    setSchools]    = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolDropOpen, setSchoolDropOpen] = useState(false);
  const schoolWrapRef = useRef<HTMLDivElement>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync channel when permissions resolve (they may start false on first render)
  useEffect(() => {
    if (!userLoading && canCreateAnnouncement) {
      setChannel("announcement");
    }
  }, [userLoading, canCreateAnnouncement]);

  // Load schools when scope = schools
  useEffect(() => {
    if (channel !== "notification" || scope !== "schools") return;
    if (schools.length > 0) return; // already fetched
    setSchoolsLoading(true);
    fetchSchools()
      .then(setSchools)
      .catch(() => setError("Failed to load schools."))
      .finally(() => setSchoolsLoading(false));
  }, [channel, scope, schools.length]);

  // Close school dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (schoolWrapRef.current && !schoolWrapRef.current.contains(e.target as Node)) {
        setSchoolDropOpen(false);
        setSchoolQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Role toggle helper ──────────────────────────────────────

  function toggleRole(code: string) {
    setTargetRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code],
    );
  }

  // ── School picker helpers ───────────────────────────────────

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    const base = schools.filter((s) => !selectedSchoolIds.includes(s.id));
    if (!q) return base.slice(0, 50);
    return base
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [schools, schoolQuery, selectedSchoolIds]);

  function addSchool(s: SchoolOption) {
    setSelectedSchoolIds((prev) => [...prev, s.id]);
    setSchoolQuery("");
    setSchoolDropOpen(false);
  }

  function removeSchool(id: string) {
    setSelectedSchoolIds((prev) => prev.filter((x) => x !== id));
  }

  // ── Submit ──────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation
    if (channel === "announcement" && targetRoles.length === 0) {
      setError("Please select at least one target role.");
      return;
    }
    if (channel === "notification" && scope === "schools" && selectedSchoolIds.length === 0) {
      setError("Please select at least one school.");
      return;
    }

    setSubmitting(true);
    try {
      if (channel === "notification") {
        const result = await sendNotification({
          title: title.trim(),
          body:  body.trim(),
          scope,
          school_ids: scope === "schools" ? selectedSchoolIds : undefined,
          user_ids:   undefined,
        });
        invalidate("notifications", "announcements");
        setSuccessMsg(
          `Notification sent — ${result.delivered} delivered, ${result.dropped} dropped.`,
        );
        // Brief pause so the user sees the success message before close.
        setTimeout(onClose, 1800);
      } else {
        if (!data?.user.id || !data?.role.code) {
          throw new Error("User session not available — please refresh.");
        }
        await createAnnouncement({
          title:          title.trim(),
          body:           body.trim(),
          target_roles:   targetRoles,
          programme_type: programme || undefined,
          created_by:     data.user.id,
          role:           data.role.code,
        });
        invalidate("announcements");
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────

  const isAnnouncementChannel = channel === "announcement";
  const isNotificationChannel = channel === "notification";

  // If the user has neither permission, show nothing (should not happen in practice).
  if (!userLoading && !canCreateAnnouncement && !canSendNotification) return null;

  const modalTitle = isAnnouncementChannel ? "New Announcement" : "Send Notification";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "rgba(3,72,82,0.4)", backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      {/* Modal card */}
      <div
        style={{
          ...glassCard,
          position: "relative", width: "100%", maxWidth: "600px",
          textAlign: "left", animation: "floatIn 0.3s ease-out forwards",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <p style={labelStyle}>{modalTitle}</p>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Channel toggle — only shown if user has announcements.create */}
        {canCreateAnnouncement && (
          <div style={{ marginBottom: "20px" }}>
            <label style={formLabelStyle}>Channel</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["announcement", "notification"] as Channel[]).map((ch) => {
                const active = channel === ch;
                const label  = ch === "announcement" ? "Announcement" : "Notification";
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    style={{
                      padding: "8px 18px", border: "1px solid",
                      borderRadius: "100px", fontSize: "13px", fontWeight: 600,
                      cursor: "pointer", transition: "all 150ms ease",
                      borderColor:  active ? "rgba(10,190,98,0.3)" : "rgba(0,0,0,0.1)",
                      background:   active ? "rgba(10,190,98,0.15)" : "rgba(255,255,255,0.6)",
                      color:        active ? "#0a944e" : "#034852",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          {/* Title */}
          <div>
            <label style={formLabelStyle}>Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={inputStyle}
              placeholder={isAnnouncementChannel ? "Announcement title" : "Notification title"}
            />
          </div>

          {/* Body */}
          <div>
            <label style={formLabelStyle}>Message Body *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Type the message here…"
            />
          </div>

          {/* ── Announcement-specific fields ──────────────── */}
          {isAnnouncementChannel && (
            <>
              <div>
                <label style={formLabelStyle}>Target Roles *</label>
                <div
                  style={{
                    display: "flex", flexWrap: "wrap", gap: "8px",
                    padding: "12px", background: "rgba(0,0,0,0.02)",
                    borderRadius: "12px", border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {ALL_ROLES.map((r) => {
                    const selected = targetRoles.includes(r.code);
                    return (
                      <label
                        key={r.code}
                        style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          fontSize: "12px", padding: "6px 12px", borderRadius: "100px",
                          cursor: "pointer",
                          background:  selected ? "rgba(10,190,98,0.15)" : "rgba(255,255,255,0.6)",
                          color:       selected ? "#0a944e" : "#034852",
                          border:      selected ? "1px solid rgba(10,190,98,0.3)" : "1px solid rgba(0,0,0,0.1)",
                          transition:  "all 150ms ease",
                          fontWeight:  selected ? 600 : 400,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRole(r.code)}
                          style={{ margin: 0, accentColor: "#0abe62" }}
                        />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTargetRoles(
                      targetRoles.length === ALL_ROLES.length
                        ? []
                        : ALL_ROLES.map((r) => r.code),
                    )
                  }
                  style={{
                    background: "none", border: "none", color: "#209379",
                    fontSize: "11px", fontWeight: 600, marginTop: "8px",
                    cursor: "pointer", padding: 0,
                  }}
                >
                  {targetRoles.length === ALL_ROLES.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div>
                <label style={formLabelStyle}>Programme Type (Optional)</label>
                <select
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All Programmes</option>
                  <option value="UG">UG Only</option>
                  <option value="PG">PG Only</option>
                </select>
                <p style={hintStyle}>
                  If selected, students will only see this if their programme matches.
                </p>
              </div>
            </>
          )}

          {/* ── Notification-specific fields ──────────────── */}
          {isNotificationChannel && (
            <>
              <div>
                <label style={formLabelStyle}>Audience Scope *</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                  {(
                    [
                      { value: "all_my_students", label: "All my students", desc: "Every student you manage" },
                      { value: "schools",          label: "By school",       desc: "Pick one or more schools" },
                    ] as { value: NotificationScope; label: string; desc: string }[]
                  ).map((opt) => {
                    const checked = scope === opt.value;
                    return (
                      <label
                        key={opt.value}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "10px",
                          padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
                          background:  checked ? "rgba(10,190,98,0.08)" : "rgba(0,0,0,0.02)",
                          border:      checked ? "1px solid rgba(10,190,98,0.25)" : "1px solid rgba(0,0,0,0.06)",
                          transition:  "all 150ms ease",
                        }}
                      >
                        <input
                          type="radio"
                          name="scope"
                          value={opt.value}
                          checked={checked}
                          onChange={() => setScope(opt.value)}
                          style={{ marginTop: "2px", accentColor: "#0abe62" }}
                        />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "#034852" }}>
                            {opt.label}
                          </div>
                          <div style={hintStyle}>{opt.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* School multi-picker */}
              {scope === "schools" && (
                <div>
                  <label style={formLabelStyle}>Target Schools *</label>

                  {/* Selected school chips */}
                  {selectedSchoolIds.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                      {selectedSchoolIds.map((id) => {
                        const s = schools.find((x) => x.id === id);
                        return (
                          <span
                            key={id}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "6px",
                              padding: "4px 10px", borderRadius: "100px", fontSize: "12px",
                              fontWeight: 600, background: "rgba(10,190,98,0.15)",
                              color: "#0a944e", border: "1px solid rgba(10,190,98,0.3)",
                            }}
                          >
                            {s?.name ?? id}
                            <button
                              type="button"
                              onClick={() => removeSchool(id)}
                              style={{
                                background: "none", border: "none", padding: 0,
                                cursor: "pointer", fontSize: "11px", color: "#0a944e",
                                lineHeight: 1,
                              }}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Searchable dropdown */}
                  <div ref={schoolWrapRef} style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder={schoolsLoading ? "Loading schools…" : "Search school by name or code…"}
                      disabled={schoolsLoading}
                      value={schoolQuery}
                      onFocus={() => setSchoolDropOpen(true)}
                      onChange={(e) => { setSchoolQuery(e.target.value); setSchoolDropOpen(true); }}
                      style={inputStyle}
                    />
                    {schoolDropOpen && filteredSchools.length > 0 && (
                      <div style={dropdownStyle}>
                        {filteredSchools.map((s) => (
                          <div
                            key={s.id}
                            onMouseDown={(e) => { e.preventDefault(); addSchool(s); }}
                            style={dropdownRowStyle}
                          >
                            <span style={{ fontWeight: 600, color: "#034852" }}>{s.name}</span>
                            <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)" }}>
                              {[s.code, s.district, s.state].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {schoolDropOpen && !schoolsLoading && filteredSchools.length === 0 && schoolQuery.trim().length > 0 && (
                      <div style={dropdownStyle}>
                        <div style={{ ...dropdownRowStyle, color: "rgba(3,72,82,0.5)", cursor: "default" }}>
                          No schools found
                        </div>
                      </div>
                    )}
                  </div>
                  <p style={hintStyle}>Only students in these schools will receive the notification.</p>
                </div>
              )}
            </>
          )}

          {/* Error / success messages */}
          {error     && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{error}</p>}
          {successMsg && <p style={{ fontSize: "13px", color: "#0a944e", fontWeight: 600 }}>{successMsg}</p>}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px", background: "none",
                border: "1px solid rgba(3,72,82,0.2)", borderRadius: "10px",
                color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                !title.trim() ||
                !body.trim() ||
                (isAnnouncementChannel && targetRoles.length === 0) ||
                (isNotificationChannel && scope === "schools" && selectedSchoolIds.length === 0)
              }
              style={{ ...primaryButton, opacity: submitting ? 0.6 : 1 }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              {submitting
                ? isAnnouncementChannel ? "Posting…" : "Sending…"
                : isAnnouncementChannel ? "Post Announcement" : "Send Notification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform  = "translateY(-2px)";
  e.currentTarget.style.boxShadow  = "0 12px 20px rgba(10,190,98,0.3)";
}
function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform  = "translateY(0)";
  e.currentTarget.style.boxShadow  = "0 8px 16px rgba(10,190,98,0.2)";
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.3)", borderRadius: "24px", padding: "32px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379",
};

const primaryButton: React.CSSProperties = {
  padding: "10px 20px", border: "none", borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff",
  fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)", transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", fontSize: "18px",
  color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px",
};

const formLabelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px", outline: "none",
  boxSizing: "border-box",
};

const hintStyle: React.CSSProperties = {
  fontSize: "11px", color: "rgba(3,72,82,0.5)", marginTop: "6px",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
  maxHeight: "260px", overflowY: "auto", background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.14)", borderRadius: "12px",
  boxShadow: "0 12px 32px rgba(3,72,82,0.16)",
};

const dropdownRowStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "2px",
  padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid rgba(3,72,82,0.05)",
};
