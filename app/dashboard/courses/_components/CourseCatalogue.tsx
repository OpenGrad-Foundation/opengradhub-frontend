"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Copy,
  BookOpen,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM, hasEffectiveSelfScope } from "@/lib/permissions";
import {
  getCoursesPage,
  type Course,
  type CourseListParams,
  type PaginatedCoursesResponse,
  type StudentCourse,
} from "@/lib/api";
import { useStudentCourses } from "@/lib/queries/students";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { Tabs } from "@/app/dashboard/_components/Tabs";
import workspace from "@/components/dashboard/workspace.module.css";
import styles from "../../_components/catalogue.module.css";
import { PaginationBar } from "../../_components/PaginationBar";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";

const GRID_PAGE_SIZE = 6;
const LIST_PAGE_SIZE = 10;

type ViewMode = "grid" | "list";
type ProgrammeFilter = string; // "ALL" or any PROGRAMME_KINDS value
// Every status has its own tab, so there is no status filter at all — the tab
// is the status. ACTIVE / DRAFT / ARCHIVED map 1:1 onto the three tabs.
type CourseTab = "PUBLISHED" | "DRAFTS" | "ARCHIVED";
type AccessFilter = "ALL" | "FREE" | "PAID";
type LockingFilter = "ALL" | "OPEN" | "SEQUENTIAL";

