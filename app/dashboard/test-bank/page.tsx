"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
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
  typeBadge,
  Tag,
} from "@/app/dashboard/_components/QuestionSlideOver";
import { MathSnippet } from "@/app/dashboard/_components/MathContent";
import { QuestionBulkUploadPanel } from "./QuestionBulkUploadPanel";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";

// Stable empty fallback — a fresh Map() per render would change identity every
// pass and retrigger anything keyed on it.
const EMPTY_REPORT_COUNTS = new Map<string, number>();
const EMPTY_SELECTION = new Set<string>();
const PAGE_SIZE = 50;
const QUIZ_PAGE_SIZE = 20;

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
  const [filterSearch, setFilterSearch]   = useState("");
  const [filtersOpen, setFiltersOpen]     = useState(false);
  // The page resets to 0 whenever any filter changes: it is stored with the
  // filter set it belongs to, so a stale page number is simply ignored.
  // The ?reports=open view counts as a filter too.
  const filterKey = [filterType, filterProg, filterSubject, filterTopic, filterDiff, filterTag, filterSearch, searchParams.get("reports") ?? ""].join("|");
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const setPage = (n: number) => setPageState({ key: filterKey, page: n });
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);

  const [panelOpen, setPanelOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Question | null>(null);
  const [bulkOpen, setBulkOpen]       = useState(false);
  // Same trick for the selection: it belongs to one filter set and page, so ticked
  // questions that scroll out of view are dropped instead of being bulk-deleted unseen.
  const selectionKey = `${filterKey}|${page}`;
  const [selection, setSelection] = useState({ key: selectionKey, ids: new Set<string>() });
  const selectedIds = selection.key === selectionKey ? selection.ids : EMPTY_SELECTION;
  const setSelectedIds = (ids: Set<string>) => setSelection({ key: selectionKey, ids });

  // Created Global/Program tests — entry point to re-open them in the builder.
  const [globalTests, setGlobalTests] = useState<Omit<Quiz, "questions">[]>([]);
  // Program quizzes is the default tab. Links that are about a question (the Reported
  // dashboard card, a QUESTION_REPORTED notification) open the Questions tab instead.
  const [tab, setTab] = useState<"questions" | "quizzes">(
    searchParams.get("tab") === "questions" || searchParams.get("reports") || searchParams.get("question") ? "questions" : "quizzes",
  );
  const [quizSearch, setQuizSearch] = useState("");
  // Same trick as the question pager: a page number only counts for the search/archive view it was set in.
  const [quizPageState, setQuizPageState] = useState({ key: "", page: 0 });

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
  // that currently have open reports. The list is paged server-side, so the
  // reported ids (already scoped to what this caller may see) go to the server.
  const reportCounts = canTriage ? cachedReportCounts : EMPTY_REPORT_COUNTS;
  const reportsOnly = canTriage && searchParams.get("reports") === "open";
  const reportedIds = [...reportCounts].filter(([, n]) => n > 0).map(([id]) => id);
  const reportedIdsKey = reportsOnly ? reportedIds.join(",") : null;
  // How many bank questions currently have open reports — drives the filter button badge.
  const reportedQuestionCount = reportedIds.length;

  // Deep link from a QUESTION_REPORTED notification: /dashboard/test-bank?question=<id>.
  // Fetch by id rather than searching the loaded page — the active filters may exclude it,
  // and the list is paged server-side, so a lookup would silently no-op.
  const deepLinkQuestionId = searchParams.get("question");
  useEffect(() => {
    if (!deepLinkQuestionId) return;
    let cancelled = false;
    // Clear filters so the row is visible behind the panel once the user closes it.
    setFilterType(""); setFilterProg(""); setFilterSubject("");
    setFilterTopic(""); setFilterDiff(""); setFilterTag(""); setFilterSearch("");
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
    // Only the latest request may write state; a slow earlier one is dropped.
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      // One extra row tells us whether a next page exists without a count query.
      const rows = await getQuestions({
        question_type:   filterType    || undefined,
        programme_type:  filterProg    || undefined,
        subject:         filterSubject || undefined,
        topic:           filterTopic   || undefined,
        difficulty:      filterDiff    || undefined,
        tag:             filterTag     || undefined,
        search:          filterSearch.trim() || undefined,
        ids:             reportedIdsKey === null ? undefined : reportedIdsKey ? reportedIdsKey.split(",") : [],
        limit:           PAGE_SIZE + 1,
        offset:          page * PAGE_SIZE,
      });
      if (id !== requestId.current) return;
      setQuestions(rows.slice(0, PAGE_SIZE));
      setHasMore(rows.length > PAGE_SIZE);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Failed to load questions.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filterType, filterProg, filterSubject, filterTopic, filterDiff, filterTag, filterSearch, reportedIdsKey, page]);

  useEffect(() => {
    if (userLoading) return;
    // Debounced so typing in the Subject/Topic/Tag boxes doesn't fire per keystroke.
    const t = setTimeout(() => void fetchQuestions(), 300);
    return () => clearTimeout(t);
  }, [userLoading, fetchQuestions]);

  const fetchGlobalTests = useCallback(async () => {
    try {
      setGlobalTests(await getQuizzes({ quiz_type: "GLOBAL_TEST", archived: showArchived }));
    } catch {
      setGlobalTests([]);
    }
  }, [showArchived]);

  useEffect(() => {
    if (!userLoading) void fetchGlobalTests();
  }, [userLoading, fetchGlobalTests]);

  // A bulk-imported global quiz is saved by a background worker — poll it in
  // and refresh the list once it lands.
  const { jobId: uploadJobId, status: uploadStatus, expired: uploadExpired } = useBulkSaveJob({
    cleanupUrl: "/dashboard/test-bank",
    onCompleted: fetchGlobalTests,
  });

  const typeLabel = QUESTION_TYPES.find((t) => t.value === filterType)?.label;
  const activeFilters = [
    filterSearch.trim() && { label: `"${filterSearch.trim()}"`, clear: () => setFilterSearch("") },
    filterType          && { label: typeLabel ? shortTypeLabel(typeLabel) : filterType, clear: () => setFilterType("") },
    filterProg          && { label: filterProg, clear: () => setFilterProg("") },
    filterDiff          && { label: filterDiff, clear: () => setFilterDiff("") },
    filterTag           && { label: `Tag: ${filterTag}`, clear: () => setFilterTag("") },
    filterSubject       && { label: `Subject: ${filterSubject}`, clear: () => setFilterSubject("") },
    filterTopic         && { label: `Topic: ${filterTopic}`, clear: () => setFilterTopic("") },
  ].filter((f): f is { label: string; clear: () => void } => !!f);
  // Count of filters hidden behind the "Filters" toggle, shown on the button.
  const moreFilterCount = [filterProg, filterDiff, filterTag, filterSubject, filterTopic].filter(Boolean).length;
  const clearFilters = () => {
    setFilterType(""); setFilterProg(""); setFilterSubject("");
    setFilterTopic(""); setFilterDiff(""); setFilterTag(""); setFilterSearch("");
  };

  // The tab lives in the URL too, so refresh and back keep you where you were.
  const switchTab = (t: "questions" | "quizzes") => {
    setTab(t);
    const params = new URLSearchParams(searchParams.toString());
    if (t === "questions") params.set("tab", "questions"); else params.delete("tab");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/dashboard/test-bank", { scroll: false });
  };

  // The global quiz list is small and already fully loaded, so search it client-side.
  const quizNeedle = quizSearch.trim().toLowerCase();
  const matchingQuizzes = quizNeedle
    ? globalTests.filter((t) => `${t.title} ${t.owner_programme_name ?? ""}`.toLowerCase().includes(quizNeedle))
    : globalTests;
  // Paged in the browser: the list is metadata-only and already loaded for the count and search.
  // ponytail: client-side paging, move to server paging if a programme reaches thousands of quizzes.
  const quizPageCount = Math.max(1, Math.ceil(matchingQuizzes.length / QUIZ_PAGE_SIZE));
  const quizPage = quizPageState.key === `${quizNeedle}|${showArchived}` ? Math.min(quizPageState.page, quizPageCount - 1) : 0;
  const setQuizPage = (n: number) => setQuizPageState({ key: `${quizNeedle}|${showArchived}`, page: n });
  const visibleQuizzes = matchingQuizzes.slice(quizPage * QUIZ_PAGE_SIZE, (quizPage + 1) * QUIZ_PAGE_SIZE);

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

  return (
    <div style={{ position: "relative" }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 style={{ ...headingStyle, fontSize: "28px", margin: 0 }}>Question Bank</h1>
        <p style={{ ...mutedStyle, marginTop: "4px" }}>Write, find and reuse questions, and manage the quizzes built from them.</p>
      </div>

      {/* ── Tabs + the actions for the open tab ───────────── */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between mb-5" style={{ borderBottom: "1px solid rgba(3,72,82,0.12)" }}>
        <div role="tablist" aria-label="Question bank sections" style={{ display: "flex", gap: "4px" }}>
          <TabButton active={tab === "quizzes"} onClick={() => switchTab("quizzes")} badge={!showArchived && globalTests.length > 0 ? globalTests.length : undefined}>
            Program quizzes
          </TabButton>
          <TabButton active={tab === "questions"} onClick={() => switchTab("questions")}>Questions</TabButton>
        </div>
        <div className="flex flex-wrap gap-2" style={{ paddingBottom: "10px" }}>
          {tab === "questions" ? (
            <>
              <HeaderAction onClick={() => setBulkOpen(true)} icon="⬆" title="Add many questions at once from a CSV file">Upload CSV</HeaderAction>
              <HeaderAction primary onClick={openAdd} icon="+" title="Write a single question">Add question</HeaderAction>
            </>
          ) : (
            <>
              {canCreate && <HeaderAction href={withFrom("/dashboard/test-bank/duplicate", currentUrl)} icon="⧉" title="Copy an existing quiz and edit it">Duplicate</HeaderAction>}
              <HeaderAction href="/dashboard/quiz-builder/bulk-import" icon="⬆" title="Turn a PDF, Markdown or text file into a quiz">Import from file</HeaderAction>
              <HeaderAction primary href="/dashboard/quiz-builder/new" icon="+" title="Start a blank global quiz">New quiz</HeaderAction>
            </>
          )}
        </div>
      </div>

      {tab === "questions" && bulkOpen && (
        <QuestionBulkUploadPanel
          createdBy={userId}
          onClose={() => setBulkOpen(false)}
          onDone={() => void fetchQuestions()}
        />
      )}

      {/* ── Program quizzes tab ───────────────────────────── */}
      {tab === "quizzes" && (
        <div role="tabpanel" aria-label="Program quizzes">
          <div className="p-4 sm:px-6 sm:py-5" style={{ ...glassCard, padding: undefined, borderRadius: "20px", marginBottom: "16px" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 sm:flex-1" style={{ position: "relative" }}>
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(3,72,82,0.45)", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={quizSearch}
                  onChange={(e) => setQuizSearch(e.target.value)}
                  placeholder="Search quizzes by title or programme…"
                  aria-label="Search quizzes"
                  style={{ ...inputStyle, padding: "12px 14px 12px 40px", fontSize: "16px", background: "#fff", border: "1.5px solid rgba(3,72,82,0.15)" }}
                />
              </div>
              {/* Active / Archived */}
              <div role="group" aria-label="Quiz status" style={{ display: "inline-flex", padding: "4px", borderRadius: "999px", background: "rgba(3,72,82,0.06)", alignSelf: "flex-start" }}>
                {([false, true] as const).map((archived) => (
                  <button
                    key={String(archived)}
                    type="button"
                    aria-pressed={showArchived === archived}
                    onClick={() => setShowArchived(archived)}
                    style={{
                      padding: "8px 18px", borderRadius: "999px", border: "none", cursor: "pointer",
                      fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 700,
                      background: showArchived === archived ? "#fff" : "transparent",
                      color: showArchived === archived ? "#034852" : "rgba(3,72,82,0.55)",
                      boxShadow: showArchived === archived ? "0 1px 4px rgba(3,72,82,0.12)" : "none",
                    }}
                  >
                    {archived ? "Archived" : "Active"}
                  </button>
                ))}
              </div>
            </div>
            {quizPageCount > 1 && (
              <nav aria-label="Quiz pagination" className="flex items-center justify-between gap-2 sm:justify-end" style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(3,72,82,0.08)" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.7)", marginRight: "4px" }}>
                  Page {quizPage + 1} of {quizPageCount} · {quizPage * QUIZ_PAGE_SIZE + 1}–{quizPage * QUIZ_PAGE_SIZE + visibleQuizzes.length} of {matchingQuizzes.length}
                </span>
                <span style={{ display: "flex", gap: "8px" }}>
                  <button type="button" aria-label="Previous page" disabled={quizPage === 0} onClick={() => setQuizPage(quizPage - 1)} style={pagerBtn(quizPage > 0)}>‹</button>
                  <button type="button" aria-label="Next page" disabled={quizPage >= quizPageCount - 1} onClick={() => setQuizPage(quizPage + 1)} style={pagerBtn(quizPage < quizPageCount - 1)}>›</button>
                </span>
              </nav>
            )}
          </div>

          {uploadJobId && (
            <div style={{ ...glassCard, padding: "16px 20px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", borderRadius: "16px" }}>
              <span aria-hidden style={{ width: "16px", height: "16px", flexShrink: 0, border: "2px solid rgba(32,147,121,0.25)", borderTopColor: "#209379", borderRadius: "50%", animation: "og-spin 0.8s linear infinite" }} />
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#034852" }}>Importing your quiz…</p>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#209379" }}>{uploadStatus}</p>
              </div>
              <style>{`@keyframes og-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {uploadExpired && (
            <div style={{ ...glassCard, padding: "16px 20px", marginBottom: "12px", fontSize: "13px", color: "rgba(3,72,82,0.7)", borderRadius: "16px" }}>
              This upload’s progress is no longer being tracked. It may still have saved — reload the page to see the current quizzes.
            </div>
          )}

          {visibleQuizzes.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {visibleQuizzes.map((t) => (
                <GlobalTestRow
                  key={t.id}
                  quiz={t}
                  onDelete={() => handleDeleteQuiz(t)}
                  onArchive={() => handleArchiveQuiz(t)}
                  onUnarchive={() => handleUnarchiveQuiz(t)}
                  busy={archiveBusy === t.id}
                  onMove={() => setQuizToMove({ id: t.id, title: t.title })}
                  onDuplicate={() => void handleDuplicateQuiz(t)}
                />
              ))}
            </div>
          ) : !uploadJobId && (
            <div style={{ ...glassCard, textAlign: "center", padding: "48px 24px" }}>
              <p style={labelStyle}>{quizSearch.trim() ? "No matches" : showArchived ? "Archive is empty" : "No quizzes yet"}</p>
              <p style={{ ...mutedStyle, marginTop: "10px" }}>
                {quizSearch.trim()
                  ? "No quiz title or programme matches your search."
                  : showArchived
                    ? "Archiving a quiz hides it from students and stops it being assigned."
                    : "Create one with “New quiz”, or import a whole quiz from a file."}
              </p>
            </div>
          )}
        </div>
      )}

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

      {/* ── Questions tab ─────────────────────────────────── */}
      {tab === "questions" && (
        <div role="tabpanel" aria-label="Questions">
      {/* ── Filter bar ────────────────────────────────────── */}
      {/* Padding lives in className so it can shrink on phones (inline styles can't). */}
      <div className="p-4 sm:px-6 sm:py-5" style={{ ...glassCard, padding: undefined, borderRadius: "20px", marginBottom: "20px", minWidth: 0 }}>
        {/* Search + toggles */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 sm:flex-1" style={{ position: "relative" }}>
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(3,72,82,0.45)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search question text, subject or topic…"
              aria-label="Search questions"
              // 16px stops iOS Safari from zooming the page when the field is focused.
              style={{ ...inputStyle, padding: "12px 14px 12px 40px", fontSize: "16px", background: "#fff", border: "1.5px solid rgba(3,72,82,0.15)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              className={canTriage ? undefined : "col-span-2"}
              style={{ ...chipStyle(filtersOpen || moreFilterCount > 0), padding: "11px 16px" }}
            >
              Filters{moreFilterCount > 0 && ` · ${moreFilterCount}`} <span aria-hidden>{filtersOpen ? "▴" : "▾"}</span>
            </button>
            {canTriage && (
              <Link
                href={reportsOnly ? "/dashboard/test-bank?tab=questions" : "/dashboard/test-bank?tab=questions&reports=open"}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px 16px", borderRadius: "999px",
                  fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
                  background: reportsOnly ? "#e53e3e" : "rgba(229,62,62,0.06)",
                  border: `1px solid ${reportsOnly ? "#e53e3e" : "rgba(229,62,62,0.3)"}`,
                  color: reportsOnly ? "#fff" : "#e53e3e",
                }}
                title={reportsOnly ? "Show all questions" : "Show only questions with open reports"}
              >
                <span aria-hidden>⚠</span> Reported
                {reportedQuestionCount > 0 && ` (${reportedQuestionCount})`}
                {reportsOnly && <span aria-hidden>✕</span>}
              </Link>
            )}
          </div>
        </div>

        {/* Question type quick filter */}
        {/* Phones get a dropdown; six pills either scroll out of sight or stack into rows there. */}
        <div className="sm:hidden" style={{ marginTop: "12px" }}>
          <TypeMenu value={filterType} onChange={setFilterType} />
        </div>
        <div role="group" aria-label="Question type" className="hidden sm:flex sm:flex-wrap sm:gap-2" style={{ marginTop: "14px" }}>
          <button type="button" onClick={() => setFilterType("")} aria-pressed={!filterType} style={chipStyle(!filterType)}>All types</button>
          {QUESTION_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setFilterType(filterType === t.value ? "" : t.value)} aria-pressed={filterType === t.value} style={chipStyle(filterType === t.value)}>
              {shortTypeLabel(t.label)}
            </button>
          ))}
        </div>

        {/* More filters */}
        {filtersOpen && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(3,72,82,0.08)" }}>
            <FilterField label="Programme">
              <ChipGroup options={PROGRAMME_KINDS.map((k) => k.value)} value={filterProg} onChange={setFilterProg} />
            </FilterField>
            <FilterField label="Difficulty">
              <ChipGroup options={[...DIFFICULTIES]} value={filterDiff} onChange={setFilterDiff} />
            </FilterField>
            <FilterField label="Tag"><Inp value={filterTag} onChange={setFilterTag} placeholder="Any tag" /></FilterField>
            <FilterField label="Subject"><Inp value={filterSubject} onChange={setFilterSubject} placeholder="Any subject" /></FilterField>
            <FilterField label="Topic"><Inp value={filterTopic} onChange={setFilterTopic} placeholder="Any topic" /></FilterField>
          </div>
        )}

        {/* Active filters + pager */}
        {(activeFilters.length > 0 || page > 0 || hasMore) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(3,72,82,0.08)" }}>
            {activeFilters.length > 0 && (
              <div className="min-w-0" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.55)" }}>Active:</span>
                {activeFilters.map((f) => (
                  <button key={f.label} type="button" onClick={f.clear} aria-label={`Remove filter ${f.label}`} style={{ ...chipStyle(true), padding: "4px 10px", fontSize: "12px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.label} <span aria-hidden>✕</span>
                  </button>
                ))}
                <button type="button" onClick={clearFilters} style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, color: "#e53e3e", cursor: "pointer" }}>
                  Clear all
                </button>
              </div>
            )}
            {(page > 0 || hasMore) && (
              <nav aria-label="Pagination" className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.7)", marginRight: "4px" }}>
                  Page {page + 1}{questions.length > 0 && ` · ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + questions.length}`}
                </span>
                <span style={{ display: "flex", gap: "8px" }}>
                  <button type="button" aria-label="Previous page" disabled={page === 0 || loading} onClick={() => setPage(page - 1)} style={pagerBtn(page > 0 && !loading)}>‹</button>
                  <button type="button" aria-label="Next page" disabled={!hasMore || loading} onClick={() => setPage(page + 1)} style={pagerBtn(hasMore && !loading)}>›</button>
                </span>
              </nav>
            )}
          </div>
        )}
      </div>

      {/* ── Bulk actions ──────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-3 sm:px-6" style={{ ...glassCard, padding: undefined, borderRadius: "16px", marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", alignItems: "center", background: "#f3f8f8" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#034852" }}>{selectedIds.size} selected</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setSelectedIds(new Set())} style={outlineBtn}>Deselect</button>
            <button onClick={handleBulkDelete} style={{ ...outlineBtn, borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }}>Delete Selected</button>
          </div>
        </div>
      )}

      {/* ── Question list ─────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "grid", gap: "12px" }} aria-busy="true" aria-label="Loading questions">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse" style={{ height: "112px", borderRadius: "16px", background: "rgba(3,72,82,0.06)" }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error}</p>
          <button type="button" onClick={() => void fetchQuestions()} style={{ ...outlineBtn, marginTop: "12px" }}>Try again</button>
        </div>
      ) : questions.length === 0 ? (
        activeFilters.length > 0 || reportsOnly ? (
          <div style={{ ...glassCard, textAlign: "center", padding: "48px 24px" }}>
            <p style={labelStyle}>No matches</p>
            <p style={{ ...headingStyle, fontSize: "18px", marginTop: "12px" }}>No questions match these filters</p>
            <p style={{ ...mutedStyle, marginTop: "8px" }}>Try a different search, or remove a filter.</p>
            {activeFilters.length > 0 && <button type="button" onClick={clearFilters} style={{ ...outlineBtn, marginTop: "16px" }}>Clear all filters</button>}
          </div>
        ) : (
          <div style={{ ...glassCard, textAlign: "center", padding: "48px 24px" }}>
            <p style={labelStyle}>Empty Bank</p>
            <p style={{ ...headingStyle, fontSize: "18px", marginTop: "12px" }}>No questions yet</p>
            <p style={{ ...mutedStyle, marginTop: "8px" }}>Click &quot;+ Add Question&quot; to create the first one.</p>
          </div>
        )
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "space-between", padding: "0 6px" }}>
            <label style={{ display: "flex", gap: "10px", alignItems: "center", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.7)" }}>
              <input
                type="checkbox"
                checked={questions.length > 0 && selectedIds.size === questions.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(questions.map(q => q.id)));
                  else setSelectedIds(new Set());
                }}
                style={{ width: "18px", height: "18px", accentColor: "#006d6c", cursor: "pointer", margin: 0 }}
              />
              Select all on this page
            </label>
            <span className="hidden sm:inline" style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>Click a card to edit</span>
          </div>
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={page * PAGE_SIZE + i + 1}
              openReports={reportCounts.get(q.id) ?? 0}
              selected={selectedIds.has(q.id)}
              onToggleSelect={() => {
                const next = new Set(selectedIds);
                if (next.has(q.id)) next.delete(q.id);
                else next.add(q.id);
                setSelectedIds(next);
              }}
              onEdit={() => openEdit(q)}
              onDelete={() => void handleDelete(q.id, q.content_html)}
            />
          ))}
        </div>
      )}
        </div>
      )}

      {/* ── Slide-over ────────────────────────────────────── */}
      {panelOpen && (
        <QuestionSlideOver
          initial={editTarget}
          createdBy={userId}
          onClose={closePanel}
          onSaved={() => { closePanel(); void fetchQuestions(); }}
        />
      )}
    </div>
  );
}

// ── Global Test Row ────────────────────────────────────────────

function GlobalTestRow({ quiz, onDelete, onArchive, onUnarchive, busy, onMove, onDuplicate }: {
  quiz: Omit<Quiz, "questions">;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  busy: boolean;
  onMove: () => void;
  onDuplicate: () => void;
}) {
  const canCreate = usePermission(PERM.test_bank.create);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const isArchived = quiz.archived_at != null;
  const status = isArchived
    ? { label: "Archived", bg: "rgba(229,62,62,0.1)", color: "#e53e3e" }
    : quiz.published
      ? { label: "Published", bg: "rgba(10,190,98,0.12)", color: "#079a4f" }
      : { label: "Draft", bg: "rgba(3,72,82,0.07)", color: "rgba(3,72,82,0.6)" };
  // Which programme owns this quiz. "Shared" means it is deliberately platform-wide;
  // "Unassigned" means nobody has placed it yet, and only its author can see it until somebody does.
  const scope = quiz.effective_scope_mode === "GLOBAL"
    ? { label: "Shared with all programmes", bg: "rgba(59,130,246,0.1)", color: "#2563eb" }
    : quiz.owner_programme_name
      ? { label: quiz.owner_programme_name, bg: "rgba(32,147,121,0.1)", color: "#209379" }
      : { label: "Unassigned", bg: "rgba(234,179,8,0.14)", color: "#a16207" };
  const pill = (p: { label: string; bg: string; color: string }) => (
    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", background: p.bg, color: p.color }}>{p.label}</span>
  );
  const facts = [
    quiz.duration_minutes != null ? `${quiz.duration_minutes} min` : null,
    quiz.due_at != null ? `Due ${fmt(quiz.due_at)}` : null,
    `Created ${fmt(quiz.created_at)}`,
  ].filter(Boolean).join(" · ");
  const quietBtn: React.CSSProperties = { ...outlineBtn, padding: "8px 12px", borderRadius: "10px", fontSize: "13px", background: "#fff" };

  return (
    <article
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
      style={{ background: "#fff", borderRadius: "16px", border: "1.5px solid rgba(3,72,82,0.08)", boxShadow: "0 2px 8px rgba(3,72,82,0.05)", opacity: isArchived ? 0.8 : 1 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
          {pill(status)}
          {pill(scope)}
        </div>
        <Link href={`/dashboard/quiz-builder/${quiz.id}`} style={{ fontSize: "16px", fontWeight: 700, color: "#034852", textDecoration: "none", lineHeight: 1.35 }} className="hover:underline">
          {quiz.title}
        </Link>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>{facts}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/dashboard/quiz-builder/${quiz.id}`} style={{ ...primaryBtn, padding: "8px 16px", fontSize: "13px", borderRadius: "10px", textDecoration: "none" }}>
          Open
        </Link>
        {/* Moving an archived quiz would resurrect it into a live curriculum, so it's offered only while active. */}
        {!isArchived && <button type="button" onClick={onMove} style={quietBtn} title="Attach this quiz to a course module">Move to module</button>}
        {/* The sanctioned way to use another programme's quiz: take a copy, which starts as an unpublished draft. */}
        {!isArchived && canCreate && <button type="button" onClick={onDuplicate} style={quietBtn} title="Make an editable copy">Duplicate</button>}
        {isArchived ? (
          <button type="button" onClick={onUnarchive} disabled={busy} style={{ ...quietBtn, color: "#209379", borderColor: "rgba(32,147,121,0.35)", opacity: busy ? 0.5 : 1 }}>
            {busy ? "Restoring…" : "Restore"}
          </button>
        ) : (
          <button type="button" onClick={onArchive} disabled={busy} style={{ ...quietBtn, opacity: busy ? 0.5 : 1 }} title="Hide from students without deleting">
            {busy ? "Archiving…" : "Archive"}
          </button>
        )}
        <button type="button" onClick={onDelete} aria-label="Delete quiz" title="Delete quiz" style={iconBtn("#dc2626")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
        </button>
      </div>
    </article>
  );
}

function TabButton({ active, onClick, badge, children }: { active: boolean; onClick: () => void; badge?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        position: "relative", display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 16px", marginBottom: "-1px",
        background: "none", border: "none", borderBottom: `3px solid ${active ? "#006d6c" : "transparent"}`, cursor: "pointer",
        fontFamily: "var(--font-heading)", fontSize: "15px", fontWeight: 700, color: active ? "#034852" : "rgba(3,72,82,0.5)",
        transition: "color 150ms ease, border-color 150ms ease",
      }}
    >
      {children}
      {badge !== undefined && (
        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: active ? "#006d6c" : "rgba(3,72,82,0.08)", color: active ? "#fff" : "rgba(3,72,82,0.6)" }}>{badge}</span>
      )}
    </button>
  );
}

// ── Question Card ──────────────────────────────────────────────

const TYPE_NAMES: Record<string, string> = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, shortTypeLabel(t.label)]));

