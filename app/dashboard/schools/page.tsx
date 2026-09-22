"use client";

import { HeaderActions } from "@/components/dashboard/HeaderActions";
import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, RefreshCw, School as SchoolIcon, Search, Upload } from "lucide-react";
import { fetchSchools, type SchoolOption } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { SchoolBulkUploadPanel } from "./BulkUploadPanel";
import { StateDistrictPicker } from "@/app/dashboard/_components/StateDistrictPicker";
import { IN_CHARGE, IN_CHARGE_LOWER, ROLE_LABELS, ZONE, ZONE_LOWER } from "@/lib/labels";
import { normState } from "@/lib/geo";
import { SchoolFormModal } from "./SchoolFormModal";
import { primaryButton, secondaryButton } from "./styles";
import { PaginationBar } from "../_components/PaginationBar";
import styles from "../_components/catalogue.module.css";
import css from "./schools.module.css";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

const PAGE_SIZE = 25;
/** Matches catalogue `.control` so the geo selects sit flush with the search box. */
const inputStyle: CSSProperties = { width: "100%", minHeight: "44px", padding: "8px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "12px", color: "var(--color-text)", fontFamily: "var(--font-body)", fontSize: "14px", boxSizing: "border-box" };

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
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const visibleSchools = schools.filter((s) => {
    if (q && ![s.name, s.district, s.state, s.code, s.fellow_name, s.zm_name]
      .some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    if (filterState && normState(s.state) !== filterState) return false;
    if (filterDistrict && (s.district ?? "") !== filterDistrict) return false;
    return true;
  });
  const filtering = Boolean(q || filterState || filterDistrict);
  const totalPages = Math.max(1, Math.ceil(visibleSchools.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visibleSchools.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function clearFilters() { setQuery(""); setFilterState(""); setFilterDistrict(""); setPage(1); }

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
    <div className={`${styles.catalogue} ${styles.content}`}>
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

      <div className={styles.toolbar}>
        <div className={css.filterTools}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={`Search name, ${ZONE_LOWER}, state, code, or ${IN_CHARGE_LOWER}…`}
              aria-label="Search schools"
            />
          </label>
          <div className={css.geo}>
            <StateDistrictPicker
              state={filterState}
              district={filterDistrict}
              onStateChange={(v) => { setFilterState(v); setPage(1); }}
              onDistrictChange={(v) => { setFilterDistrict(v); setPage(1); }}
              blankStateLabel="All states"
              inputStyle={inputStyle}
            />
          </div>
        </div>
      </div>

      <div className={styles.resultsBar}>
        <p role="status" className={styles.resultsLabel}>
          {loading ? "Loading schools…" : error ? "Schools unavailable"
            : filtering ? `${visibleSchools.length} of ${schools.length}`
            : `${schools.length} school${schools.length === 1 ? "" : "s"}`}
        </p>
        {filtering && !loading && (
          <button type="button" className={styles.clearFilters} onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {loading ? (
        <div className={css.skeletonRows} aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <div key={i} />)}</div>
      ) : error ? (
        <section role="alert" className={styles.empty}>
          <SchoolIcon size={28} aria-hidden="true" />
          <h2>Schools couldn&rsquo;t be loaded</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className={styles.secondary}><RefreshCw size={16} aria-hidden="true" />Try again</button>
        </section>
      ) : visibleSchools.length === 0 ? (
        <section className={styles.empty}>
          <SchoolIcon size={28} aria-hidden="true" />
          <h2>{schools.length === 0 ? "No schools yet." : "No matching schools"}</h2>
          <p>
            {schools.length === 0
              ? canCreate ? "Add a school, or bulk upload a CSV, to get started." : "Schools will appear here once they’re added."
              : <>No schools match {query ? <>&ldquo;{query}&rdquo;</> : "these filters"}.</>}
          </p>
          {schools.length > 0 && <button type="button" onClick={clearFilters} className={styles.secondary}>Clear filters</button>}
        </section>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">Schools</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">{ZONE}</th>
                  <th scope="col">State</th>
                  <th scope="col">Code</th>
                  <th scope="col">{IN_CHARGE}</th>
                  <th scope="col">{ROLE_LABELS.ZONAL_MANAGER}</th>
                  {canEdit && <th scope="col"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => {
                  const href = withFrom(`/dashboard/schools/${s.id}`, currentUrl);
                  return (
                    <tr key={s.id} className={css.clickRow} onClick={() => router.push(href)}>
                      <td><Link href={href} className={css.nameCell} onClick={(e) => e.stopPropagation()}>{s.name}</Link></td>
                      <td>{s.district ?? <span className={css.muted}>—</span>}</td>
                      <td>{s.state ?? <span className={css.muted}>—</span>}</td>
                      <td>{s.code ?? <span className={css.muted}>—</span>}</td>
                      <td>{s.fellow_name ?? <span className={css.muted}>—</span>}</td>
                      <td>{s.zm_name ?? <span className={css.muted}>—</span>}</td>
                      {canEdit && (
                        <td className={css.actionCell}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditSchool(s); }}
                            className={styles.secondary}
                            aria-label={`Edit ${s.name}`}
                          >
                            <Pencil size={16} aria-hidden="true" />Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar ariaLabel="School pages" currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
