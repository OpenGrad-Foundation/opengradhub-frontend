"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSchools,
  createBatch,
  updateBatch,
  type Batch,
  type SchoolOption,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { SchoolSearchPicker } from "@/components/SchoolSearchPicker";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { useBatches } from "@/lib/queries/batches";

export default function BatchesPage() {
  const { has } = usePermissions();
  const canCreate = has(PERM.batches.create);
  const canEdit = has(PERM.batches.edit);

  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ARCHIVED" | "all">("ACTIVE");
  const { data: batches = [], isLoading, error, refetch } = useBatches(statusFilter);

  const [showAdd, setShowAdd] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visibleBatches = batches.filter((b) => {
    if (q && ![b.name, b.school_name, b.programme_type]
      .some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7">
        <div>
          <p style={labelStyle}>Cohorts</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Batches</h1>
        </div>
        {canCreate && (
          <button onClick={() => setShowAdd(true)} style={primaryButton}>
            + Add Batch
          </button>
        )}
      </div>

      {showAdd && (
        <BatchFormModal
          mode="create"
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void refetch(); }}
        />
      )}

      {editBatch && (
        <BatchFormModal
          mode="edit"
          batch={editBatch}
          onClose={() => setEditBatch(null)}
          onSaved={() => { setEditBatch(null); void refetch(); }}
        />
      )}

      {isLoading ? (
        <p style={{ color: "rgba(3,72,82,0.6)" }}>Loading batches…</p>
      ) : error ? (
        <p style={{ color: "#c53030", fontWeight: 600 }}>
          {error instanceof Error ? error.message : "Failed to load batches."}
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "420px" }}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, school, or programme…"
                aria-label="Search batches"
                style={{ ...inputStyle, paddingLeft: "36px" }}
              />
              <span aria-hidden="true" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(3,72,82,0.45)", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ACTIVE" | "ARCHIVED" | "all")}
              aria-label="Filter by status"
              style={{ ...inputStyle, width: "auto", minWidth: "140px" }}
            >
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
              <option value="all">All</option>
            </select>
            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
              {q ? `${visibleBatches.length} of ${batches.length}` : `${batches.length} batch${batches.length === 1 ? "" : "es"}`}
            </span>
          </div>

          <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "rgba(3,72,82,0.05)", textAlign: "left" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>School</th>
                  <th style={thStyle}>Programme</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Dates</th>
                  <th style={thStyle}>Students</th>
                  <th style={thStyle}>Content</th>
                  {canEdit && <th style={thStyle} />}
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr><td colSpan={canEdit ? 8 : 7} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>No batches yet.</td></tr>
                ) : visibleBatches.length === 0 ? (
                  <tr><td colSpan={canEdit ? 8 : 7} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>No batches match &ldquo;{query}&rdquo;.</td></tr>
                ) : visibleBatches.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                    <td style={tdStyle}>
                      <Link href={`/dashboard/batches/${b.id}`} style={{ color: "#034852", fontWeight: 600, textDecoration: "none" }}>
                        {b.name}
                      </Link>
                    </td>
                    <td style={tdStyle}>{b.school_name ?? <em style={{ color: "rgba(3,72,82,0.5)" }}>Independent</em>}</td>
                    <td style={tdStyle}>{b.programme_type ?? "—"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "3px 9px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
                        background: b.status === "ACTIVE" ? "rgba(10,190,98,0.1)" : "rgba(3,72,82,0.08)",
                        color: b.status === "ACTIVE" ? "#0abe62" : "rgba(3,72,82,0.6)",
                      }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {b.starts_on || b.ends_on
                        ? `${b.starts_on ?? "…"} → ${b.ends_on ?? "…"}`
                        : "—"}
                    </td>
                    <td style={tdStyle}>{b.member_count}</td>
                    <td style={tdStyle}>
                      {b.course_count} courses · {b.bundle_count} bundles · {b.test_count} tests
                    </td>
                    {canEdit && (
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button onClick={() => setEditBatch(b)} style={linkBtnStyle}>Edit</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function BatchFormModal({
  mode, batch, onClose, onSaved,
}: {
  mode: "create" | "edit";
  batch?: Batch;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(batch?.name ?? "");
  const [schoolId, setSchoolId] = useState<string>(batch?.school_id ?? "");
  const [programme, setProgramme] = useState<string>(batch?.programme_type ?? "");
  const [status, setStatus] = useState<string>(batch?.status ?? "ACTIVE");
  const [startsOn, setStartsOn] = useState<string>(batch?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState<string>(batch?.ends_on ?? "");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    let cancelled = false;
    fetchSchools()
      .then((rows) => { if (!cancelled) setSchools(rows); })
      .catch(() => { if (!cancelled) setSchools([]); });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    if (startsOn && endsOn && startsOn > endsOn) {
      setErr("Start date must be before end date.");
      return;
    }
    setSaving(true);
    setErr(null);
    const payload = {
      name,
      school_id: schoolId || null,
      programme_type: programme || null,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
    };
    try {
      if (mode === "create") {
        await createBatch(payload);
      } else if (batch) {
        await updateBatch(batch.id, { ...payload, status });
      }
      invalidate('batches');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
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
        aria-label={mode === "create" ? "Add Batch" : "Edit Batch"}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
          background: "#ffffff", borderLeft: "1px solid rgba(3,72,82,0.1)",
          boxShadow: "-24px 0 64px rgba(3,72,82,0.12)", zIndex: 41,
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "batchPanelIn 240ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <style>{`@keyframes batchPanelIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={labelStyle}>{mode === "create" ? "Add Batch" : "Edit Batch"}</p>
            {mode === "edit" && batch && (
              <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 2px" }}>{batch.name}</h2>
            )}
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={formLabelStyle}>Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus placeholder="e.g. Grade 11 — 2026 or IPMAT 2026" />
            </div>
            <div>
              <label style={formLabelStyle}>Host School (leave empty for an independent batch)</label>
              <SchoolSearchPicker
                schools={schools}
                value={schoolId}
                onChange={setSchoolId}
                inputStyle={inputStyle}
              />
              {schoolId && (
                <button
                  type="button"
                  onClick={() => setSchoolId("")}
                  style={{ ...linkBtnStyle, marginTop: "4px", padding: 0 }}
                >
                  Clear school (make independent)
                </button>
              )}
            </div>
            <div>
              <label style={formLabelStyle}>Programme</label>
              <select value={programme} onChange={(e) => setProgramme(e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </div>
            {mode === "edit" && (
              <div>
                <label style={formLabelStyle}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
                <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)", margin: "4px 0 0" }}>
                  Archiving blocks membership and content changes. Students keep the access they already have.
                </p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={formLabelStyle}>Starts on</label>
                <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={formLabelStyle}>Ends on</label>
                <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {err && <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px", margin: 0 }}>{err}</p>}
          </div>
        </div>

        <div style={{ padding: "16px 28px 24px", borderTop: "1px solid rgba(3,72,82,0.08)", flexShrink: 0, display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={secondaryButton}>Cancel</button>
          <button onClick={() => void save()} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap" };
const secondaryButton: React.CSSProperties = { padding: "12px 24px", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "12px", background: "rgba(3,72,82,0.04)", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const thStyle: React.CSSProperties = { padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", color: "#034852" };
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#0abe62", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
