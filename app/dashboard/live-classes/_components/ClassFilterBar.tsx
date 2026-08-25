"use client";

import { useEffect, useState } from "react";
import { getCourses, type Course } from "@/lib/api";
import { useBatches } from "@/lib/queries/batches";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";
import type { ClassFilterState } from "./useClassFilters";

/**
 * Compact staff filters: Upcoming/Past, a title search, one audience picker
 * covering all three targeting modes, and the archived toggle. Everything here
 * writes straight to the URL — see useClassFilters.
 */
export function ClassFilterBar({ state, set }: {
  state: ClassFilterState;
  set: (patch: Partial<ClassFilterState>) => void;
}) {
  // The input is local so typing stays responsive; the URL is only rewritten
  // once the user pauses, which also stops every keystroke firing a query.
  const [search, setSearch] = useState(state.q);
  useEffect(() => { setSearch(state.q); }, [state.q]);
  useEffect(() => {
    if (search === state.q) return;
    const t = setTimeout(() => set({ q: search }), 300);
    return () => clearTimeout(t);
  }, [search, state.q, set]);

  return (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "20px" }}>
      <div style={{ display: "flex", gap: "6px" }} role="group" aria-label="Time filter">
        {(["upcoming", "past"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set({ view: v })}
            aria-pressed={state.view === v}
            style={{ ...S.segment, ...(state.view === v ? S.segmentOn : {}) }}
          >
            {v === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search class titles…"
        aria-label="Search class titles"
        style={{ ...S.control, minWidth: "200px" }}
      />

      <AudiencePicker value={state.audience} onChange={(audience) => set({ audience })} />

      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#034852" }}>
        <input
          type="checkbox"
          checked={state.archived}
          onChange={(e) => set({ archived: e.target.checked })}
        />
        Include archived
      </label>
    </div>
  );
}

/** One control for all three targeting modes, grouped so they stay legible. */
function AudiencePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    let cancelled = false;
    getCourses(undefined, undefined, undefined, true)
      .then((cs) => { if (!cancelled) setCourses(cs); })
      .catch(() => { /* the picker stays short; list errors surface separately */ });
    return () => { cancelled = true; };
  }, []);
  const batches = useBatches();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Audience"
      style={{ ...S.control, minWidth: "200px" }}
    >
      <option value="">All audiences</option>
      <optgroup label="Courses">
        {courses.map((c) => <option key={c.id} value={`course:${c.id}`}>{c.title}</option>)}
      </optgroup>
      <optgroup label="Batches">
        {(batches.data ?? []).map((b) => <option key={b.id} value={`batch:${b.id}`}>{b.name}</option>)}
      </optgroup>
      <optgroup label="Programmes">
        {PROGRAMME_KINDS.map((k) => <option key={k.value} value={`programme:${k.value}`}>{k.label}</option>)}
      </optgroup>
    </select>
  );
}

const S = {
  control: { padding: "8px 12px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.15)", fontSize: "13px", color: "#034852", background: "#fff", fontFamily: "var(--font-body)" } as React.CSSProperties,
  segment: { padding: "8px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-heading)", border: "1.5px solid rgba(3,72,82,0.15)", background: "transparent", color: "#034852" } as React.CSSProperties,
  segmentOn: { border: "none", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff" } as React.CSSProperties,
};
