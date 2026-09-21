"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Layers, LayoutGrid, List, Plus, RefreshCw, Search, Users } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { type Bundle } from "@/lib/api";
import { useBundles } from "@/lib/queries/bundles";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { PaginationBar } from "../_components/PaginationBar";
import styles from "../_components/catalogue.module.css";
import bundleStyles from "./bundles.module.css";

type Sort = "newest" | "name" | "courses" | "students";

export default function BundlesPage() {
  const { isLoading } = useCurrentUser();
  const canCreate = usePermission(PERM.bundles.create);
  const { data: bundles = [], isPending: loading, error, refetch, isFetching } = useBundles();
  const currentUrl = useCurrentUrl();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const term = search.trim().toLocaleLowerCase();
  const filtered = bundles.filter(bundle => `${bundle.name} ${bundle.description ?? ""}`.toLocaleLowerCase().includes(term)).sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "courses") return b.course_count - a.course_count || a.name.localeCompare(b.name);
    if (sort === "students") return b.student_count - a.student_count || a.name.localeCompare(b.name);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.name.localeCompare(b.name);
  });
  const pageSize = view === "grid" ? 6 : 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const busy = isLoading || loading;
  const bundleHref = (id: string) => withFrom(`/dashboard/bundles/${id}`, currentUrl);

  return <div className={`${styles.catalogue} ${styles.content}`}>
    <div className={`${styles.toolbar} ${bundleStyles.toolbar}`}>
      <label className={styles.search}>
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label="Search bundles" placeholder="Search bundles…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
      </label>
      <div className={bundleStyles.toolbarActions}>
        <button type="button" className={styles.secondary} aria-label="Refresh bundles" title="Refresh bundles" disabled={isFetching} onClick={() => void refetch()}><RefreshCw size={18} aria-hidden="true" /></button>
        {canCreate && <Link href="/dashboard/bundles/new" className={styles.primary}><Plus size={18} aria-hidden="true" />New bundle</Link>}
      </div>
    </div>

    <div className={`${styles.resultsBar} ${bundleStyles.resultsBar}`}>
      <p role="status" className={styles.resultsLabel}>{busy ? "Loading bundles…" : error ? "Bundles unavailable" : filtered.length ? `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length} bundles` : "0 bundles"}</p>
      <div className={bundleStyles.viewTools}>
        <select aria-label="Sort bundles" className={`${styles.control} ${bundleStyles.sort}`} value={sort} onChange={event => { setSort(event.target.value as Sort); setPage(1); }}>
          <option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="courses">Most courses</option><option value="students">Most students</option>
        </select>
        <div role="group" aria-label="Bundle layout" className={styles.viewToggle}>
          <button type="button" aria-pressed={view === "grid"} className={styles.viewButton} onClick={() => { setView("grid"); setPage(1); }}><LayoutGrid size={16} aria-hidden="true" /><span>Grid</span></button>
          <button type="button" aria-pressed={view === "list"} className={styles.viewButton} onClick={() => { setView("list"); setPage(1); }}><List size={16} aria-hidden="true" /><span>List</span></button>
        </div>
      </div>
    </div>

    {busy ? <div role="status" aria-label="Loading bundles" className={styles.courseGrid}>{[0, 1, 2].map(index => <div key={index} className={styles.skeleton} aria-hidden="true"><div /><div /><div /></div>)}</div>
      : error ? <section role="alert" className={styles.empty}><Layers size={28} aria-hidden="true" /><h2>Bundles couldn’t be loaded</h2><p>{error instanceof Error ? error.message : "Please try again."}</p><button type="button" disabled={isFetching} onClick={() => void refetch()} className={styles.secondary}><RefreshCw size={16} aria-hidden="true" />{isFetching ? "Retrying…" : "Try again"}</button></section>
      : filtered.length === 0 ? <section className={styles.empty}><Layers size={28} aria-hidden="true" /><h2>{term ? "No matching bundles" : "No bundles yet"}</h2><p>{term ? "Try another name or clear your search." : canCreate ? "Group courses and quizzes into a bundle, then enrol students." : "Bundles will appear here when they’re available."}</p>{term ? <button type="button" onClick={() => { setSearch(""); setPage(1); }} className={styles.secondary}>Clear search</button> : canCreate && <Link href="/dashboard/bundles/new" className={styles.primary}><Plus size={16} aria-hidden="true" />New bundle</Link>}</section>
      : view === "grid" ? <div className={styles.courseGrid}>{visible.map(bundle => <BundleCard key={bundle.id} bundle={bundle} href={bundleHref(bundle.id)} />)}</div>
      : <div className={styles.tableWrap}><table className={styles.table}>
        <caption className="sr-only">Bundles</caption>
        <thead><tr><th scope="col">Bundle</th><th scope="col">Courses</th><th scope="col">Students</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Open bundle</span></th></tr></thead>
        <tbody>{visible.map(bundle => <tr key={bundle.id}>
          <td><Link className={styles.courseTitle} href={bundleHref(bundle.id)}>{bundle.name}</Link>{bundle.description && <p className={styles.tableDescription}>{bundle.description}</p>}</td>
          <td>{bundle.course_count}</td><td>{bundle.student_count}</td><td className={bundleStyles.date}>{formatDate(bundle.created_at)}</td>
          <td><Link href={bundleHref(bundle.id)} className={styles.secondary} aria-label={`Open ${bundle.name}`}>Open<ArrowRight size={16} aria-hidden="true" /></Link></td>
        </tr>)}</tbody>
      </table></div>}
    {!busy && !error && <PaginationBar ariaLabel="Bundle pages" currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />}
  </div>;
}

function BundleCard({ bundle, href }: { bundle: Bundle; href: string }) {
  return <Link href={href} className={styles.courseCard}>
    <div className={bundleStyles.cardMeta}><Layers size={18} aria-hidden="true" /><span>Created {formatDate(bundle.created_at)}</span></div>
    <h2>{bundle.name}</h2>
    <p className={styles.description}>{bundle.description || "No description added yet."}</p>
    <div className={bundleStyles.counts}>
      <span><BookOpen size={16} aria-hidden="true" />{bundle.course_count} {bundle.course_count === 1 ? "course" : "courses"}</span>
      <span><Users size={16} aria-hidden="true" />{bundle.student_count} {bundle.student_count === 1 ? "student" : "students"}</span>
    </div>
    <div className={styles.cardFooter}>Open bundle<ArrowRight size={16} className="ml-auto" aria-hidden="true" /></div>
  </Link>;
}

function formatDate(value: string) { return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
