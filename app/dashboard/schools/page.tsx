"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchSchools, type SchoolOption } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { SchoolBulkUploadPanel } from "./BulkUploadPanel";
import { StateDistrictPicker } from "@/app/dashboard/_components/StateDistrictPicker";
import { normState } from "@/lib/geo";
import { SchoolFormModal } from "./SchoolFormModal";
import { labelStyle, titleStyle, primaryButton, secondaryButton, inputStyle, thStyle, tdStyle, linkBtnStyle } from "./styles";

export default function SchoolsPage() {
  const { has } = usePermissions();
  const canCreate = has(PERM.schools.create);
  const canEdit = has(PERM.schools.edit);
  const canBulk = has(PERM.schools.bulk_import);

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolOption | null>(null);
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");

  const q = query.trim().toLowerCase();
  const visibleSchools = schools.filter((s) => {
    if (q && ![s.name, s.district, s.state, s.code, s.fellow_name]
      .some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    if (filterState && normState(s.state) !== filterState) return false;
    if (filterDistrict && (s.district ?? "") !== filterDistrict) return false;
    return true;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSchools(await fetchSchools());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schools.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7">
        <div>
          <p style={labelStyle}>Administration</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Schools</h1>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {canCreate && (
            <button onClick={() => { setShowAdd(true); setShowBulk(false); }} style={primaryButton}>
              + Add School
            </button>
          )}
          {canBulk && (
            <button onClick={() => { setShowBulk(true); setShowAdd(false); }} style={secondaryButton}>
              ↥ Bulk Upload
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <SchoolFormModal
          mode="create"
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void load(); }}
        />
      )}

      {editSchool && (
        <SchoolFormModal
          mode="edit"
          school={editSchool}
          onClose={() => setEditSchool(null)}
          onSaved={() => { setEditSchool(null); void load(); }}
        />
      )}

      {showBulk && (
        <SchoolBulkUploadPanel onClose={() => setShowBulk(false)} onDone={() => void load()} />
      )}

      {loading ? (
        <p style={{ color: "rgba(3,72,82,0.6)" }}>Loading schools…</p>
      ) : error ? (
        <p style={{ color: "#c53030", fontWeight: 600 }}>{error}</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "420px" }}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, district, state, code, or fellow…"
                aria-label="Search schools"
                style={{ ...inputStyle, paddingLeft: "36px" }}
              />
              <span aria-hidden="true" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(3,72,82,0.45)", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
            </div>
            <div style={{ flex: "1 1 320px", maxWidth: "420px" }}>
              <StateDistrictPicker
                state={filterState}
                district={filterDistrict}
                onStateChange={setFilterState}
                onDistrictChange={setFilterDistrict}
                blankStateLabel="All states"
                inputStyle={inputStyle}
              />
            </div>
            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
              {q || filterState || filterDistrict
                ? `${visibleSchools.length} of ${schools.length}`
                : `${schools.length} school${schools.length === 1 ? "" : "s"}`}
            </span>
          </div>

          <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "rgba(3,72,82,0.05)", textAlign: "left" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>District</th>
                  <th style={thStyle}>State</th>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Fellow</th>
                  {canEdit && <th style={thStyle} />}
                </tr>
              </thead>
              <tbody>
                {schools.length === 0 ? (
                  <tr><td colSpan={canEdit ? 6 : 5} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>No schools yet.</td></tr>
                ) : visibleSchools.length === 0 ? (
                  <tr><td colSpan={canEdit ? 6 : 5} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>No schools match &ldquo;{query}&rdquo;.</td></tr>
                ) : visibleSchools.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={tdStyle}>{s.district ?? "—"}</td>
                    <td style={tdStyle}>{s.state ?? "—"}</td>
                    <td style={tdStyle}>{s.code ?? "—"}</td>
                    <td style={tdStyle}>{s.fellow_name ?? "—"}</td>
                    {canEdit && (
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button onClick={() => setEditSchool(s)} style={linkBtnStyle}>Edit</button>
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