export default function CourseCatalogue() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();

  const [coursePage, setCoursePage] = useState<PaginatedCoursesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState<ProgrammeFilter>("ALL");
  const [tab, setTab] = useState<CourseTab>("PUBLISHED");
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [archivedCount, setArchivedCount] = useState<number | null>(null);
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("ALL");
  const [lockingFilter, setLockingFilter] = useState<LockingFilter>("ALL");
  const [tagsFilter, setTagsFilter] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const requestId = useRef(0);

  const deferredSearch = useDeferredValue(searchInput);

  const userId = data?.user?.id ?? null;
  const canCreate = has(PERM.courses.create);
  const canManage = has(PERM.courses.edit);
  // The effective self scope selects personal enrolments and progress.
  const isStudent = hasEffectiveSelfScope(data?.permissions);
  const supportsFullStatusFilter = canManage;
  // Only managers can see DRAFT/ARCHIVED rows at all (the API forces ACTIVE
  // otherwise), so the extra tabs are hidden for everyone else.
  const showStatusTabs = !isStudent && supportsFullStatusFilter;
  const draftsTab = showStatusTabs && tab === "DRAFTS";
  const archivedTab = showStatusTabs && tab === "ARCHIVED";
  const effectiveStatus: string | undefined = !supportsFullStatusFilter
    ? undefined
    : draftsTab
    ? "DRAFT"
    : archivedTab
    ? "ARCHIVED"
    : "ACTIVE";
  const pageSize = viewMode === "grid" ? GRID_PAGE_SIZE : LIST_PAGE_SIZE;

  const {
    data: studentCourseData,
    isLoading: studentCoursesLoading,
    error: studentCoursesError,
  } = useStudentCourses(isStudent && userId ? userId : "");
  const studentCourses = useMemo(() => studentCourseData ?? [], [studentCourseData]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleProgrammeChange = (value: ProgrammeFilter) => {
    setProgrammeFilter(value);
    setPage(1);
  };

  const handleTabChange = (next: CourseTab) => {
    setTab(next);
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
    if (!userId || isStudent) return;

    const request = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const params: CourseListParams = {
        programmeType: programmeFilter === "ALL" ? undefined : programmeFilter,
        // PBAC: anyone who can manage courses (courses.edit) sees the full
        // catalogue across all statuses — not just courses they authored.
        allStatuses: canManage,
        search: deferredSearch.trim() || undefined,
        accessType: accessFilter === "ALL" ? undefined : accessFilter,
        lockingMode: lockingFilter === "ALL" ? undefined : lockingFilter,
        tags: tagsFilter.length > 0 ? tagsFilter : undefined,
        page,
        pageSize,
      };

      if (effectiveStatus) {
        params.status = effectiveStatus;
      }

      const response = await getCoursesPage(params);
      if (request !== requestId.current) return;
      setCoursePage(response);
      if (response.page !== page) {
        setPage(response.page);
      }
    } catch (err) {
      if (request !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Failed to load courses.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [
    accessFilter,
    canManage,
    deferredSearch,
    effectiveStatus,
    isStudent,
    lockingFilter,
    tagsFilter,
    page,
    pageSize,
    programmeFilter,
    userId,
  ]);

  useEffect(() => {
    if (!userLoading) {
      void fetchCourses();
    }
    return () => { requestId.current += 1; };
  }, [fetchCourses, userLoading]);

  // Unfiltered draft/archived totals for the tab badges. Deliberately cheap
  // (page_size 1 — only `total` is used) and refreshed on tab switch rather
  // than on every filter keystroke, so typing in search does not double the
  // request count.
  useEffect(() => {
    if (!showStatusTabs || !userId) {
      setDraftCount(null);
      setArchivedCount(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const load = async (status: "DRAFT" | "ARCHIVED") => {
        try {
          const response = await getCoursesPage({
            allStatuses: true,
            status,
            page: 1,
            pageSize: 1,
          });
          return response.total;
        } catch {
          return null;
        }
      };

      const [drafts, archived] = await Promise.all([load("DRAFT"), load("ARCHIVED")]);
      if (cancelled) return;
      setDraftCount(drafts);
      setArchivedCount(archived);
    })();

    return () => {
      cancelled = true;
    };
  }, [showStatusTabs, tab, userId]);

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
      accessFilter !== "ALL",
      lockingFilter !== "ALL",
      tagsFilter.length > 0,
      deferredSearch.trim().length > 0,
    ].filter(Boolean).length;
  }, [
    accessFilter,
    deferredSearch,
    lockingFilter,
    tagsFilter,
    programmeFilter,
  ]);

  const resetFilters = () => {
    setSearchInput("");
    setProgrammeFilter("ALL");
    setAccessFilter("ALL");
    setLockingFilter("ALL");
    setTagsFilter([]);
    setTagInput("");
    setPage(1);
  };

  const pageError = isStudent
    ? studentCoursesError instanceof Error
      ? studentCoursesError.message
      : null
    : error;

  if (userLoading) return <LoadingState message="Loading courses…" />;

  const managementCourses = coursePage?.items ?? [];
  const busy = isStudent ? studentCoursesLoading : loading;
  const content = (
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <div className={styles.searchTools}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input aria-label="Search courses" value={searchInput} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search courses…" type="search" />
          </label>
          {!isStudent && <button type="button" className={styles.secondary} aria-expanded={filtersOpen} aria-controls="course-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Filters{activeFilterCount > 0 && <span className={styles.count}>{activeFilterCount}</span>}
          </button>}
        </div>
        {canCreate && <div className={styles.actions}>
          <Link href="/dashboard/courses/duplicate" className={styles.secondary} aria-label="Duplicate course"><Copy size={16} aria-hidden="true" /><span>Duplicate<span className="hidden sm:inline"> course</span></span></Link>
          <Link href="/dashboard/courses/new" className={styles.primary}><Plus size={18} aria-hidden="true" />New course</Link>
        </div>}
      </div>

      {!isStudent && filtersOpen && <section id="course-filters" aria-label="Course filters" className={styles.filters}>
        <FilterSelect label="Programme" value={programmeFilter} onChange={handleProgrammeChange} options={[{ value: "ALL", label: "All programmes" }, ...PROGRAMME_KINDS]} />
        <FilterSelect label="Access" value={accessFilter} onChange={value => handleAccessChange(value as AccessFilter)} options={[{ value: "ALL", label: "All access" }, { value: "FREE", label: "Free" }, { value: "PAID", label: "Paid" }]} />
        <FilterSelect label="Lesson order" value={lockingFilter} onChange={value => handleLockingChange(value as LockingFilter)} options={[{ value: "ALL", label: "Any order" }, { value: "OPEN", label: "Open" }, { value: "SEQUENTIAL", label: "Sequential" }]} />
        <label className={styles.field}>
          <span>Tags</span>
          <input className={styles.control} placeholder="Type a tag and press Enter" value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              const tag = tagInput.trim().toUpperCase();
              if (tag && !tagsFilter.includes(tag)) { setTagsFilter([...tagsFilter, tag]); setPage(1); }
              setTagInput("");
            } else if (event.key === "Backspace" && !tagInput && tagsFilter.length > 0) {
              setTagsFilter(tagsFilter.slice(0, -1)); setPage(1);
            }
          }} />
        </label>
        {tagsFilter.length > 0 && <div className={styles.tags}>{tagsFilter.map(tag => <button key={tag} type="button" aria-label={`Remove tag ${tag}`} onClick={() => { setTagsFilter(tagsFilter.filter(value => value !== tag)); setPage(1); }}>{tag}<X size={14} aria-hidden="true" /></button>)}</div>}
      </section>}

      <div className={styles.resultsBar}>
        <div className={styles.resultsLabel}>
          <p role="status">{busy ? "Loading courses…" : isStudent ? `${visibleStudentCourses.length} courses` : rangeLabel(coursePage)}</p>
          {activeFilterCount > 0 && <button type="button" onClick={resetFilters} className={styles.clearFilters}>Clear filters</button>}
        </div>
        {!isStudent && <div className={styles.viewToggle} role="group" aria-label="Course layout">
          <ViewToggleButton active={viewMode === "grid"} icon={<LayoutGrid size={16} aria-hidden="true" />} label="Grid" onClick={() => handleViewModeChange("grid")} />
          <ViewToggleButton active={viewMode === "list"} icon={<List size={16} aria-hidden="true" />} label="List" onClick={() => handleViewModeChange("list")} />
        </div>}
      </div>

      {busy ? <LoadingState message="Loading courses…" /> : pageError ? <StateCard title="Courses couldn’t be loaded" description={pageError} action={!isStudent && <button type="button" className={styles.secondary} onClick={() => void fetchCourses()}><RefreshCw size={16} aria-hidden="true" />Try again</button>} />
        : isStudent ? <StudentCoursesSection courses={visibleStudentCourses} searchTerm={deferredSearch.trim()} />
        : managementCourses.length === 0 ? <StateCard
          title={activeFilterCount > 0 ? "No matching courses" : draftsTab ? "No draft courses" : archivedTab ? "No archived courses" : "No published courses yet"}
          description={activeFilterCount > 0 ? "Try another search or clear your filters." : draftsTab ? "Courses you’re preparing will appear here until they’re published." : archivedTab ? "Courses you retire stay here for reference." : canCreate ? "Create a course or duplicate an existing one to get started." : "Published courses will appear here when they’re available."}
          action={activeFilterCount > 0 ? <button type="button" className={styles.secondary} onClick={resetFilters}>Clear filters</button> : canCreate && !archivedTab ? <Link href="/dashboard/courses/new" className={styles.primary}><Plus size={16} aria-hidden="true" />New course</Link> : undefined}
        /> : viewMode === "grid" ? <div className={styles.courseGrid}>
          {managementCourses.map(course => <ManagerCourseCard key={course.id} course={course} canManage={canManage} callerId={has(PERM.scope.unrestricted) ? null : userId} />)}
        </div> : <CourseTable courses={managementCourses} canManage={canManage} callerId={has(PERM.scope.unrestricted) ? null : userId} />}
      {!isStudent && !busy && !pageError && coursePage && <PaginationBar currentPage={coursePage.page} totalPages={coursePage.total_pages} onPageChange={setPage} />}
    </div>
  );

  return <div className={`${workspace.workspace} ${styles.catalogue} ${showStatusTabs ? workspace.stickyTabs : ""}`}>
    {isStudent && <h1 className="mb-6 text-3xl font-bold text-[var(--dark-teal)]">Courses</h1>}
    {showStatusTabs ? <Tabs ariaLabel="Course status" compactOnScroll activeKey={tab} onTabChange={key => handleTabChange(key as CourseTab)} tabs={[
      { key: "PUBLISHED", label: "Published", panel: content },
      { key: "DRAFTS", label: "Drafts", count: draftCount, panel: content },
      { key: "ARCHIVED", label: "Archived", count: archivedCount, panel: content },
    ]} /> : content}
  </div>;
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

