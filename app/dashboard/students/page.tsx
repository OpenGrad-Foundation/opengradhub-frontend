"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EntityLink } from "../programmes/_components/entity-link";
import { usePermissions } from "@/hooks/use-permission";
import { PERM, STUDENT_PROFILE_PERMISSIONS } from "@/lib/permissions";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudentFacets, useStudentsList } from "@/lib/queries/students";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { IN_CHARGE, ZONE } from "@/lib/labels";
import type { StudentFacets } from "@/lib/api";
import { GraduationCap } from "lucide-react";
import { PaginationBar } from "../_components/PaginationBar";
import styles from "../_components/catalogue.module.css";
import local from "./students.module.css";
import { Filters, type DirectoryFilterValue } from "./_components/filters";

const LIMIT = 50;
const EMPTY_FACETS: StudentFacets = {
  programmes: [],
  schools: [],
  batches: [],
  inCharges: [],
};

type SearchParamsReader = {
  get: (key: string) => string | null;
};

function readFilters(searchParams: SearchParamsReader): DirectoryFilterValue {
  const read = (key: string) => searchParams.get(key) || undefined;
  return {
    q: read("q"),
    programme_id: read("programme_id"),
    school_id: read("school_id"),
    state: read("state"),
    district: read("district"),
    batch_id: read("batch_id"),
    in_charge_id: read("in_charge_id"),
  };
}

function readPage(searchParams: SearchParamsReader): number {
  const page = Math.floor(Number(searchParams.get("page")));
  return Number.isFinite(page) && page > 1 ? page - 1 : 0;
}

export default function StudentsPage() {
  const { has } = usePermissions();
  const canViewStudents = has(PERM.students.view);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUrl = useCurrentUrl();
  const pathname = currentUrl.split("?")[0];
  const [filters, setFilters] = useState<DirectoryFilterValue>(() => readFilters(searchParams));
  const filtersRef = useRef(filters);
  const [debouncedQ, setDebouncedQ] = useState(filters.q ?? "");
  const [page, setPage] = useState(() => readPage(searchParams));
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writeUrl = useCallback((nextFilters: DirectoryFilterValue, nextPage: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) {
      if (value) next.set(key, value);
    }
    if (nextPage > 0) next.set("page", String(nextPage + 1));
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const offset = page * LIMIT;
  const { data, isPending, error } = useStudentsList({
    ...filters,
    q: debouncedQ || undefined,
    limit: LIMIT,
    offset,
  }, canViewStudents);
  const { data: facets = EMPTY_FACETS } = useStudentFacets(canViewStudents);

  const rows = canViewStudents ? data?.rows ?? [] : [];
  const total = data?.total ?? 0;
  const showEmail = has(PERM.students.view_contact) && rows.some(row => "email" in row);
  const firstShown = rows.length === 0 ? 0 : offset + 1;
  const lastShown = rows.length === 0 ? 0 : Math.min(offset + rows.length, total);

  const updateFilters = (next: DirectoryFilterValue) => {
    const searchChanged = next.q !== filters.q;
    filtersRef.current = next;
    setFilters(next);
    if (searchChanged) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        const nextFilters = filtersRef.current;
        setDebouncedQ(nextFilters.q ?? "");
        setPage(0);
        writeUrl(nextFilters, 0);
      }, 300);
      return;
    }
    setPage(0);
    // `next` already carries the live search text, and this branch only runs when
    // q did NOT change. Overriding it with `debouncedQ` wrote `q: undefined` for
    // the 300ms a keystroke is still in flight, so changing a select right after
    // typing dropped the search term out of the URL -- and out of the `from=`
    // link a row would have handed the profile page.
    writeUrl(next, 0);
  };

  const updatePage = (next: number) => {
    setPage(next);
    writeUrl(filters, next);
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.max(Math.ceil(total / LIMIT), page + 1);

  if (!canViewStudents) return <p>You do not have permission to view students.</p>;

  return (
    <div className={`${styles.catalogue} ${styles.content}`}>
      <Filters facets={facets} value={filters} onChange={updateFilters} />

      {isPending ? (
        <div role="status" aria-label="Loading students" className={local.skeletonTable}>
          {[0, 1, 2, 3, 4].map((index) => <div key={index} aria-hidden="true" />)}
        </div>
      ) : error ? (
        <section role="alert" className={styles.empty}>
          <GraduationCap size={28} aria-hidden="true" />
          <h2>Students couldn’t be loaded</h2>
          <p>{error instanceof Error ? error.message : "Failed to load students."}</p>
        </section>
      ) : (
        <>
          <div className={styles.resultsBar}>
            <p role="status" className={styles.resultsLabel}>
              Showing {firstShown}-{lastShown} of {total}
            </p>
            {hasFilters && (
              <button type="button" className={styles.clearFilters} onClick={() => updateFilters({})}>
                Clear filters
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <section className={styles.empty}>
              <GraduationCap size={28} aria-hidden="true" />
              <h2>{hasFilters ? "No matching students" : "No students in your scope"}</h2>
              <p>
                {hasFilters
                  ? "Try a different search or clear the filters."
                  : "Students appear here once they’re enrolled in a school or batch you can see."}
              </p>
            </section>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="sr-only">Students</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Roll No</th>
                    <th scope="col">School</th>
                    <th scope="col">{IN_CHARGE}</th>
                    <th scope="col">{ZONE}</th>
                    <th scope="col">Programme</th>
                    {showEmail && <th scope="col">Email</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user_id}>
                      <td className={local.name}>
                        <EntityLink
                          permissions={STUDENT_PROFILE_PERMISSIONS}
                          requiredPermissions={[PERM.students.view]}
                          href={`/dashboard/students/${row.user_id}`}
                          style={{ color: "var(--color-text)" }}
                        >
                          {row.name}
                        </EntityLink>
                      </td>
                      <td>{row.roll_number ?? "—"}</td>
                      <td>{row.school_name ?? "—"}</td>
                      <td>{row.in_charge_name ?? "—"}</td>
                      <td>{row.district ?? "—"}</td>
                      <td>{row.programme_name ?? "—"}</td>
                      {showEmail && <td>{row.email ?? "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PaginationBar
            ariaLabel="Student pages"
            currentPage={page + 1}
            totalPages={totalPages}
            onPageChange={(next) => updatePage(next - 1)}
          />
        </>
      )}
    </div>
  );
}
