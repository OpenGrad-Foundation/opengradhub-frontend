"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useBatches } from "@/lib/queries/batches";
import { HeaderActions } from "@/components/dashboard/HeaderActions";
import { BatchFormModal } from "./BatchFormModal";
import { Plus, RefreshCw, Search, UsersRound } from "lucide-react";
import styles from "../_components/catalogue.module.css";
import local from "./batches.module.css";

type StatusFilter = "ACTIVE" | "ARCHIVED" | "all";

export default function BatchesPage() {
  const router = useRouter();
  const currentUrl = useCurrentUrl();
  const { has } = usePermissions();
  const canCreate = has(PERM.batches.create);
  const canEdit = has(PERM.batches.edit);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const { data: batches = [], isLoading, error, refetch, isFetching } = useBatches(statusFilter);

  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visibleBatches = batches.filter((b) => {
    if (q && ![b.name, b.school_name, b.programme_type]
      .some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    return true;
  });
  const batchHref = (id: string) => withFrom(`/dashboard/batches/${id}`, currentUrl);
  const statusWord = statusFilter === "ACTIVE" ? "active " : statusFilter === "ARCHIVED" ? "archived " : "";

  return (
    <div className={`${styles.catalogue} ${styles.content}`}>
      {canCreate && (
        <HeaderActions>
          <button type="button" onClick={() => setShowAdd(true)} className={styles.primary}>
            <Plus size={18} aria-hidden="true" />Add batch
          </button>
        </HeaderActions>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchTools} style={{ flexWrap: "wrap" }}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, school, or programme…"
              aria-label="Search batches"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className={styles.control}
            style={{ width: "auto", minWidth: "140px" }}
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className={styles.resultsBar}>
        <p role="status" className={styles.resultsLabel}>
          {isLoading ? "Loading batches…" : error ? "Batches unavailable"
            : q ? `${visibleBatches.length} of ${batches.length}`
            : `${batches.length} ${statusWord}batch${batches.length === 1 ? "" : "es"}`}
        </p>
      </div>

      {showAdd && (
        <BatchFormModal
          mode="create"
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void refetch(); }}
        />
      )}

      {isLoading ? (
        <div aria-hidden="true" className={styles.courseGrid}>
          {[0, 1, 2].map((i) => <div key={i} className={styles.skeleton}><div /><div /><div /></div>)}
        </div>
      ) : error ? (
        <section role="alert" className={styles.empty}>
          <UsersRound size={28} aria-hidden="true" />
          <h2>Batches couldn’t be loaded</h2>
          <p className={local.error}>{error instanceof Error ? error.message : "Failed to load batches."}</p>
          <button type="button" disabled={isFetching} onClick={() => void refetch()} className={styles.secondary}>
            <RefreshCw size={16} aria-hidden="true" />{isFetching ? "Retrying…" : "Try again"}
          </button>
        </section>
      ) : batches.length === 0 ? (
        <section className={styles.empty}>
          <UsersRound size={28} aria-hidden="true" />
          <h2>No batches yet.</h2>
          <p>{canCreate ? "Group students into a batch, then assign courses, bundles and quizzes to them together." : "Batches will appear here once they’re created."}</p>
          {canCreate && (
            <button type="button" onClick={() => setShowAdd(true)} className={styles.primary}>
              <Plus size={16} aria-hidden="true" />Add batch
            </button>
          )}
        </section>
      ) : visibleBatches.length === 0 ? (
        <section className={styles.empty}>
          <Search size={28} aria-hidden="true" />
          <h2>No batches match &ldquo;{query}&rdquo;.</h2>
          <p>Try another name, school or programme.</p>
          <button type="button" onClick={() => setQuery("")} className={styles.secondary}>Clear search</button>
        </section>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">Batches</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">School</th>
                <th scope="col">Programme</th>
                <th scope="col">Status</th>
                <th scope="col">Dates</th>
                <th scope="col">Students</th>
                <th scope="col">Content</th>
                {canEdit && <th scope="col"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {visibleBatches.map((b) => (
                <tr key={b.id} onClick={() => router.push(batchHref(b.id))} className={local.clickable}>
                  <td>
                    <Link href={batchHref(b.id)} onClick={(e) => e.stopPropagation()} className={local.rowLink}>{b.name}</Link>
                  </td>
                  <td>{b.school_name ?? <em className={local.muted}>Independent</em>}</td>
                  <td>{b.programme_type ?? "—"}</td>
                  <td>
                    <span className={local.status} data-active={b.status === "ACTIVE"}>
                      {b.status === "ACTIVE" ? "Active" : b.status === "ARCHIVED" ? "Archived" : b.status}
                    </span>
                  </td>
                  <td className={local.nowrap}>
                    {b.starts_on || b.ends_on ? `${b.starts_on ?? "…"} → ${b.ends_on ?? "…"}` : "—"}
                  </td>
                  <td>{b.member_count}</td>
                  <td className={local.muted}>
                    {b.course_count} courses · {b.bundle_count} bundles · {b.test_count} tests
                  </td>
                  {canEdit && (
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(withFrom(`/dashboard/batches/${b.id}?tab=settings`, currentUrl));
                        }}
                        className={styles.secondary}
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
