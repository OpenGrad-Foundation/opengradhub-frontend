"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getAnnouncements,
  createAnnouncement,
  type Announcement,
} from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

const ALL_ROLES: { code: string; label: string }[] = [
  { code: "SUPER_ADMIN", label: "Super Admin" },
  { code: "PROGRAM_MANAGER", label: "Program Manager" },
  { code: "ZONAL_MANAGER", label: "Zonal Manager" },
  { code: "FELLOW", label: "Fellow" },
  { code: "STUDENT", label: "Student" },
  { code: "GOVERNMENT", label: "Government" },
  { code: "FUNDING_PARTNER", label: "Funding Partner" },
];

export default function AnnouncementsPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const canCreate = roleCode === "SUPER_ADMIN" || roleCode === "PROGRAM_MANAGER";

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (!roleCode) return;
    setLoading(true);
    setError(null);
    try {
      setAnnouncements(await getAnnouncements(roleCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [roleCode]);

  useEffect(() => {
    if (!userLoading) void fetchAnnouncements();
  }, [userLoading, fetchAnnouncements]);

  if (userLoading) return <LoadingState />;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <p style={labelStyle}>Updates</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Announcements</h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>
            Latest notices and updates
          </p>
        </div>
        {canCreate && (
          <button
            id="add-announcement-btn"
            style={primaryButton}
            onClick={() => setShowModal(true)}
            onMouseEnter={hoverIn} onMouseLeave={hoverOut}
          >
            + New Announcement
          </button>
        )}
      </div>

      {/* ── Create Modal ──────────────────────────────────── */}
      {showModal && data && (
        <CreateAnnouncementModal
          userId={data.user.id}
          roleCode={roleCode}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); void fetchAnnouncements(); }}
        />
      )}

      {/* ── Content ───────────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={glassCard}><p style={{ ...titleStyle, color: "#e53e3e" }}>{error}</p></div>
      ) : announcements.length === 0 ? (
        <div style={glassCard}>
          <p style={{ ...titleStyle, marginTop: "8px" }}>No Announcements</p>
          <p style={{ ...subtitleStyle, marginTop: "8px" }}>Check back later for updates.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Announcement Card ──────────────────────────────────────────

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const dateStr = new Date(announcement.created_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div style={{ ...glassCard, padding: "28px", textAlign: "left", position: "relative", overflow: "hidden" }}>
      {/* Green left accent border */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: "var(--green, #0abe62)" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 700, color: "#034852", margin: 0, lineHeight: 1.3 }}>
          {announcement.title}
        </h3>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#209379", whiteSpace: "nowrap" }}>
          {dateStr}
        </span>
      </div>

      <p style={{ fontSize: "15px", color: "rgba(3,72,82,0.8)", lineHeight: 1.6, margin: "0 0 20px 0", whiteSpace: "pre-wrap" }}>
        {announcement.body}
      </p>

    </div>
  );
}

// ── Create Modal ───────────────────────────────────────────────

function CreateAnnouncementModal({
  userId, roleCode, onClose, onCreated
}: {
  userId: string; roleCode: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [programme, setProgramme] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleToggle = (code: string) => {
    setTargetRoles((prev) => prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (targetRoles.length === 0) {
      setError("Please select at least one target role.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        target_roles: targetRoles,
        programme_type: programme || undefined,
        created_by: userId,
        role: roleCode,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,72,82,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose} />

      {/* Modal */}
      <div style={{ ...glassCard, position: "relative", width: "100%", maxWidth: "600px", textAlign: "left", animation: "floatIn 0.3s ease-out forwards", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <p style={labelStyle}>New Announcement</p>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={formLabelStyle}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} placeholder="Announcement Title" />
          </div>

          <div>
            <label style={formLabelStyle}>Message Body *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Type the announcement here..." />
          </div>

          <div>
            <label style={formLabelStyle}>Target Roles *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "12px", background: "rgba(0,0,0,0.02)", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.06)" }}>
              {ALL_ROLES.map((r) => {
                const selected = targetRoles.includes(r.code);
                return (
                  <label key={r.code} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px", borderRadius: "100px", cursor: "pointer", background: selected ? "rgba(10,190,98,0.15)" : "rgba(255,255,255,0.6)", color: selected ? "#0a944e" : "#034852", border: selected ? "1px solid rgba(10,190,98,0.3)" : "1px solid rgba(0,0,0,0.1)", transition: "all 150ms ease", fontWeight: selected ? 600 : 400 }}>
                    <input type="checkbox" checked={selected} onChange={() => handleRoleToggle(r.code)} style={{ margin: 0, accentColor: "#0abe62" }} />
                    {r.label}
                  </label>
                );
              })}
            </div>
            <button type="button" onClick={() => setTargetRoles(targetRoles.length === ALL_ROLES.length ? [] : ALL_ROLES.map((r) => r.code))} style={{ background: "none", border: "none", color: "#209379", fontSize: "11px", fontWeight: 600, marginTop: "8px", cursor: "pointer", padding: 0 }}>
              {targetRoles.length === ALL_ROLES.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div>
            <label style={formLabelStyle}>Programme Type (Optional)</label>
            <select value={programme} onChange={(e) => setProgramme(e.target.value)} style={inputStyle}>
              <option value="">All Programmes</option>
              <option value="UG">UG Only</option>
              <option value="PG">PG Only</option>
            </select>
            <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)", marginTop: "6px" }}>If selected, students will only see this if their programme matches.</p>
          </div>

          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 20px", background: "none", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "10px", color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={submitting || !title.trim() || !body.trim() || targetRoles.length === 0} style={{ ...primaryButton, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Posting…" : "Post Announcement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shared ─────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>Fetching updates</p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Loading announcements&hellip;</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 12px 20px rgba(10,190,98,0.3)";
}

function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 8px 16px rgba(10,190,98,0.2)";
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.3)", borderRadius: "24px", padding: "32px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const subtitleStyle: React.CSSProperties = { fontSize: "14px", color: "rgba(3,72,82,0.6)" };

const primaryButton: React.CSSProperties = {
  padding: "10px 20px", border: "none", borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff",
  fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)", transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
};

const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };

const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none",
};
