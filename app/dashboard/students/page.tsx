"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudentFacets, useStudentsList } from "@/lib/queries/students";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { withFrom } from "@/lib/nav";
import { IN_CHARGE, ZONE } from "@/lib/labels";
import type { StudentFacets } from "@/lib/api";
import { secondaryButton, tdStyle, thStyle, titleStyle } from "@/app/dashboard/schools/styles";
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
  });
  const { data: facets = EMPTY_FACETS } = useStudentFacets();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const showEmail = rows.length > 0 && "email" in rows[0];
  const columnCount = showEmail ? 7 : 6;
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

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7">
        <div>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Students</h1>
        </div>
      </div>

      <Filters facets={facets} value={filters} onChange={updateFilters} />

      {isPending ? (
        <p style={{ color: "rgba(3,72,82,0.6)" }}>Loading students…</p>
      ) : error ? (
        <p style={{ color: "#c53030", fontWeight: 600 }}>
          {error instanceof Error ? error.message : "Failed to load students."}
        </p>
      ) : (
        <>
          <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "rgba(3,72,82,0.05)", textAlign: "left" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Roll No</th>
                  <th style={thStyle}>School</th>
                  <th style={thStyle}>{IN_CHARGE}</th>
                  <th style={thStyle}>{ZONE}</th>
                  <th style={thStyle}>Programme</th>
                  {showEmail && <th style={thStyle}>Email</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>
                      No students in your scope.
                    </td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={row.user_id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      <Link
                        href={withFrom(`/dashboard/students/${row.user_id}`, currentUrl)}
                        style={{ color: "#0abe62", textDecoration: "none" }}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td style={tdStyle}>{row.roll_number ?? "—"}</td>
                    <td style={tdStyle}>{row.school_name ?? "—"}</td>
                    <td style={tdStyle}>{row.in_charge_name ?? "—"}</td>
                    <td style={tdStyle}>{row.district ?? "—"}</td>
                    <td style={tdStyle}>{row.programme_name ?? "—"}</td>
                    {showEmail && <td style={tdStyle}>{row.email ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", marginTop: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
              Showing {firstShown}-{lastShown} of {total}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                style={secondaryButton}
                disabled={page === 0}
                onClick={() => updatePage(Math.max(page - 1, 0))}
              >
                Previous
              </button>
              <button
                type="button"
                style={secondaryButton}
                disabled={offset + LIMIT >= total}
                onClick={() => updatePage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
