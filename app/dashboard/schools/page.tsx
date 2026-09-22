"use client";

import { HeaderActions } from "@/components/dashboard/HeaderActions";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Upload } from "lucide-react";
import { fetchSchools, type SchoolOption } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { SchoolBulkUploadPanel } from "./BulkUploadPanel";
import { StateDistrictPicker } from "@/app/dashboard/_components/StateDistrictPicker";
import { IN_CHARGE, IN_CHARGE_LOWER, ROLE_LABELS, ZONE, ZONE_LOWER } from "@/lib/labels";
import { normState } from "@/lib/geo";
import { SchoolFormModal } from "./SchoolFormModal";
import { primaryButton, secondaryButton, inputStyle, thStyle, tdStyle, linkBtnStyle } from "./styles";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

export default function SchoolsPage() {
  const router = useRouter();
  const currentUrl = useCurrentUrl();
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
    if (q && ![s.name, s.district, s.state, s.code, s.fellow_name, s.zm_name]
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
      {(canCreate || canBulk) && (
      <HeaderActions>
          {canCreate && (
            <button onClick={() => { setShowAdd(true); setShowBulk(false); }} style={primaryButton}>
              <Plus size={18} aria-hidden="true" />Add School
            </button>
          )}
          {canBulk && (
            <button onClick={() => { setShowBulk(true); setShowAdd(false); }} style={secondaryButton}>
              <Upload size={18} aria-hidden="true" />Bulk Upload
            </button>
          )}
      </HeaderActions>
      )}

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
        <p style={{ color: "var(--color-text-muted)" }}>Loading schools…</p>
      ) : error ? (
        <p style={{ color: "#b83232", fontWeight: 600 }}>{error}</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "420px" }}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search name, ${ZONE_LOWER}, state, code, or ${IN_CHARGE_LOWER}…`}
                aria-label="Search schools"
                style={{ ...inputStyle, paddingLeft: "36px" }}
              />
              <Search size={16} aria-hidden="true" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
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
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              {q || filterState || filterDistrict
                ? `${visibleSchools.length} of ${schools.length}`
                : `${schools.length} school${schools.length === 1 ? "" : "s"}`}
            </span>
          </div>

          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>{ZONE}</th>
                  <th style={thStyle}>State</th>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>{IN_CHARGE}</th>
                  <th style={thStyle}>{ROLE_LABELS.ZONAL_MANAGER}</th>
                  {canEdit && <th style={thStyle} />}
                </tr>
              </thead>
              <tbody>
                {schools.length === 0 ? (
                  <tr><td colSpan={canEdit ? 7 : 6} style={{ padding: "20px", color: "var(--color-text-muted)" }}>No schools yet.</td></tr>
                ) : visibleSchools.length === 0 ? (
                  <tr><td colSpan={canEdit ? 7 : 6} style={{ padding: "20px", color: "var(--color-text-muted)" }}>No schools match &ldquo;{query}&rdquo;.</td></tr>
                ) : visibleSchools.map((s) => (
                  <tr key={s.id} onClick={() => router.push(withFrom(`/dashboard/schools/${s.id}`, currentUrl))} style={{ borderTop: "1px solid var(--color-border)", cursor: "pointer" }}>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={tdStyle}>{s.district ?? "—"}</td>
                    <td style={tdStyle}>{s.state ?? "—"}</td>
                    <td style={tdStyle}>{s.code ?? "—"}</td>
                    <td style={tdStyle}>{s.fellow_name ?? "—"}</td>
                    <td style={tdStyle}>{s.zm_name ?? "—"}</td>
                    {canEdit && (
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button onClick={(e) => { e.stopPropagation(); setEditSchool(s); }} style={linkBtnStyle}>Edit</button>
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
