"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FilterX,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  getCoursesPage,
  getStudentCourses,
  type Course,
  type CourseListParams,
  type PaginatedCoursesResponse,
  type StudentCourse,
} from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

const GRID_PAGE_SIZE = 6;
const LIST_PAGE_SIZE = 10;

type ViewMode = "grid" | "list";
type ProgrammeFilter = "ALL" | "UG" | "PG";
type StatusFilter = "ALL" | "ACTIVE" | "DRAFT" | "ARCHIVED";
type AccessFilter = "ALL" | "FREE" | "PAID";
type LockingFilter = "ALL" | "OPEN" | "SEQUENTIAL";

export default function CoursesPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();

  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>([]);
  const [coursePage, setCoursePage] = useState<PaginatedCoursesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState<ProgrammeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("ALL");
  const [lockingFilter, setLockingFilter] = useState<LockingFilter>("ALL");

  const deferredSearch = useDeferredValue(searchInput);

  const roleCode = (data?.role?.code ?? "STUDENT") as RoleCode;
  const userId = data?.user?.id ?? null;
  const canCreate = has(PERM.courses.create);
  const canManage = has(PERM.courses.edit);
  // "Student view" (enrolled courses) vs "management view" (catalogue) is a
  // genuine identity distinction — a learner sees their own enrolments.
  const isStudent = roleCode === "STUDENT";
  const supportsFullStatusFilter = canManage;
  const pageSize = viewMode === "grid" ? GRID_PAGE_SIZE : LIST_PAGE_SIZE;

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleProgrammeChange = (value: ProgrammeFilter) => {
    setProgrammeFilter(value);
    setPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleAccessChange = (value: AccessFilter) => {
    setAccessFilter(value);
    setPage(1);
  };

  const handleLockingChange = (value: LockingFilter) => {
    setLockingFilter(value);
    setPage(1);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(1);
  };

  const fetchCourses = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      if (isStudent) {
        const enrolled = await getStudentCourses(userId);
        setStudentCourses(enrolled);
        setCoursePage(null);
        return;
      }

      const params: CourseListParams = {
        programmeType: programmeFilter === "ALL" ? undefined : programmeFilter,
        createdBy: roleCode === "PROGRAM_MANAGER" ? userId : undefined,
        allStatuses: roleCode === "SUPER_ADMIN",
        search: deferredSearch.trim() || undefined,
        accessType: accessFilter === "ALL" ? undefined : accessFilter,
        lockingMode: lockingFilter === "ALL" ? undefined : lockingFilter,
        page,
        pageSize,
      };

      if (supportsFullStatusFilter && statusFilter !== "ALL") {
        params.status = statusFilter;
      }

      const response = await getCoursesPage(params);
      setCoursePage(response);
      if (response.page !== page) {
        setPage(response.page);
      }
      setStudentCourses([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, [
    accessFilter,
    deferredSearch,
    isStudent,
    lockingFilter,
    page,
    pageSize,
    programmeFilter,
    roleCode,
    statusFilter,
    supportsFullStatusFilter,
    userId,
  ]);

  useEffect(() => {
    if (!userLoading) {
      void fetchCourses();
    }
  }, [fetchCourses, userLoading]);

  const subtitle = useMemo(() => {
    if (isStudent) return "Your enrolled courses";
    if (roleCode === "PROGRAM_MANAGER") return "Search and manage the courses you own";
    if (roleCode === "SUPER_ADMIN") return "Search and manage the full OpenGrad course catalogue";
    return "Browse the active course catalogue with cleaner search and filtering";
  }, [isStudent, roleCode]);

  const visibleStudentCourses = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return studentCourses;

    return studentCourses.filter((course) => {
      const titleMatch = course.title.toLowerCase().includes(term);
      const descriptionMatch = (course.description ?? "").toLowerCase().includes(term);
      return titleMatch || descriptionMatch;
    });
  }, [deferredSearch, studentCourses]);

  const activeFilterCount = useMemo(() => {
    return [
      programmeFilter !== "ALL",
      supportsFullStatusFilter && statusFilter !== "ALL",
      accessFilter !== "ALL",
      lockingFilter !== "ALL",
      deferredSearch.trim().length > 0,
    ].filter(Boolean).length;
  }, [
    accessFilter,
    deferredSearch,
    lockingFilter,
    programmeFilter,
    statusFilter,
    supportsFullStatusFilter,
  ]);

  const resetFilters = () => {
    setSearchInput("");
    setProgrammeFilter("ALL");
    setStatusFilter("ALL");
    setAccessFilter("ALL");
    setLockingFilter("ALL");
    setPage(1);
  };

  if (userLoading || (loading && !isStudent && !coursePage) || (loading && isStudent && studentCourses.length === 0)) {
    return (
      <PageShell>
        <LoadingState message="Loading your course workspace..." />
      </PageShell>
    );
  }

  const managementCourses = coursePage?.items ?? [];

  return (
    <PageShell>
      <section className="rounded-2xl border border-[rgba(3,72,82,0.08)] bg-white px-4 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.32em] text-[var(--light-teal)]">
                {isStudent ? "Learning" : "Course Management"}
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[var(--dark-teal)]">
                Courses
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[rgba(3,72,82,0.7)]">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isStudent && (
                <div className="flex items-center gap-1.5 rounded-full border border-[rgba(3,72,82,0.1)] bg-white/90 p-1 shadow-sm">
                  <ViewToggleButton
                    active={viewMode === "grid"}
                    icon={<LayoutGrid size={14} />}
                    label="Grid"
                    onClick={() => handleViewModeChange("grid")}
                  />
                  <ViewToggleButton
                    active={viewMode === "list"}
                    icon={<List size={14} />}
                    label="List"
                    onClick={() => handleViewModeChange("list")}
                  />
                </div>
              )}

              {canCreate && (
                <Link
                  href="/dashboard/courses/new"
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--green),var(--teal))] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,190,98,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(10,190,98,0.32)]"
                >
                  <Plus size={16} />
                  New Course
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="group flex flex-1 items-center gap-2 rounded-xl border border-[rgba(3,72,82,0.12)] bg-white/90 px-3 py-2 shadow-sm transition focus-within:border-[rgba(10,190,98,0.35)]">
              <Search size={15} className="text-[rgba(3,72,82,0.45)] transition group-focus-within:text-[var(--teal)]" />
              <input
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={isStudent ? "Search courses..." : "Search by title or description..."}
                className="w-full border-0 bg-transparent text-xs text-[var(--dark-teal)] outline-none placeholder:text-[rgba(3,72,82,0.42)]"
              />
            </label>

            {!isStudent && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(3,72,82,0.1)] bg-[rgba(248,250,251,0.9)] px-3 py-2 text-xs text-[rgba(3,72,82,0.72)]">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-[var(--teal)]" />
                  <span>{activeFilterCount} active filters</span>
                </div>
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--teal)]">
                    <RefreshCw size={11} className="animate-spin" />
                    Refreshing
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {!isStudent && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                label="Programme"
                value={programmeFilter}
                onChange={(value) => handleProgrammeChange(value as ProgrammeFilter)}
                options={[
                  { value: "ALL", label: "All programmes" },
                  { value: "UG", label: "UG" },
                  { value: "PG", label: "PG" },
                ]}
              />
              <FilterSelect
                label="Status"
                value={supportsFullStatusFilter ? statusFilter : "ACTIVE"}
                disabled={!supportsFullStatusFilter}
                onChange={(value) => handleStatusChange(value as StatusFilter)}
                options={
                  supportsFullStatusFilter
                    ? [
                        { value: "ALL", label: "All statuses" },
                        { value: "ACTIVE", label: "Active" },
                        { value: "DRAFT", label: "Draft" },
                        { value: "ARCHIVED", label: "Archived" },
                      ]
                    : [{ value: "ACTIVE", label: "Active only" }]
                }
              />
              <FilterSelect
                label="Access"
                value={accessFilter}
                onChange={(value) => handleAccessChange(value as AccessFilter)}
                options={[
                  { value: "ALL", label: "All access" },
                  { value: "FREE", label: "Free" },
                  { value: "PAID", label: "Paid" },
                ]}
              />
              <FilterSelect
                label="Locking"
                value={lockingFilter}
                onChange={(value) => handleLockingChange(value as LockingFilter)}
                options={[
                  { value: "ALL", label: "All structures" },
                  { value: "OPEN", label: "Open" },
                  { value: "SEQUENTIAL", label: "Sequential" },
                ]}
              />
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-[rgba(3,72,82,0.18)] bg-white px-2.5 py-1.5 text-xs font-medium text-[rgba(3,72,82,0.72)] transition hover:border-[rgba(3,72,82,0.3)] hover:text-[var(--dark-teal)]"
              >
                <FilterX size={12} />
                Reset
              </button>
            </div>
          )}

          {(!isStudent && coursePage && coursePage.total_pages > 1) && (
             <div className="mt-2 flex flex-col items-center justify-between gap-4 border-t border-[rgba(3,72,82,0.06)] pt-4 sm:flex-row">
                <span className="text-xs text-[rgba(3,72,82,0.68)]">
                  {rangeLabel(coursePage)}
                </span>
                <PaginationBar
                  currentPage={coursePage.page}
                  totalPages={coursePage.total_pages}
                  onPageChange={setPage}
                />
             </div>
          )}
        </div>
      </section>

      {error ? (
        <section className="mt-6">
          <StateCard eyebrow="Error" title={error} description="Try refreshing or adjusting the filters." />
        </section>
      ) : isStudent ? (
        <StudentCoursesSection courses={visibleStudentCourses} searchTerm={deferredSearch.trim()} />
      ) : managementCourses.length === 0 ? (
        <section className="mt-6">
          <StateCard
            eyebrow="No Courses"
            title={activeFilterCount > 0 ? "No courses match the current filters." : "No courses found."}
            description={
              activeFilterCount > 0
                ? "Try widening the filters or clearing the search."
                : canCreate
                ? 'Create your first course from "New Course" to start managing content here.'
                : "Check back soon for available courses."
            }
          />
        </section>
      ) : (
        <section className="mt-6 space-y-5">
          {viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {managementCourses.map((course) => (
                <ManagerCourseCard key={course.id} course={course} canManage={canManage} />
              ))}
            </div>
          ) : (
            <CourseTable courses={managementCourses} canManage={canManage} />
          )}
        </section>
      )}
    </PageShell>
  );
}

