"use client";

import { useEffect, useState } from "react";
import {
  getStudentsForBulk,
  updateUser,
  type StudentForBulk,
} from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import {
  labelStyle, titleStyle, secondaryButton, closeBtnStyle, inputStyle, linkBtnStyle,
} from "../styles";

/**
 * Slide-over to assign existing students to a school. Search hits
 * GET /users/students?search=; students already at this school are filtered
 * out client-side. Assigning = PATCH /users/:id { school_id } (the backend
 * guard is user_management.edit — the opener button is already gated on it).
 */
export function AddStudentsPanel({
  schoolId, schoolName, currentStudentIds, onClose, onChanged,
}: {
  schoolId: string;
  schoolName: string;
  currentStudentIds: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentForBulk[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();

  // Debounced search-as-you-type.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    setErr(null);
    const t = setTimeout(() => {
      getStudentsForBulk({ search: q })
        .then((rows) => { if (!cancelled) setResults(rows); })
        .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Search failed."); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const excluded = new Set([...currentStudentIds, ...addedIds]);
  const candidates = results.filter((r) => !excluded.has(r.id));

  async function add(student: StudentForBulk) {
    setAddingId(student.id);
    setErr(null);
    try {
      await updateUser(student.id, { school_id: schoolId });
      invalidate("schools", "users");
      setAddedIds((prev) => new Set(prev).add(student.id));
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add student.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.18)", backdropFilter: "blur(3px)", zIndex: 40 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add students to school"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
          background: "#ffffff", borderLeft: "1px solid rgba(3,72,82,0.1)",
          boxShadow: "-24px 0 64px rgba(3,72,82,0.12)", zIndex: 41,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={labelStyle}>Add Students</p>
            <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 2px" }}>{schoolName}</h2>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students by name or roll number…"
            aria-label="Search students"
            style={inputStyle}
          />
          {err && <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px", margin: "10px 0 0" }}>{err}</p>}

          <div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
            {query.trim().length < 2 ? (
              <p style={hintStyle}>Type at least 2 characters to search.</p>
            ) : searching ? (
              <p style={hintStyle}>Searching…</p>
            ) : candidates.length === 0 ? (
              <p style={hintStyle}>No matching students (already-assigned students are hidden).</p>
            ) : candidates.map((st) => (
              <div
                key={st.id}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.08)" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "#034852" }}>
                    {st.name}{st.roll_number ? ` · ${st.roll_number}` : ""}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: st.school_name ? "#b7791f" : "rgba(3,72,82,0.55)" }}>
                    {st.school_name
                      ? `Currently at ${st.school_name} — will be moved`
                      : "No school assigned"}
                    {st.programme_type ? ` · ${st.programme_type}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => void add(st)}
                  disabled={addingId === st.id}
                  style={{ ...linkBtnStyle, opacity: addingId === st.id ? 0.5 : 1 }}
                >
                  {addingId === st.id ? "Adding…" : "Add"}
                </button>
              </div>
            ))}
            {addedIds.size > 0 && (
              <p style={{ ...hintStyle, color: "#209379", fontWeight: 600 }}>
                {addedIds.size} student{addedIds.size === 1 ? "" : "s"} added.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px 24px", borderTop: "1px solid rgba(3,72,82,0.08)", flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={secondaryButton}>Done</button>
        </div>
      </div>
    </>
  );
}

const hintStyle: React.CSSProperties = { margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.55)" };
