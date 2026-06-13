"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { type Batch } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useBatches } from "@/lib/queries/batches";
import { BatchFormModal } from "./BatchFormModal";

export default function BatchesPage() {
  const router = useRouter();
  const currentUrl = useCurrentUrl();
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
                  <tr
                    key={b.id}
                    onClick={() => router.push(withFrom(`/dashboard/batches/${b.id}`, currentUrl))}
                    style={{ borderTop: "1px solid rgba(3,72,82,0.06)", cursor: "pointer" }}
                  >
                    <td style={{ ...tdStyle, color: "#034852", fontWeight: 600 }}>
                      {b.name}
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
                        <button onClick={(e) => { e.stopPropagation(); setEditBatch(b); }} style={linkBtnStyle}>Edit</button>
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

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const thStyle: React.CSSProperties = { padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", color: "#034852" };
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#0abe62", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