function StudentCoursesSection({
  courses,
  searchTerm,
}: {
  courses: StudentCourse[];
  searchTerm: string;
}) {
  if (courses.length === 0) {
    return (
      <section className="mt-6">
        <StateCard
          eyebrow="No Courses"
          title={searchTerm ? "No enrolled courses match your search." : "No courses assigned yet."}
          description={
            searchTerm
              ? "Try a different keyword."
              : "Your administrator will enrol you in courses when they are ready."
          }
        />
      </section>
    );
  }

  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {courses.map((course) => (
        <StudentCourseCard key={course.id} course={course} />
      ))}
    </section>
  );
}

function ManagerCourseCard({ course, canManage }: { course: Course; canManage: boolean }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(3,72,82,0.08)] bg-white shadow-[0_12px_28px_rgba(3,72,82,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(3,72,82,0.08)]">
      <div className="border-b border-[rgba(3,72,82,0.08)] bg-(--dark-teal) px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="dark">{course.programme_type}</Badge>
              <Badge tone={course.access_type === "PAID" ? "sun" : "mint"}>{course.access_type}</Badge>
            </div>
            <h2 className="mt-3 line-clamp-2 text-base font-semibold leading-snug">{course.title}</h2>
          </div>
          <Badge tone={statusTone(course.status)}>{course.status}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-[rgba(3,72,82,0.7)]">
          {course.description ?? "No description added yet."}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[rgba(248,250,251,0.95)] p-3">
          <Metric label="Lessons" value={`${course.lesson_count}`} />
          <Metric label="Structure" value={course.locking_mode} />
          <Metric label="Status" value={course.status} />
          <Metric label="Created" value={formatCompactDate(course.created_at)} />
        </dl>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <Link
            href={canManage ? `/dashboard/course-management/${course.id}` : `/dashboard/courses/${course.id}`}
            className={`inline-flex w-full items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition ${
              canManage
                ? "bg-[linear-gradient(135deg,var(--green),var(--teal))] text-white hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(10,190,98,0.22)]"
                : "border border-[rgba(3,72,82,0.16)] text-[var(--dark-teal)] hover:border-[rgba(3,72,82,0.3)] hover:bg-[rgba(3,72,82,0.03)]"
            }`}
          >
            {canManage ? "Manage" : "Open"}
          </Link>
        </div>
      </div>
    </article>
  );
}