function ManagerCourseCard({
  course,
  canManage,
  callerId,
}: {
  course: Course;
  canManage: boolean;
  callerId: string | null;
}) {
  const currentUrl = useCurrentUrl();
  // Per-course authority. Both flags are present only in the management list
  // view; an absent flag keeps legacy behaviour.
  //
  // Programme editors (can_edit_content without can_manage) also go to
  // /dashboard/course-management: the page detects the management-payload 403
  // and degrades to the content-only workspace (Curriculum + Settings). The
  // label says "Edit content" so the narrower workspace is not a surprise.
  const manageable = canManage && course.can_manage !== false;
  const editableContent = canManage && course.can_edit_content !== false;
  const isShared = Boolean(course.can_manage) && callerId !== null && course.created_by !== callerId;
  return (
    <Link href={withFrom(manageable || editableContent ? `/dashboard/course-management/${course.id}` : `/dashboard/courses/${course.id}`, currentUrl)} className={styles.courseCard}>
      <div className={styles.cardMeta}><span>{course.programme_type}</span><Badge tone="gray">{course.access_type === "PAID" ? "Paid" : "Free"}</Badge></div>
      <h2>{course.title}</h2>
      <p className={styles.description}>{course.description || "No description added yet."}</p>
      {course.tags?.length > 0 && <div className={styles.cardTags}>{course.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}{course.tags.length > 2 && <span title={course.tags.slice(2).join(", ")}>+{course.tags.length - 2}</span>}</div>}
      <div className={styles.courseDetails}><span>{course.lesson_count} lessons</span><span>{course.quiz_count ?? 0} quizzes</span><span>{course.locking_mode === "SEQUENTIAL" ? "In order" : "Open order"}</span></div>
      <div className={styles.cardFooter}><span>{manageable ? "Manage course" : editableContent ? "Edit content" : "Open course"}</span><span className={styles.cardAuthority}>{isShared ? "Shared" : canManage && !manageable && !editableContent ? "View only" : ""}</span><ArrowRight size={18} aria-hidden="true" /></div>
    </Link>
  );
}

