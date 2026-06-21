"use client";

import { useEffect, useState } from "react";
import { useLiveClassAttendees } from "@/lib/queries/live-classes";

type Props = {
  liveClassId: string;
  title: string;
  onClose: () => void;
};

export function LiveClassAttendeesModal({ liveClassId, title, onClose }: Props) {
  const { data, isPending, error } = useLiveClassAttendees(liveClassId);
  const [activeTab, setActiveTab] = useState<"joined" | "missed">("joined");

  const joined = data?.joined || [];
  const missed = data?.missed || [];
  const activeList = activeTab === "joined" ? joined : missed;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function formatJoinedAt(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <div
      style={backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Attendees for ${title}`}
    >
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <p style={S.label}>Attendance</p>
            <h2 style={{ ...S.heading, fontSize: "18px", margin: "4px 0 0" }}>{title}</h2>
            {!isPending && !error && (
              <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)", margin: "4px 0 0" }}>
                {joined.length} {joined.length === 1 ? "student" : "students"} joined, {missed.length} missed
              </p>
            )}
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        {!isPending && !error && (
          <div style={{ display: "flex", gap: "16px", marginBottom: "16px", borderBottom: "1px solid rgba(3,72,82,0.1)" }}>
            <button
              onClick={() => setActiveTab("joined")}
              style={{
                ...tabStyle,
                borderBottom: activeTab === "joined" ? "2px solid #209379" : "2px solid transparent",
                color: activeTab === "joined" ? "#034852" : "rgba(3,72,82,0.5)",
                fontWeight: activeTab === "joined" ? 600 : 400,
              }}
            >
              Joined ({joined.length})
            </button>
            <button
              onClick={() => setActiveTab("missed")}
              style={{
                ...tabStyle,
                borderBottom: activeTab === "missed" ? "2px solid #e53e3e" : "2px solid transparent",
                color: activeTab === "missed" ? "#034852" : "rgba(3,72,82,0.5)",
                fontWeight: activeTab === "missed" ? 600 : 400,
              }}
            >
              Missed ({missed.length})
            </button>
          </div>
        )}

        {/* Content */}
        {isPending ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(3,72,82,0.5)" }}>
            Loading attendees…
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#e53e3e", fontWeight: 600 }}>
            Could not load attendees.
          </div>
        ) : activeList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <p style={S.label}>No Attendees</p>
            <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.55)", marginTop: "8px" }}>
              {activeTab === "joined" ? "No one joined this class." : "No one missed this class."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  {activeTab === "joined" && <th style={thStyle}>Joined At</th>}
                </tr>
              </thead>
              <tbody>
                {activeList.map((a: any) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid rgba(3,72,82,0.07)" }}>
                    <td style={tdStyle}>{a.name}</td>
                    <td style={{ ...tdStyle, color: "rgba(3,72,82,0.6)" }}>{a.email}</td>
                    {activeTab === "joined" && <td style={{ ...tdStyle, color: "rgba(3,72,82,0.5)" }}>{formatJoinedAt(a.joined_at)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  backdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: "20px",
  padding: "28px",
  width: "min(600px, 90vw)",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
  display: "flex",
  flexDirection: "column",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "18px",
  cursor: "pointer",
  color: "rgba(3,72,82,0.5)",
  padding: "4px 8px",
  borderRadius: "6px",
  flexShrink: 0,
};

const tabStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "8px 4px",
  cursor: "pointer",
  fontSize: "14px",
  transition: "all 0.2s",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#209379",
  borderBottom: "2px solid rgba(3,72,82,0.08)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "#034852",
};

const S = {
  label:   { fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
};