function CourseTable({ courses, canManage }: { courses: Course[]; canManage: boolean }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-[rgba(3,72,82,0.08)] bg-white shadow-[0_18px_40px_rgba(3,72,82,0.06)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-[rgba(248,250,251,0.96)]">
            <tr className="text-xs uppercase tracking-[0.18em] text-[rgba(3,72,82,0.5)]">
              <TableHead>Course</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Structure</TableHead>
              <TableHead>Lessons</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-t border-[rgba(3,72,82,0.08)] align-top text-sm text-[var(--dark-teal)]">
                <td className="px-5 py-4">
                  <div className="max-w-[18rem]">
                    <p className="font-semibold">{course.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[rgba(3,72,82,0.58)]">
                      {course.description ?? "No description added yet."}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Badge tone="teal">{course.programme_type}</Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge tone={statusTone(course.status)}>{course.status}</Badge>
                </td>
                <td className="px-5 py-4 text-[rgba(3,72,82,0.72)]">{course.access_type}</td>
                <td className="px-5 py-4 text-[rgba(3,72,82,0.72)]">{course.locking_mode}</td>
                <td className="px-5 py-4 font-medium">{course.lesson_count}</td>
                <td className="px-5 py-4 text-[rgba(3,72,82,0.72)]">{formatCompactDate(course.created_at)}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={canManage ? `/dashboard/course-management/${course.id}` : `/dashboard/courses/${course.id}`}
                      className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition ${
                        canManage
                          ? "bg-[linear-gradient(135deg,var(--green),var(--teal))] text-white hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(10,190,98,0.18)]"
                          : "border border-[rgba(3,72,82,0.14)] text-[var(--dark-teal)] hover:border-[rgba(3,72,82,0.28)] hover:bg-[rgba(3,72,82,0.03)]"
                      }`}
                    >
                      {canManage ? "Manage" : "Open"}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  
  const getVisiblePages = () => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach(i => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const pages = getVisiblePages();

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(3,72,82,0.12)] text-[var(--dark-teal)] transition hover:border-[rgba(3,72,82,0.28)] hover:bg-[rgba(3,72,82,0.03)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ChevronLeft size={14} />
      </button>
      
      {pages.map((p, index) => {
        if (p === '...') {
          return (
            <span key={`dots-${index}`} className="px-1 text-xs text-[rgba(3,72,82,0.45)]">
              &hellip;
            </span>
          );
        }
        
        const pageNum = p as number;
        return (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition ${
              pageNum === currentPage
                ? 'bg-(--dark-teal) text-white shadow-sm'
                : 'text-[rgba(3,72,82,0.68)] hover:bg-[rgba(3,72,82,0.04)] hover:text-[var(--dark-teal)]'
            }`}
          >
            {pageNum}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(3,72,82,0.12)] text-[var(--dark-teal)] transition hover:border-[rgba(3,72,82,0.28)] hover:bg-[rgba(3,72,82,0.03)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function StudentCourseCard({ course }: { course: StudentCourse }) {
  const completion = Math.max(0, Math.min(100, course.completion_percent));

  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="group overflow-hidden rounded-2xl border border-[rgba(3,72,82,0.08)] bg-white shadow-[0_12px_28px_rgba(3,72,82,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(3,72,82,0.08)]"
    >
      <div className="bg-(--dark-teal) px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-2">
          <Badge tone="dark">{course.programme_type}</Badge>
          <Badge tone={completion === 100 ? "mint" : "dark"}>
            {completion === 100 ? "Complete" : `${completion}%`}
          </Badge>
        </div>
        <h2 className="relative mt-3 text-base font-semibold leading-snug">{course.title}</h2>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-xs text-[rgba(3,72,82,0.72)]">
          <span>
            {course.completed_lessons} / {course.total_lessons} lessons
          </span>
          <span className="font-semibold text-[var(--teal)]">{completion}% complete</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[rgba(3,72,82,0.08)]">
          <div
            className="h-full rounded-full bg-(--teal)"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-[rgba(3,72,82,0.1)] bg-white px-2.5 py-1.5 text-xs shadow-sm focus-within:border-[rgba(10,190,98,0.35)]">
      <span className="font-semibold text-[rgba(3,72,82,0.5)]">
        {label}:
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent font-medium text-[var(--dark-teal)] outline-none cursor-pointer disabled:cursor-not-allowed disabled:text-[rgba(3,72,82,0.45)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ViewToggleButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-(--dark-teal) text-white shadow-sm"
          : "text-[rgba(3,72,82,0.68)] hover:bg-[rgba(3,72,82,0.04)] hover:text-[var(--dark-teal)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-[1.75rem] border border-[rgba(3,72,82,0.08)] bg-white px-8 py-8 text-center shadow-[0_18px_36px_rgba(3,72,82,0.08)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(10,190,98,0.12)] text-[var(--teal)]">
          <RefreshCw size={20} className="animate-spin" />
        </div>
        <p className="mt-4 text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[var(--light-teal)]">
          Loading
        </p>
        <p className="mt-2 text-lg font-semibold text-[var(--dark-teal)]">{message}</p>
      </div>
    </div>
  );
}

function StateCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-[rgba(3,72,82,0.08)] bg-white px-8 py-10 text-center shadow-[0_18px_36px_rgba(3,72,82,0.08)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(0,109,108,0.08)] text-[var(--teal)]">
        <BookOpen size={22} />
      </div>
      <p className="mt-4 text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[var(--light-teal)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--dark-teal)]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[rgba(3,72,82,0.68)]">
        {description}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[rgba(3,72,82,0.46)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--dark-teal)]">{value}</dd>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-5 py-4 font-semibold">{children}</th>;
}

