"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Plus, Upload, MoreHorizontal, ArrowRight, ChevronDown, AlertTriangle } from "lucide-react";
import { Tabs } from "@/app/dashboard/_components/Tabs";
import { PaginationBar } from "@/app/dashboard/_components/PaginationBar";
import catalogue from "@/app/dashboard/_components/catalogue.module.css";
import workspace from "@/components/dashboard/workspace.module.css";
import styles from "./test-bank.module.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getQuestions, deleteQuestion, deleteQuestions, getQuizzes, deleteQuiz, cleanupOrphanedImages, type Question, type Quiz, getUniqueQuestionsForQuiz, getQuestionReportCounts, getQuestionById, archiveQuiz, unarchiveQuiz, getInFlightCount } from "@/lib/api";
import { usePermission } from "@/hooks/use-permission";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { PERM } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { useBulkSaveJob } from "@/hooks/use-bulk-save-job";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { QuizDeleteModal } from "./_components/QuizDeleteModal";
import { MoveQuizModal } from "@/app/dashboard/_components/MoveQuizModal";
import {
  QuestionSlideOver,
  QUESTION_TYPES,
  DIFFICULTIES,
  stripHtml,
} from "@/app/dashboard/_components/QuestionSlideOver";
import { MathSnippet } from "@/app/dashboard/_components/MathContent";
import { QuestionBulkUploadPanel } from "./QuestionBulkUploadPanel";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";

// Stable empty fallback — a fresh Map() per render would change identity every
// pass and retrigger anything keyed on it.
const EMPTY_REPORT_COUNTS = new Map<string, number>();

// ── Page ───────────────────────────────────────────────────────
// Access (`test_bank.view`) is enforced by the backend and the dashboard
// route guard.

export default function TestBankPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TestBankPageContent />
    </Suspense>
  );
}