function CourseTable({
  courses,
  canManage,
  callerId,
}: {
  courses: Course[];
  canManage: boolean;
  callerId: string | null;
}) {
  const currentUrl = useCurrentUrl();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Courses</caption>
        <thead><tr><th scope="col">Course</th><th scope="col">Programme</th><th scope="col">Content</th><th scope="col">Access</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{courses.map(course => {
          const manageable = canManage && course.can_manage !== false;
          const editableContent = canManage && course.can_edit_content !== false;
          return <tr key={course.id}>
            <td><Link href={withFrom(manageable || editableContent ? `/dashboard/course-management/${course.id}` : `/dashboard/courses/${course.id}`, currentUrl)} className={styles.courseTitle}>{course.title}</Link><p className={styles.tableDescription}>{course.description}</p>{Boolean(course.can_manage) && callerId !== null && course.created_by !== callerId && <span className={styles.cardAuthority}>Shared</span>}</td>
            <td>{course.programme_type}</td>
            <td><span className="whitespace-nowrap">{course.lesson_count} lessons</span><span className={styles.tableDescription}>{course.quiz_count ?? 0} quizzes · {course.locking_mode === "SEQUENTIAL" ? "In order" : "Open order"}</span></td>
            <td>{course.access_type === "PAID" ? "Paid" : "Free"}</td>
            <td><Link aria-label={`${manageable ? "Manage" : editableContent ? "Edit content" : "Open"}: ${course.title}`} href={withFrom(manageable || editableContent ? `/dashboard/course-management/${course.id}` : `/dashboard/courses/${course.id}`, currentUrl)} className={styles.secondary}>{manageable ? "Manage" : editableContent ? "Edit content" : "Open"}<ArrowRight size={16} aria-hidden="true" /></Link></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function StudentCourseCard({ course }: { course: StudentCourse }) {
  const currentUrl = useCurrentUrl();
  const completion = Math.max(0, Math.min(100, course.completion_percent));

  return (
    <Link
      href={withFrom(`/dashboard/courses/${course.id}`, currentUrl)}
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

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className={styles.field}><span>{label}</span><select className={styles.control} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
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
  return <button type="button" aria-pressed={active} onClick={onClick} className={styles.viewButton}>{icon}<span>{label}</span></button>;
}

function LoadingState({ message }: { message: string }) {
  return <div role="status" aria-label={message} className={styles.courseGrid}>{[0, 1, 2].map(index => <div key={index} aria-hidden="true" className={styles.skeleton}><div /><div /><div /></div>)}</div>;
}

function StateCard({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className={styles.empty}><BookOpen size={24} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{action && <div>{action}</div>}</div>;
}

function Badge({
  tone,
  children,
}: {
  tone: "dark" | "mint" | "sun" | "teal" | "green" | "gray" | "red";
  children: ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    dark: "bg-[rgba(255,255,255,0.16)] text-white border border-[rgba(255,255,255,0.16)]",
    mint: "bg-[rgba(10,190,98,0.12)] text-[var(--green)] border border-[rgba(10,190,98,0.16)]",
    sun: "bg-[rgba(255,222,0,0.18)] text-amber-500 border border-[rgba(255,222,0,0.2)]",
    teal: "bg-[rgba(0,109,108,0.08)] text-[var(--teal)] border border-[rgba(0,109,108,0.12)]",
    green: "bg-[rgba(10,190,98,0.14)] text-[var(--green)] border border-[rgba(10,190,98,0.18)]",
    gray: "bg-[rgba(3,72,82,0.08)] text-[rgba(3,72,82,0.76)] border border-[rgba(3,72,82,0.08)]",
    red: "bg-[rgba(239,68,68,0.15)] text-red-500 border border-[rgba(239,68,68,0.2)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function rangeLabel(page: PaginatedCoursesResponse | null) {
  if (!page || page.total === 0) return "Showing 0 courses";

  const start = (page.page - 1) * page.page_size + 1;
  const end = Math.min(page.total, start + page.page_size - 1);
  return `Showing ${start}-${end} of ${page.total} courses`;
}