function Badge({
  tone,
  children,
}: {
  tone: "dark" | "mint" | "sun" | "teal" | "green" | "gray";
  children: ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    dark: "bg-[rgba(255,255,255,0.16)] text-white border border-[rgba(255,255,255,0.16)]",
    mint: "bg-[rgba(10,190,98,0.12)] text-[var(--green)] border border-[rgba(10,190,98,0.16)]",
    sun: "bg-[rgba(255,222,0,0.18)] text-[var(--dark-teal)] border border-[rgba(255,222,0,0.2)]",
    teal: "bg-[rgba(0,109,108,0.08)] text-[var(--teal)] border border-[rgba(0,109,108,0.12)]",
    green: "bg-[rgba(10,190,98,0.14)] text-[var(--teal)] border border-[rgba(10,190,98,0.18)]",
    gray: "bg-[rgba(3,72,82,0.08)] text-[rgba(3,72,82,0.76)] border border-[rgba(3,72,82,0.08)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function statusTone(status: string): "green" | "sun" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "sun";
  return "gray";
}

function formatCompactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function rangeLabel(page: PaginatedCoursesResponse | null) {
  if (!page || page.total === 0) return "Showing 0 courses";

  const start = (page.page - 1) * page.page_size + 1;
  const end = Math.min(page.total, start + page.page_size - 1);
  return `Showing ${start}-${end} of ${page.total} courses`;
}