function QuestionCard({ question, index, selected, onToggleSelect, onEdit, onDelete, openReports = 0 }: { question: Question; index: number; selected: boolean; onToggleSelect: () => void; onEdit: () => void; onDelete: () => void; openReports?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = question.question_type === "GROUP" && question.children.length > 0;
  const accent = typeBadge(question.question_type).color as string;
  const meta = [question.subject, question.topic, question.programme_type, question.tag].filter(Boolean) as string[];

  return (
    <article
      onClick={onEdit}
      style={{
        position: "relative", background: "#fff", borderRadius: "16px", cursor: "pointer", overflow: "hidden",
        border: `1.5px solid ${selected ? "#006d6c" : "rgba(3,72,82,0.08)"}`,
        boxShadow: selected ? "0 0 0 3px rgba(0,109,108,0.12)" : "0 2px 8px rgba(3,72,82,0.05)",
        transition: "box-shadow 150ms ease, border-color 150ms ease",
      }}
    >
      {/* Type colour stripe */}
      <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: accent }} />

      <div className="px-4 py-3.5 sm:px-5" style={{ paddingLeft: "20px" }}>
        {/* Top line: select · number · type · reports · marks · actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select question"
            style={{ width: "18px", height: "18px", accentColor: "#006d6c", cursor: "pointer", margin: 0 }}
          />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.4)", minWidth: "24px" }}>#{index}</span>
          <span style={{ ...typeBadge(question.question_type), letterSpacing: "0.02em", fontSize: "11px" }}>{TYPE_NAMES[question.question_type] ?? question.question_type}</span>
          {question.difficulty && <Tag variant={question.difficulty}>{question.difficulty}</Tag>}
          {openReports > 0 && (
            <span
              title={`${openReports} open student ${openReports === 1 ? "report" : "reports"}`}
              style={{ padding: "3px 9px", borderRadius: "999px", background: "rgba(229,62,62,0.1)", color: "#e53e3e", fontSize: "11px", fontWeight: 700 }}
            >
              ⚠ {openReports} {openReports === 1 ? "report" : "reports"}
            </span>
          )}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
            {question.marks != null && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#034852", marginRight: "6px", whiteSpace: "nowrap" }}>
                +{question.marks}
                {question.negative_marks ? <span style={{ color: "#dc2626" }}> / −{Math.abs(question.negative_marks)}</span> : null}
              </span>
            )}
            <button type="button" onClick={onEdit} aria-label="Edit question" style={textBtn("#034852")}>Edit</button>
            <button type="button" onClick={onDelete} aria-label="Delete question" style={textBtn("#dc2626")}>Delete</button>
          </span>
        </div>

        {/* Question text */}
        <MathSnippet html={question.content_html} lines={3} style={{ marginTop: "10px", fontSize: "15px", fontWeight: 500, color: "#034852", lineHeight: 1.5 }} />

        {/* Meta line */}
        {(meta.length > 0 || question.question_type === "MCQ" || question.image_url || hasChildren) && (
          <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {meta.map((m) => <Tag key={m}>{m}</Tag>)}
            {question.question_type === "MCQ" && <Tag>{question.options.length} options</Tag>}
            {question.image_url && <Tag>🖼 Image</Tag>}
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
                aria-expanded={expanded}
                style={{ marginLeft: "auto", background: "none", border: "none", padding: "2px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, color: "#006d6c" }}
              >
                {expanded ? "Hide" : "Show"} {question.children.length} sub-questions {expanded ? "▴" : "▾"}
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <ol onClick={(e) => e.stopPropagation()} style={{ listStyle: "none", margin: 0, padding: "4px 16px 12px 20px", background: "rgba(3,72,82,0.025)", borderTop: "1px solid rgba(3,72,82,0.06)", cursor: "default" }}>
          {question.children.map((child, ci) => (
            <li key={child.id} style={{ display: "flex", gap: "10px", padding: "10px 0", borderBottom: ci < question.children.length - 1 ? "1px solid rgba(3,72,82,0.06)" : "none" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.4)", flexShrink: 0, minWidth: "28px" }}>{index}.{ci + 1}</span>
              <span style={{ ...typeBadge(child.question_type), fontSize: "9px", flexShrink: 0, alignSelf: "flex-start" }}>{child.question_type}</span>
              <MathSnippet html={child.content_html} lines={2} style={{ fontSize: "13px", color: "rgba(3,72,82,0.8)" }} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return {
    width: "34px", height: "34px", display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: "10px", border: "1px solid rgba(3,72,82,0.1)", background: "#fff", color, cursor: "pointer",
  };
}

function textBtn(color: string): React.CSSProperties {
  return { ...iconBtn(color), width: "auto", padding: "0 12px", fontSize: "13px", fontWeight: 600 };
}

// ── Utility components ─────────────────────────────────────────

function Inp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, fontSize: "16px" }} />;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(3,72,82,0.55)", margin: "0 0 6px" }}>{label}</p>
      {children}
    </div>
  );
}

/** Single-select pill group; clicking the active pill clears it. */
function ChipGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(value === o ? "" : o)} aria-pressed={value === o} style={chipStyle(value === o)}>{o}</button>
      ))}
    </div>
  );
}

