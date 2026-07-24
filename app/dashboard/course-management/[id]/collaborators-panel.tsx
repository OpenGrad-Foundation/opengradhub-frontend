"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCourseCollaborators,
  getEligibleCollaborators,
  type CourseCollaborator,
  type EligibleCollaborator,
} from "@/lib/api";
import { useAddCollaborator, useRemoveCollaborator } from "@/lib/mutations/courses";

/**
 * Collaborators panel — rendered on the Settings tab of the course
 * management page. The list is visible to any manager of the course;
 * add/remove controls only to the creator or a SUPER_ADMIN (the backend
 * enforces the same rule).
 */
export default function CollaboratorsPanel({
  courseId,
  createdBy,
  callerId,
  callerRole,
}: {
  courseId: string;
  createdBy: string;
  callerId: string;
  callerRole: string;
}) {
  const canShare = callerRole === "SUPER_ADMIN" || callerId === createdBy;

  const [collaborators, setCollaborators] = useState<CourseCollaborator[]>([]);
  const [eligible, setEligible] = useState<EligibleCollaborator[]>([]);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const addMutation = useAddCollaborator();
  const removeMutation = useRemoveCollaborator();

  const filteredEligible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        u.role.replace(/_/g, " ").toLowerCase().includes(q),
    );
  }, [eligible, query]);

  // Close the picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await getCourseCollaborators(courseId);
      setCollaborators(list);
      if (canShare) setEligible(await getEligibleCollaborators(courseId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collaborators.");
    } finally {
      setLoading(false);
    }
  }, [courseId, canShare]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (userId: string) => {
    try {
      setError(null);
      await addMutation.mutateAsync({ courseId, userId });
      setQuery("");
      setPickerOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add collaborator.");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setError(null);
      await removeMutation.mutateAsync({ courseId, userId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove collaborator.");
    }
  };

  return (
    <div className="course-mgmt-card" style={card}>
      <style>{`
        .collab-pick-row:hover:not(:disabled) { background: rgba(10,190,98,0.08); }
        .collab-pick-row:focus-visible { outline: 2px solid #209379; outline-offset: -2px; background: rgba(10,190,98,0.08); }
        .collab-pick-row:disabled { opacity: 0.6; cursor: default; }
        .collab-pick-row .collab-add-hint { opacity: 0; transition: opacity 150ms ease-out; }
        .collab-pick-row:hover .collab-add-hint,
        .collab-pick-row:focus-visible .collab-add-hint { opacity: 1; }
        @media (hover: none) { .collab-pick-row .collab-add-hint { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .collab-pick-row .collab-add-hint { transition: none; } }
        .collab-search:focus { border-color: rgba(32,147,121,0.55); box-shadow: 0 0 0 3px rgba(32,147,121,0.12); }
      `}</style>
      <div style={{ marginBottom: "14px" }}>
        <p style={eyebrow}>Sharing</p>
        <h3 style={{ ...title, fontSize: "22px", marginTop: "4px" }}>Collaborators</h3>
        <p style={subtitle}>
          Collaborators can edit this course, manage its curriculum, and view its management
          dashboards. Only the creator (or a Super Admin) can delete the course or change this list.
        </p>
      </div>

      {error && (
        <p role="alert" style={errorText}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={subtitle}>Loading collaborators…</p>
      ) : (
        <ul style={list}>
          {collaborators.length === 0 && <li style={emptyRow}>No collaborators yet.</li>}
          {collaborators.map((c) => (
            <li key={c.user_id} style={row}>
              <div>
                <span style={rowName}>{c.name}</span>
                <span style={rowMeta}>
                  {c.email ?? "no email"} · {c.role.replace(/_/g, " ")}
                </span>
              </div>
              {canShare && (
                <button
                  type="button"
                  onClick={() => void handleRemove(c.user_id)}
                  disabled={removeMutation.isPending}
                  style={removeBtn}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canShare && !loading && (
        <div ref={pickerRef} style={pickerWrap}>
          <input
            type="text"
            className="collab-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPickerOpen(false);
            }}
            placeholder="Add people: search by name, email, or role"
            aria-label="Search users to add as collaborator"
            style={searchInput}
          />
          {pickerOpen && (
            <div style={dropdown} role="listbox" aria-label="Eligible collaborators">
              {filteredEligible.length === 0 && (
                <p style={dropdownEmpty}>
                  {eligible.length === 0
                    ? "Everyone eligible is already a collaborator."
                    : `No matches for "${query.trim()}".`}
                </p>
              )}
              {filteredEligible.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="collab-pick-row"
                  onClick={() => void handleAdd(u.user_id)}
                  disabled={addMutation.isPending}
                  style={dropdownRow}
                >
                  <span style={avatar}>{initials(u.name)}</span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={rowName}>{u.name}</span>
                    <span style={rowMeta}>{u.email ?? "no email"}</span>
                  </span>
                  <span style={roleChip}>{u.role.replace(/_/g, " ")}</span>
                  <span className="collab-add-hint" style={addHint}>
                    {addMutation.isPending ? "Adding…" : "Add"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "24px",
  padding: "24px 28px",
  boxShadow: "0 12px 30px rgba(3,72,82,0.06)",
  marginTop: "18px",
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.24em",
  color: "#209379",
};

const title: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  color: "#034852",
};

const subtitle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "14px",
  lineHeight: 1.65,
  color: "rgba(3,72,82,0.6)",
};

const errorText: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#b4232a",
};

const list: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  maxWidth: "560px",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "rgba(244,250,248,0.9)",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "10px",
  padding: "10px 14px",
};

const emptyRow: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.55)",
  padding: "6px 2px",
};

const rowName: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: 700,
  color: "#034852",
};

const rowMeta: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "rgba(3,72,82,0.55)",
};

const removeBtn: React.CSSProperties = {
  border: "1px solid rgba(180,35,42,0.25)",
  background: "rgba(180,35,42,0.06)",
  color: "#b4232a",
  borderRadius: "10px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const pickerWrap: React.CSSProperties = {
  position: "relative",
  marginTop: "16px",
  maxWidth: "560px",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(3,72,82,0.15)",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  color: "#034852",
  background: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 150ms ease-out, box-shadow 150ms ease-out",
};

const dropdown: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 30,
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.12)",
  borderRadius: "10px",
  boxShadow: "0 8px 24px rgba(3,72,82,0.10)",
  maxHeight: "264px",
  overflowY: "auto",
  padding: "4px",
};

const dropdownEmpty: React.CSSProperties = {
  margin: 0,
  padding: "12px",
  fontSize: "13px",
  color: "rgba(3,72,82,0.55)",
};

const dropdownRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "8px",
  padding: "8px 10px",
  cursor: "pointer",
  textAlign: "left",
};

const avatar: React.CSSProperties = {
  flex: "0 0 auto",
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  fontWeight: 800,
  color: "#034852",
  background: "rgba(10,190,98,0.14)",
  border: "1px solid rgba(10,190,98,0.18)",
};

const roleChip: React.CSSProperties = {
  flex: "0 0 auto",
  fontSize: "10px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "var(--teal, #006d6c)",
  background: "rgba(0,109,108,0.08)",
  border: "1px solid rgba(0,109,108,0.12)",
  borderRadius: "999px",
  padding: "4px 10px",
};

const addHint: React.CSSProperties = {
  flex: "0 0 auto",
  fontSize: "12px",
  fontWeight: 700,
  color: "#209379",
};