function TestBankPageContent() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const userId = data?.user?.id ?? "";
  const invalidate = useInvalidate();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentUrl = useCurrentUrl();
  const canCreate = usePermission(PERM.test_bank.create);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType]       = useState("");
  const [filterProg, setFilterProg]       = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTopic, setFilterTopic]     = useState("");
  const [filterDiff, setFilterDiff]       = useState("");
  const [filterTag, setFilterTag]         = useState("");

  const [panelOpen, setPanelOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Question | null>(null);
  const [bulkOpen, setBulkOpen]       = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Created Global/Program tests — entry point to re-open them in the builder.
  const [globalTests, setGlobalTests] = useState<Omit<Quiz, "questions">[]>([]);
  const [quizLoading, setQuizLoading] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quizSearch, setQuizSearch] = useState("");
  const [page, setPage] = useState(1);
  const [quizPage, setQuizPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const questionRequest = useRef(0);
  const quizRequest = useRef(0);
  const activeTab = searchParams.get("reports") || searchParams.get("question") ? "questions" : searchParams.get("tab") === "quizzes" || searchParams.get("uploadJobId") ? "quizzes" : "questions";
  function selectTab(key: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", key); next.delete("reports"); next.delete("question");
    router.replace(`/dashboard/test-bank?${next.toString()}`, { scroll: false });
  }

  const [quizToDelete, setQuizToDelete] = useState<{ id: string; title: string } | null>(null);
  const [quizToMove, setQuizToMove]     = useState<{ id: string; title: string } | null>(null);
  const [uniqueQuestionsForDelete, setUniqueQuestionsForDelete] = useState<Awaited<ReturnType<typeof getUniqueQuestionsForQuiz>>>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState<string | null>(null);

  const handleDuplicateQuiz = (quiz: Omit<Quiz, "questions">) => {
    router.push(withFrom(`/dashboard/test-bank/duplicate?source=${quiz.id}`, currentUrl));
  };

  const handleArchiveQuiz = async (quiz: Omit<Quiz, "questions">) => {
    setArchiveBusy(quiz.id);
    try {
      // The in-flight count is the point of this dialog: archiving voids those attempts
      // and un-archiving will not bring them back, so say so before it happens.
      const inFlight = await getInFlightCount(quiz.id);
      const warning = inFlight > 0
        ? `\n\n${inFlight} student${inFlight === 1 ? " is" : "s are"} taking this quiz right now. `
          + `Archiving voids ${inFlight === 1 ? "that attempt" : "those attempts"} — `
          + `${inFlight === 1 ? "it" : "they"} will NOT be graded, and restoring the quiz will not bring `
          + `${inFlight === 1 ? "it" : "them"} back.`
        : "";
      if (!confirm(`Archive "${quiz.title}"?\n\nIt disappears for students and cannot be assigned.${warning}`)) {
        return;
      }
      await archiveQuiz(quiz.id);
      invalidate("quizzes");
      await fetchGlobalTests();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to archive quiz.");
    } finally {
      setArchiveBusy(null);
    }
  };

  const handleUnarchiveQuiz = async (quiz: Omit<Quiz, "questions">) => {
    setArchiveBusy(quiz.id);
    try {
      await unarchiveQuiz(quiz.id);
      invalidate("quizzes");
      await fetchGlobalTests();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to restore quiz.");
    } finally {
      setArchiveBusy(null);
    }
  };

  // Open student reports per bank question, for the ⚠ badges.
  // Held in react-query (not local state) so resolving a report from the slide-over
  // can invalidate it and the badges/filter update without a page refresh.
  const canManageQuestions = usePermission(PERM.test_bank.manage_questions);
  const canViewStudents = usePermission(PERM.students.view);
  const canTriage = canManageQuestions && canViewStudents;
  const { data: cachedReportCounts = EMPTY_REPORT_COUNTS } = useQuery({
    queryKey: qk.questionReportCounts(),
    enabled: canTriage,
    // No quiz_id: this page lists the whole bank, not one quiz.
    queryFn: async () => {
      const rows = await getQuestionReportCounts();
      return new Map(rows.map((r) => [r.bank_question_id, r.open_count]));
    },
  });

  // Deep-link from the dashboard "Reported Questions" card: show only questions
  // that currently have open reports. The reportCounts map is already loaded for
  // triagers, so this is a pure client-side narrowing — no extra fetch.
  const reportCounts = canTriage ? cachedReportCounts : EMPTY_REPORT_COUNTS;
  const reportsOnly = canTriage && searchParams.get("reports") === "open";
  const visibleQuestions = questions.filter(q => (!reportsOnly || (reportCounts.get(q.id) ?? 0) > 0) && stripHtml(q.content_html).toLowerCase().includes(search.toLowerCase().trim()));
  const filteredQuizzes = globalTests.filter(q => q.title.toLowerCase().includes(quizSearch.toLowerCase().trim()));
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(visibleQuestions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageQuestions = visibleQuestions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const quizPages = Math.max(1, Math.ceil(filteredQuizzes.length / pageSize));
  const currentQuizPage = Math.min(quizPage, quizPages);
  const pageQuizzes = filteredQuizzes.slice((currentQuizPage - 1) * pageSize, currentQuizPage * pageSize);
  const filterCount = [filterType, filterProg, filterSubject, filterTopic, filterDiff, filterTag].filter(Boolean).length;
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [filterType, filterProg, filterSubject, filterTopic, filterDiff, filterTag, search, reportsOnly]);
  // How many bank questions currently have open reports — drives the filter button badge.
  const reportedQuestionCount = [...reportCounts.values()].filter((n) => n > 0).length;

  // Deep link from a QUESTION_REPORTED notification: /dashboard/test-bank?question=<id>.
  // Fetch by id rather than searching the loaded page — the active filters may exclude it,
  // and the list is paginated in memory, so a lookup would silently no-op.
  const deepLinkQuestionId = searchParams.get("question");
  useEffect(() => {
    if (!deepLinkQuestionId) return;
    let cancelled = false;
    // Clear filters so the row is visible behind the panel once the user closes it.
    setFilterType(""); setFilterProg(""); setFilterSubject("");
    setFilterTopic(""); setFilterDiff(""); setFilterTag("");
    getQuestionById(deepLinkQuestionId)
      .then((q) => {
        if (cancelled) return;
        setEditTarget(q);
        setPanelOpen(true);
      })
      .catch(() => undefined); // deleted/inaccessible question: fall through to the plain list
    return () => { cancelled = true; };
  }, [deepLinkQuestionId]);

  const handleDeleteQuiz = async (quiz: Omit<Quiz, "questions">) => {
    try {
      const uniques = await getUniqueQuestionsForQuiz(quiz.id);
      if (uniques.length > 0) {
        setQuizToDelete({ id: quiz.id, title: quiz.title });
        setUniqueQuestionsForDelete(uniques);
      } else {
        if (!confirm(`Delete test: "${quiz.title}"?`)) return;
        await deleteQuiz(quiz.id);
        fetchGlobalTests();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to check unique questions.");
    }
  };

  const fetchQuestions = useCallback(async () => {
    const request = ++questionRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getQuestions({
        question_type:   filterType    || undefined,
        programme_type:  filterProg    || undefined,
        subject:         filterSubject || undefined,
        topic:           filterTopic   || undefined,
        difficulty:      filterDiff    || undefined,
        tag:             filterTag     || undefined,
      });
      if (request === questionRequest.current) setQuestions(result);
    } catch (err) {
      if (request === questionRequest.current) setError(err instanceof Error ? err.message : "Failed to load questions.");
    } finally {
      if (request === questionRequest.current) setLoading(false);
    }
  }, [filterType, filterProg, filterSubject, filterTopic, filterDiff, filterTag]);

  useEffect(() => {
    if (!userLoading) void fetchQuestions();
  }, [userLoading, fetchQuestions]);

  const fetchGlobalTests = useCallback(async () => {
    const request = ++quizRequest.current;
    setQuizLoading(true); setQuizError(null);
    try {
      const result = await getQuizzes({ quiz_type: "GLOBAL_TEST", archived: showArchived });
      if (request === quizRequest.current) setGlobalTests(result);
    } catch (error) {
      if (request === quizRequest.current) setQuizError(error instanceof Error ? error.message : "Couldn’t load quizzes.");
    } finally {
      if (request === quizRequest.current) setQuizLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    if (!userLoading) void fetchGlobalTests();
  }, [userLoading, fetchGlobalTests]);

  // A bulk-imported global quiz is saved by a background worker — poll it in
  // and refresh the list once it lands.
  const { jobId: uploadJobId, status: uploadStatus, expired: uploadExpired } = useBulkSaveJob({
    cleanupUrl: "/dashboard/test-bank?tab=quizzes",
    onCompleted: fetchGlobalTests,
  });

  if (userLoading) return <LoadingState />;

  function openAdd()  { setEditTarget(null); setPanelOpen(true); }
  function openEdit(q: Question) { setEditTarget(q); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditTarget(null); }

  async function handleDelete(id: string, content: string) {
    if (!confirm(`Delete question: "${stripHtml(content).slice(0, 60)}…"?`)) return;
    try {
      await deleteQuestion(id);
      invalidate('quizzes');
      void fetchQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected question(s)?`)) return;
    try {
      const res = await deleteQuestions(Array.from(selectedIds));
      if (res.skipped > 0) {
        alert(`Deleted ${res.deleted} question(s).\nSkipped ${res.skipped} question(s) because they are actively used in quizzes.`);
      }
      invalidate('quizzes');
      setSelectedIds(new Set());
      void fetchQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk delete failed.");
    }
  }

  function clearFilters() {
    setFilterType(""); setFilterProg(""); setFilterSubject(""); setFilterTopic(""); setFilterDiff(""); setFilterTag(""); setSearch("");
    if (reportsOnly) { const next = new URLSearchParams(searchParams.toString()); next.delete('reports'); router.replace(`/dashboard/test-bank?${next.toString()}`, {scroll:false}); }
  }
  const questionPanel = <div className={catalogue.content}>
    <div className={catalogue.toolbar}>
      <div className={catalogue.searchTools}>
        <label className={catalogue.search}><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search questions" placeholder="Search questions…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <button className={catalogue.secondary} aria-expanded={filtersOpen} aria-controls="question-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18} aria-hidden="true" />Filters{filterCount > 0 && <span className={catalogue.count}>{filterCount}</span>}</button>
      </div>
      {canManageQuestions && <div className={catalogue.actions}><button className={catalogue.secondary} aria-expanded={bulkOpen} onClick={() => setBulkOpen(!bulkOpen)}><Upload size={18} aria-hidden="true" />Upload CSV</button><button className={catalogue.primary} onClick={openAdd}><Plus size={18} aria-hidden="true" />Add question</button></div>}
    </div>
    {bulkOpen && canManageQuestions && <QuestionBulkUploadPanel createdBy={userId} onClose={() => setBulkOpen(false)} onDone={() => void fetchQuestions()} />}
    {filtersOpen && <div id="question-filters" className={`${catalogue.filters} ${styles.filters}`}>
      <label className={catalogue.field}>Question type<select className={catalogue.control} value={filterType} onChange={e => setFilterType(e.target.value)}><option value="">All types</option>{QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <label className={catalogue.field}>Programme<select className={catalogue.control} value={filterProg} onChange={e => setFilterProg(e.target.value)}><option value="">All programmes</option>{PROGRAMME_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
      <label className={catalogue.field}>Difficulty<select className={catalogue.control} value={filterDiff} onChange={e => setFilterDiff(e.target.value)}><option value="">All difficulties</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
      <label className={catalogue.field}>Subject<input className={catalogue.control} value={filterSubject} onChange={e => setFilterSubject(e.target.value)} placeholder="Any subject" /></label>
      <label className={catalogue.field}>Topic<input className={catalogue.control} value={filterTopic} onChange={e => setFilterTopic(e.target.value)} placeholder="Any topic" /></label>
      <label className={catalogue.field}>Tag<input className={catalogue.control} value={filterTag} onChange={e => setFilterTag(e.target.value)} placeholder="Any tag" /></label>
    </div>}
    <div className={styles.resultsBar}>
      <div className={catalogue.resultsLabel}><span aria-live="polite">{visibleQuestions.length} questions</span>{(filterCount > 0 || search || reportsOnly) && <button className={catalogue.clearFilters} onClick={clearFilters}>Clear filters</button>}</div>
      {canTriage && <Link className={`${catalogue.secondary} ${reportsOnly ? styles.reportActive : ''}`} href={reportsOnly ? '/dashboard/test-bank' : '/dashboard/test-bank?reports=open'} aria-current={reportsOnly ? 'true' : undefined}><AlertTriangle size={16} aria-hidden="true" />Reported{reportedQuestionCount > 0 && ` (${reportedQuestionCount})`}</Link>}
    </div>
    {loading ? <LoadingState /> : error ? <div className={catalogue.empty} role="alert"><h2>Couldn’t load questions</h2><p>{error}</p><button className={catalogue.secondary} onClick={() => void fetchQuestions()}>Try again</button></div> : visibleQuestions.length === 0 ? <div className={catalogue.empty}><h2>{filterCount || search || reportsOnly ? 'No matching questions' : 'No questions yet'}</h2><p>{reportsOnly ? 'No open reports match this view.' : filterCount || search ? 'Try a different search or clear your filters.' : canManageQuestions ? 'Add a question or upload a CSV to start your bank.' : 'Questions will appear here when they’re available.'}</p></div> : <div className={styles.questionList}>
      {canManageQuestions && <div className={styles.selectionBar}><label><input type="checkbox" checked={pageQuestions.every(q => selectedIds.has(q.id))} onChange={event => setSelectedIds(current => { const next = new Set(current); pageQuestions.forEach(q => event.target.checked ? next.add(q.id) : next.delete(q.id)); return next; })} />Select this page</label>{selectedIds.size > 0 && <button className={`${catalogue.secondary} ${styles.danger}`} onClick={handleBulkDelete}>Delete selected ({selectedIds.size})</button>}</div>}
      {pageQuestions.map(q => <QuestionRow key={q.id} question={q} canManage={canManageQuestions} selected={selectedIds.has(q.id)} openReports={reportCounts.get(q.id) ?? 0} onToggleSelect={() => setSelectedIds(current => { const next = new Set(current); if (next.has(q.id)) next.delete(q.id); else next.add(q.id); return next; })} onEdit={() => openEdit(q)} onDelete={() => void handleDelete(q.id, q.content_html)} />)}
    </div>}
    {!loading && !error && <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} ariaLabel="Question pages" />}
  </div>;

  const quizPanel = <div className={catalogue.content}>
    <div className={catalogue.toolbar}>
      <label className={catalogue.search}><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search programme quizzes" placeholder="Search quizzes…" value={quizSearch} onChange={e => { setQuizSearch(e.target.value); setQuizPage(1); }} /></label>
      {canCreate && <div className={catalogue.actions}><Link className={catalogue.secondary} href={withFrom('/dashboard/quiz-builder/bulk-import', currentUrl)}><Upload size={18} aria-hidden="true" />Import quiz</Link><Link className={catalogue.primary} href={withFrom('/dashboard/quiz-builder/new', currentUrl)}><Plus size={18} aria-hidden="true" />New quiz</Link></div>}
    </div>
    <div className={styles.resultsBar}><div className={catalogue.viewToggle} aria-label="Quiz status">{[false,true].map(archived => <button key={String(archived)} className={catalogue.viewButton} aria-pressed={showArchived === archived} onClick={() => { setShowArchived(archived); setQuizPage(1); }}>{archived ? 'Archived' : 'Active'}</button>)}</div>{canCreate && <Link className={styles.textLink} href={withFrom('/dashboard/test-bank/duplicate', currentUrl)}>Browse to duplicate<ArrowRight size={16} aria-hidden="true" /></Link>}</div>
    {uploadJobId && <p className={styles.notice} role="status">{uploadStatus || 'Saving your imported quiz…'}</p>}
    {uploadExpired && <p className={styles.notice}>Upload tracking has ended. Refresh the list to check whether your quiz saved.<button className={catalogue.clearFilters} onClick={() => void fetchGlobalTests()}>Refresh quizzes</button></p>}
    <p className={catalogue.resultsLabel} aria-live="polite">{filteredQuizzes.length} {showArchived ? 'archived ' : ''}quizzes</p>
    {quizLoading ? <LoadingState /> : quizError ? <div className={catalogue.empty} role="alert"><h2>Couldn’t load quizzes</h2><p>{quizError}</p><button className={catalogue.secondary} onClick={() => void fetchGlobalTests()}>Try again</button></div> : pageQuizzes.length === 0 ? <div className={catalogue.empty}><h2>{quizSearch ? 'No matching quizzes' : showArchived ? 'No archived quizzes' : 'No programme quizzes yet'}</h2><p>{quizSearch ? 'Try another quiz title.' : showArchived ? 'Archived quizzes can be restored here.' : 'Create or import a quiz to get started.'}</p></div> : <div className={styles.quizList}>{pageQuizzes.map(t => <GlobalTestRow key={t.id} quiz={t} busy={archiveBusy === t.id} onDelete={() => void handleDeleteQuiz(t)} onArchive={() => void handleArchiveQuiz(t)} onUnarchive={() => void handleUnarchiveQuiz(t)} onMove={() => setQuizToMove({id:t.id,title:t.title})} onDuplicate={() => handleDuplicateQuiz(t)} />)}</div>}
    {!quizLoading && !quizError && <PaginationBar currentPage={currentQuizPage} totalPages={quizPages} onPageChange={setQuizPage} ariaLabel="Programme quiz pages" />}
  </div>;

  return <div className={`${workspace.workspace} ${catalogue.catalogue} ${styles.page}`}>
    <div className={workspace.stickyTabs}><Tabs ariaLabel="Question bank sections" compactOnScroll activeKey={activeTab} onTabChange={selectTab} tabs={[{key:'questions',label:'Questions',panel:questionPanel},{key:'quizzes',label:'Programme quizzes',compactLabel:'Quizzes',panel:quizPanel}]} /></div>
      {quizToMove && (
        <MoveQuizModal
          quizId={quizToMove.id}
          quizTitle={quizToMove.title}
          onClose={() => setQuizToMove(null)}
          onMoved={() => {
            setQuizToMove(null);
            // It left the global list — refetch rather than patch state.
            fetchGlobalTests();
          }}
        />
      )}

      {quizToDelete && (
        <QuizDeleteModal
          quizTitle={quizToDelete.title}
          uniqueQuestions={uniqueQuestionsForDelete}
          onClose={() => setQuizToDelete(null)}
          onConfirm={async (selectedIds) => {
            try {
              await deleteQuiz(quizToDelete.id);
              if (selectedIds.length > 0) {
                await deleteQuestions(selectedIds);
                await cleanupOrphanedImages();
              }
              setQuizToDelete(null);
              fetchGlobalTests();
              fetchQuestions();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Deletion failed.");
            }
          }}
        />
      )}


    {panelOpen && <QuestionSlideOver initial={editTarget} createdBy={userId} onClose={closePanel} onSaved={() => { closePanel(); void fetchQuestions(); }} />}
  </div>;
}

function GlobalTestRow({ quiz, onDelete, onArchive, onUnarchive, busy, onMove, onDuplicate }: {
  quiz: Omit<Quiz, "questions">; onDelete: () => void; onArchive: () => void; onUnarchive: () => void; busy: boolean; onMove: () => void; onDuplicate: () => void;
}) {
  const canCreate = usePermission(PERM.test_bank.create);
  const canEdit = usePermission(PERM.test_bank.edit);
  const canPublish = usePermission(PERM.test_bank.publish);
  const canDelete = usePermission(PERM.test_bank.delete);
  const currentUrl = useCurrentUrl();
  const archived = quiz.archived_at != null;
  const scope = quiz.effective_scope_mode === 'GLOBAL' ? 'Shared with all programmes' : quiz.owner_programme_name || 'Unassigned';
  const fmt = (date:string) => new Date(date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  return <article className={styles.quizRow}>
    <div className={styles.identity}><div className={styles.metadata}><span className={`${styles.badge} ${quiz.published && !archived ? styles.published : ''}`}>{archived ? 'Archived' : quiz.published ? 'Published' : 'Draft'}</span><span>{scope}</span></div><h2>{quiz.title}</h2><p className={styles.metadata}>{quiz.duration_minutes != null && <span>{quiz.duration_minutes} min</span>}{quiz.due_at && <span>Due {fmt(quiz.due_at)}</span>}<span>Created {fmt(quiz.created_at)}</span></p></div>
    <div className={styles.rowActions}>
      {canEdit && <Link className={catalogue.secondary} href={withFrom(`/dashboard/quiz-builder/${quiz.id}`, currentUrl)}>Edit quiz<ArrowRight size={16} aria-hidden="true" /></Link>}
      {(canEdit || canCreate || canPublish || canDelete) && <details className={styles.menu}><summary aria-label={`More actions for ${quiz.title}`}><MoreHorizontal size={20} aria-hidden="true" /></summary><div className={styles.menuPanel} onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}>
        {!archived && canEdit && <button onClick={onMove}>Move to module</button>}
        {!archived && canCreate && <button onClick={onDuplicate}>Duplicate</button>}
        {canPublish && <button disabled={busy} onClick={archived ? onUnarchive : onArchive}>{busy ? 'Updating…' : archived ? 'Restore' : 'Archive'}</button>}
        {canDelete && <button className={styles.danger} onClick={onDelete}>Delete quiz</button>}
      </div></details>}
    </div>
  </article>;
}

function QuestionRow({ question, canManage, selected, onToggleSelect, onEdit, onDelete, openReports }: { question: Question; canManage: boolean; selected: boolean; onToggleSelect: () => void; onEdit: () => void; onDelete: () => void; openReports: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = question.question_type === 'GROUP' && question.children.length > 0;
  return <article className={styles.questionRow} data-selected={selected}>
    <div className={styles.questionMain}>
      {canManage && <label className={styles.check}><span className="sr-only">Select question: {stripHtml(question.content_html).slice(0,80)}</span><input type="checkbox" checked={selected} onChange={onToggleSelect} /></label>}
      <div className={styles.identity}>
        <div className={styles.metadata}><span className={styles.badge}>{QUESTION_TYPES.find(t => t.value === question.question_type)?.label ?? question.question_type}</span>{question.difficulty && <span>{question.difficulty}</span>}{openReports > 0 && <span className={styles.reportBadge}><AlertTriangle size={14} aria-hidden="true" />{openReports} open {openReports === 1 ? 'report' : 'reports'}</span>}</div>
        <MathSnippet html={question.content_html} lines={2} style={{fontSize:'14px',fontWeight:600,lineHeight:1.6}} />
        <div className={styles.metadata}>{[question.programme_type,question.subject,question.topic].filter(Boolean).map((text,i) => <span key={i}>{text}</span>)}{question.question_type === 'MCQ' && <span>{question.options.length} options</span>}{hasChildren && <button className={styles.textLink} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{question.children.length} sub-questions<ChevronDown size={16} aria-hidden="true" style={{transform:expanded?'rotate(180deg)':undefined}} /></button>}</div>
      </div>
      {canManage && <div className={styles.rowActions}><button className={catalogue.secondary} onClick={onEdit}>Edit</button><details className={styles.menu}><summary aria-label={`More actions for question: ${stripHtml(question.content_html).slice(0,80)}`}><MoreHorizontal size={20} aria-hidden="true" /></summary><div className={styles.menuPanel}><button className={styles.danger} onClick={onDelete}>Delete question</button></div></details></div>}
    </div>
    {expanded && hasChildren && <div className={styles.children}>{question.children.map((child,i) => <div key={child.id}><span>{i+1}.</span><MathSnippet html={child.content_html} lines={2} /></div>)}</div>}
  </article>;
}

function LoadingState() {
  return <div className={styles.quizList} aria-label="Loading question bank">{[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}</div>;
}