/** Styled question-type dropdown for phones (a native <select> renders an unstyled OS list). */
/** Open/close state for a popover that closes on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const popoverPanel: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 6px)", zIndex: 30, listStyle: "none", margin: 0, padding: "6px",
  background: "#fff", borderRadius: "14px", border: "1px solid rgba(3,72,82,0.1)", boxShadow: "0 12px 32px rgba(3,72,82,0.16)",
};

/** Header button: filled when primary, quiet outline otherwise. Renders a Link when given href. */
function HeaderAction({ children, icon, title, primary, href, onClick }: { children: React.ReactNode; icon: string; title: string; primary?: boolean; href?: string; onClick?: () => void }) {
  const style: React.CSSProperties = primary
    ? { ...primaryBtn, padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }
    : {
        padding: "10px 16px", borderRadius: "12px", display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap",
        fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", color: "#034852", textDecoration: "none", cursor: "pointer",
        background: "#fff", border: "1.5px solid rgba(3,72,82,0.15)",
      };
  const content = <><span aria-hidden style={{ fontSize: "15px", lineHeight: 1 }}>{icon}</span>{children}</>;
  return href
    ? <Link href={href} title={title} style={style}>{content}</Link>
    : <button type="button" onClick={onClick} title={title} style={style}>{content}</button>;
}

function TypeMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { open, setOpen, ref } = usePopover();

  const options = [{ value: "", label: "All types" }, ...QUESTION_TYPES.map((t) => ({ value: t.value, label: shortTypeLabel(t.label) }))];
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          ...inputStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", textAlign: "left",
          padding: "12px 14px", fontWeight: 600,
          background: value ? "rgba(0,109,108,0.08)" : "#fff",
          border: `1.5px solid ${value || open ? "#006d6c" : "rgba(3,72,82,0.15)"}`,
        }}
      >
        <span style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)" }}>Type</span>
        <span style={{ flex: 1 }}>{current.label}</span>
        <span aria-hidden style={{ transition: "transform 150ms ease", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Question type"
          style={{ ...popoverPanel, left: 0, right: 0 }}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "11px 12px", border: "none", borderRadius: "10px", cursor: "pointer", textAlign: "left",
                    fontFamily: "var(--font-body)", fontSize: "15px", fontWeight: selected ? 700 : 500,
                    background: selected ? "rgba(0,109,108,0.08)" : "transparent", color: "#034852",
                  }}
                >
                  {o.label}
                  {selected && <span aria-hidden style={{ color: "#006d6c" }}>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "Multiple Choice (MCQ)" → "Multiple Choice": the chips don't need the parenthetical. */
function shortTypeLabel(label: string): string {
  return label.replace(/ \(.*\)$/, "");
}

function pagerBtn(enabled: boolean): React.CSSProperties {
  return {
    width: "36px", height: "36px", borderRadius: "999px", fontSize: "18px", lineHeight: 1,
    border: "1px solid rgba(3,72,82,0.15)", background: "#fff", color: "#034852",
    cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.4,
  };
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 14px", borderRadius: "999px", cursor: "pointer", whiteSpace: "nowrap",
    fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
    border: `1px solid ${active ? "#006d6c" : "rgba(3,72,82,0.15)"}`,
    background: active ? "#006d6c" : "#fff",
    color: active ? "#fff" : "#034852",
    transition: "background 150ms ease, color 150ms ease",
  };
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelStyle}>Loading</p>
        <p style={{ ...headingStyle, marginTop: "12px" }}>Fetching question bank…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};
const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0,
};
const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852",
};
const mutedStyle: React.CSSProperties = { fontSize: "14px", color: "rgba(3,72,82,0.6)" };
const primaryBtn: React.CSSProperties = {
  padding: "11px 22px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 240ms ease", whiteSpace: "nowrap", display: "inline-block",
};
const outlineBtn: React.CSSProperties = {
  padding: "6px 14px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px",
  background: "transparent", color: "#034852", fontFamily: "var(--font-body)",
  fontWeight: 600, fontSize: "12px", cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box",
};
