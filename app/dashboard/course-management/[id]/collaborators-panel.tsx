"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const addMutation = useAddCollaborator();
  const removeMutation = useRemoveCollaborator();

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

  const handleAdd = async () => {
    if (!selected) return;
    try {
      setError(null);
      await addMutation.mutateAsync({ courseId, userId: selected });
      setSelected("");
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
        <div style={addRow}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={select}
            aria-label="Select a user to add as collaborator"
          >
            <option value="">Select a user…</option>
            {eligible.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.name} — {u.role.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!selected || addMutation.isPending}
            style={addBtn}
          >
            {addMutation.isPending ? "Adding…" : "Add collaborator"}
          </button>
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
  gap: "10px",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "rgba(244,250,248,0.9)",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "14px",
  padding: "12px 16px",
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

const addRow: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginTop: "16px",
  flexWrap: "wrap",
};

const select: React.CSSProperties = {
  flex: "1 1 240px",
  border: "1px solid rgba(3,72,82,0.15)",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "14px",
  color: "#034852",
  background: "#ffffff",
};

const addBtn: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, #0abe62, #209379)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 18px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};
