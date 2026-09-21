"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useBatches } from "@/lib/queries/batches";
import { BatchFormModal } from "./BatchFormModal";
import { Plus, Search } from "lucide-react";
import styles from "../_components/catalogue.module.css";

export default function BatchesPage() {
  const router = useRouter();
  const currentUrl = useCurrentUrl();
  const { has } = usePermissions();
  const canCreate = has(PERM.batches.create);
  const canEdit = has(PERM.batches.edit);

  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ARCHIVED" | "all">("ACTIVE");
  const { data: batches = [], isLoading, error, refetch } = useBatches(statusFilter);

  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visibleBatches = batches.filter((b) => {
    if (q && ![b.name, b.school_name, b.programme_type]
      .some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    return true;
  });

  return (
    <div className={`${styles.catalogue} ${styles.content}`}>
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
            onChange={(e) => setStatusFilter(e.target.value as "ACTIVE" | "ARCHIVED" | "all")}
            aria-label="Filter by status"
            className={styles.control}
            style={{ width: "auto", minWidth: "140px" }}
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="all">All</option>
          </select>
          <span className={styles.resultsLabel}>
            {q ? `${visibleBatches.length} of ${batches.length}` : `${batches.length} batch${batches.length === 1 ? "" : "es"}`}
          </span>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setShowAdd(true)} className={styles.primary}>
            <Plus size={18} aria-hidden="true" />Add Batch
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

      {isLoading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Loading batches…</p>
      ) : error ? (
        <p style={{ color: "#b83232", fontWeight: 600, fontSize: "14px" }}>
          {error instanceof Error ? error.message : "Failed to load batches."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
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
                {batches.length === 0 ? (
                  <tr><td colSpan={canEdit ? 8 : 7} style={{ color: "var(--color-text-muted)" }}>No batches yet.</td></tr>
                ) : visibleBatches.length === 0 ? (
                  <tr><td colSpan={canEdit ? 8 : 7} style={{ color: "var(--color-text-muted)" }}>No batches match &ldquo;{query}&rdquo;.</td></tr>
                ) : visibleBatches.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(withFrom(`/dashboard/batches/${b.id}`, currentUrl))}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td>{b.school_name ?? <em style={{ color: "var(--color-text-muted)" }}>Independent</em>}</td>
                    <td>{b.programme_type ?? "—"}</td>
                    <td>
                      <span style={{
                        padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap",
                        background: b.status === "ACTIVE" ? "var(--color-success-surface)" : "#eef5f3",
                        color: b.status === "ACTIVE" ? "#08784a" : "var(--color-text-muted)",
                      }}>
                        {b.status === "ACTIVE" ? "Active" : b.status === "ARCHIVED" ? "Archived" : b.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {b.starts_on || b.ends_on
                        ? `${b.starts_on ?? "…"} → ${b.ends_on ?? "…"}`
                        : "—"}
                    </td>
                    <td>{b.member_count}</td>
                    <td>
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
