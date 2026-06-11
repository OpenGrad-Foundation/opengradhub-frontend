"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import CourseCurriculumEditor from "../_components/CourseCurriculumEditor";
import CourseMetaForm from "../../courses/_components/CourseMetaForm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  getCourseManagementAnalytics,
  getCourseManagementCurriculum,
  getCourseManagementStudentDetail,
  getCourseManagementStudents,
  getCourseManagementSummary,
  unassignCourse,
  updateCourse,
  type CourseManagementAnalytics,
  type CourseManagementModuleSummary,
  type CourseManagementStudentDetail,
  type CourseManagementStudentsResponse,
  type CourseManagementSummary,
} from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";
import { useInvalidate } from "@/lib/mutations/invalidation";

const TABS = ["curriculum", "overview", "students", "analytics", "settings"] as const;
type TabKey = (typeof TABS)[number];

export default function CourseManagementPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const invalidate = useInvalidate();

  const courseId = params.id;
  const roleCode = (userData?.role?.code ?? "") as RoleCode;
  const callerId = userData?.user?.id ?? "";
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "curriculum";
  const canAccess = has(PERM.courses.edit);
  const canEnrol = has(PERM.courses.enrol);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  const [summary, setSummary] = useState<CourseManagementSummary | null>(null);
  const [analytics, setAnalytics] = useState<CourseManagementAnalytics | null>(null);
  const [curriculumSummary, setCurriculumSummary] = useState<CourseManagementModuleSummary[] | null>(null);
  const [students, setStudents] = useState<CourseManagementStudentsResponse | null>(null);
  const [detail, setDetail] = useState<CourseManagementStudentDetail | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("ALL");
  const [progressBucket, setProgressBucket] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);

  const loadSummary = useCallback(async () => {
    const [summaryData, analyticsData] = await Promise.all([
      getCourseManagementSummary(courseId),
      getCourseManagementAnalytics(courseId),
    ]);
    setSummary(summaryData);
    setAnalytics(analyticsData);
  }, [courseId]);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const response = await getCourseManagementStudents(courseId, {
        search: search.trim() || undefined,
        status: assignmentStatus === "ALL" ? undefined : assignmentStatus,
        progressBucket: progressBucket === "ALL" ? undefined : progressBucket,
        sort,
        page,
        pageSize: 8,
      });
      setStudents(response);
      if (response.page !== page) setPage(response.page);
    } catch (studentsError) {
      setError(studentsError instanceof Error ? studentsError.message : "Failed to load students.");
    } finally {
      setStudentsLoading(false);
    }
  }, [assignmentStatus, courseId, page, progressBucket, search, sort]);

  const handleRemoveStudent = useCallback(
    async (studentId: string, studentName: string) => {
      if (!window.confirm(`Remove ${studentName} from this course? Their enrolment will be deleted.`)) {
        return;
      }
      setRemovingStudentId(studentId);
      setError(null);
      try {
        await unassignCourse(studentId, courseId);
        if (selectedStudentId === studentId) setSelectedStudentId(null);
        await loadStudents();
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "Failed to remove student.");
      } finally {
        setRemovingStudentId(null);
      }
    },
    [courseId, loadStudents, selectedStudentId],
  );

  useEffect(() => {
    if (userLoading || !callerId || !canAccess) return;
    setLoading(true);
    setError(null);
    void loadSummary()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load course management workspace.");
      })
      .finally(() => setLoading(false));
  }, [canAccess, callerId, loadSummary, userLoading]);

  useEffect(() => {
    if (!callerId || !canAccess) return;
    if (activeTab === "students") {
      void loadStudents();
    }
    if (activeTab === "curriculum" && curriculumSummary === null) {
      void getCourseManagementCurriculum(courseId)
        .then(setCurriculumSummary)
        .catch((curriculumError) => {
          setError(curriculumError instanceof Error ? curriculumError.message : "Failed to load curriculum summary.");
        });
    }
  }, [activeTab, callerId, canAccess, courseId, curriculumSummary, loadStudents]);

  useEffect(() => {
    if (!selectedStudentId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    void getCourseManagementStudentDetail(courseId, selectedStudentId)
      .then(setDetail)
      .catch((detailError) => {
        setError(detailError instanceof Error ? detailError.message : "Failed to load student detail.");
      })
      .finally(() => setDetailLoading(false));
  }, [courseId, selectedStudentId]);

  const updateTab = (tab: TabKey) => {
    const paramsCopy = new URLSearchParams(searchParams.toString());
    paramsCopy.set("tab", tab);
    router.replace(`/dashboard/course-management/${courseId}?${paramsCopy.toString()}`);
  };

  const currentCourse = summary?.course ?? null;
  const curriculumPreview = curriculumSummary ?? summary?.module_progress ?? [];
  const studentsRows = students?.items ?? [];
  const emptyMessage = useMemo(() => {
    if (studentsLoading) return "Loading students…";
    if (studentsRows.length > 0) return null;
    return "No students matched the current filters.";
  }, [studentsLoading, studentsRows.length]);

  async function handleStatusToggle() {
    if (!currentCourse) return;
    const nextStatus = currentCourse.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    setActionLoading(true);
    try {
      await updateCourse(currentCourse.id, {
        status: nextStatus,
        caller_id: callerId,
        caller_role: roleCode,
      });
      invalidate('courses');
      await loadSummary();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update course status.");
    } finally {
      setActionLoading(false);
    }
  }

  if (userLoading || loading) {
    return (
      <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
        <div style={{ ...card, textAlign: "center" }}>
          <p style={eyebrow}>Course Management</p>
          <p style={{ ...title, marginTop: "12px" }}>Opening course workspace…</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        <div style={{ ...card, textAlign: "center" }}>
          <p style={eyebrow}>Access denied</p>
          <p style={{ ...title, marginTop: "12px" }}>This workspace is available to Super Admins and Program Managers only.</p>
          <BackLink fallback="/dashboard/courses" style={{ ...primaryBtn, textDecoration: "none", marginTop: "16px", display: "inline-flex" }}>
            Back to Courses
          </BackLink>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        <div style={{ ...card, textAlign: "center" }}>
          <p style={eyebrow}>Course Management</p>
          <p style={{ ...title, marginTop: "12px" }}>{error}</p>
          <BackLink fallback="/dashboard/courses" style={{ ...primaryBtn, textDecoration: "none", marginTop: "16px", display: "inline-flex" }}>
            Back to Courses
          </BackLink>
        </div>
      </div>
    );
  }

  return (
    <div className="course-mgmt-container" style={{ maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px", padding: "0 16px" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* General page layout adjustments */
        @media (max-width: 768px) {
          .course-mgmt-container {
            padding: 0 12px !important;
            gap: 16px !important;
          }
          .course-mgmt-header-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .course-mgmt-header-buttons {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .course-mgmt-header-buttons a,
          .course-mgmt-header-buttons button {
            width: 100% !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .course-mgmt-title {
            font-size: 24px !important;
          }
          .course-mgmt-card {
            padding: 16px 16px !important;
            border-radius: 16px !important;
          }
          .course-mgmt-hero-card {
            padding: 16px 16px !important;
            border-radius: 16px !important;
          }
          .course-mgmt-hero-flex {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .course-mgmt-cover-img {
            width: 100% !important;
            height: 160px !important;
          }
          .course-mgmt-meta-col {
            width: 100% !important;
            border-top: 1px solid rgba(3,72,82,0.08);
            padding-top: 12px !important;
            margin-top: 4px !important;
          }
          .course-mgmt-tabs-strip {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            border-radius: 14px !important;
            padding: 6px !important;
          }
          .course-mgmt-tabs-strip::-webkit-scrollbar {
            display: none;
          }
          .course-mgmt-tab-btn {
            flex-shrink: 0 !important;
            white-space: nowrap !important;
            padding: 8px 12px !important;
            font-size: 12px !important;
          }
          .course-mgmt-filters-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .course-mgmt-filters-box {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .course-mgmt-filter-input {
            width: 100% !important;
          }
          .course-mgmt-filter-select {
            width: 100% !important;
            min-width: 0 !important;
          }
          .course-mgmt-grid-2col {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 480px) {
          .course-mgmt-slideover-metrics {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .course-mgmt-slideover-metric-card {
            padding: 12px 14px !important;
          }
          .course-mgmt-slideover-metric-card p {
            font-size: 18px !important;
          }
        }
      ` }} />

      <div className="course-mgmt-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <BackLink fallback="/dashboard/courses" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 700 }}>
            ← Courses
          </BackLink>
          <p style={{ ...eyebrow, marginTop: "14px" }}>Course Management</p>
          <h1 className="course-mgmt-title" style={{ ...title, fontSize: "30px", marginTop: "6px" }}>{currentCourse?.title}</h1>
          <p style={subtitle}>
            Manage students, curriculum, analytics, and settings without leaving the staff workspace.
          </p>
        </div>

        <div className="course-mgmt-header-buttons" style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {currentCourse && (
            <>
              <Link href={`/dashboard/courses/${currentCourse.id}?from=management`} style={ghostLinkBtn}>
                Preview as student
              </Link>
              <button onClick={() => void handleStatusToggle()} disabled={actionLoading} style={{ ...primaryBtn, opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? "Updating…" : currentCourse.status === "ACTIVE" ? "Archive course" : "Publish course"}
              </button>
            </>
          )}
        </div>
      </div>

      {currentCourse && (
        <div className="course-mgmt-hero-card" style={heroCard}>
          <div className="course-mgmt-hero-flex" style={{ display: "flex", gap: "18px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div
              className="course-mgmt-cover-img"
              style={{
                width: "148px",
                height: "102px",
                borderRadius: "18px",
                background: currentCourse.cover_image_url
                  ? `url(${currentCourse.cover_image_url}) center/cover`
                  : "linear-gradient(135deg, #034852 0%, #209379 100%)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <Pill>{currentCourse.programme_type}</Pill>
                <Pill>{currentCourse.access_type}</Pill>
                <Pill>{currentCourse.locking_mode}</Pill>
                <Pill tone={currentCourse.status === "ACTIVE" ? "green" : currentCourse.status === "ARCHIVED" ? "red" : "amber"}>
                  {currentCourse.status}
                </Pill>
              </div>
              <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.66)", marginTop: "14px", lineHeight: 1.65 }}>
                {currentCourse.description ?? "No description added yet."}
              </p>
            </div>
            <div className="course-mgmt-meta-col" style={{ minWidth: "180px", display: "grid", gap: "8px" }}>
              <MetaLine label="Lessons" value={String(currentCourse.lesson_count)} />
              <MetaLine label="Created" value={formatDate(currentCourse.created_at)} />
              <MetaLine label="Status" value={currentCourse.status} />
            </div>
          </div>
        </div>
      )}

      {error && summary && <div style={errorBox}>{error}</div>}

      <div className="course-mgmt-tabs-strip" style={tabStrip}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => updateTab(tab)}
            className="course-mgmt-tab-btn"
            style={{
              ...tabBtn,
              background: activeTab === tab ? "linear-gradient(135deg, rgba(10,190,98,0.18), rgba(32,147,121,0.18))" : "transparent",
              borderColor: activeTab === tab ? "rgba(32,147,121,0.28)" : "transparent",
              color: activeTab === tab ? "#034852" : "rgba(3,72,82,0.55)",
            }}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {activeTab === "overview" && summary && (
        <OverviewTab summary={summary} />
      )}

      {activeTab === "students" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="course-mgmt-card" style={card}>
            <div className="course-mgmt-filters-row" style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <p style={eyebrow}>Students</p>
                <h3 style={{ ...title, fontSize: "22px", marginTop: "4px" }}>Roster and progress</h3>
                <p style={subtitle}>Track enrolled students, progress, marks, assignment state, and recent activity.</p>
              </div>
              <div className="course-mgmt-filters-box" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search student name or email…"
                  className="course-mgmt-filter-input"
                  style={{ ...inputStyle, width: "260px" }}
                />
                <select
                  value={assignmentStatus}
                  onChange={(event) => {
                    setAssignmentStatus(event.target.value);
                    setPage(1);
                  }}
                  className="course-mgmt-filter-select"
                  style={selectStyle}
                >
                  <option value="ALL">All assignment states</option>
                  <option value="NOT_STARTED">Not started</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="LATE">Late</option>
                  <option value="GRADING">Grading</option>
                  <option value="GRADED">Graded</option>
                </select>
                <select
                  value={progressBucket}
                  onChange={(event) => {
                    setProgressBucket(event.target.value);
                    setPage(1);
                  }}
                  className="course-mgmt-filter-select"
                  style={selectStyle}
                >
                  <option value="ALL">All progress</option>
                  <option value="AT_RISK">At risk</option>
                  <option value="ON_TRACK">On track</option>
                  <option value="COMPLETE">Complete</option>
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="course-mgmt-filter-select" style={selectStyle}>
                  <option value="name">Sort: name</option>
                  <option value="progress">Sort: progress</option>
                  <option value="quiz">Sort: quiz marks</option>
                  <option value="recent">Sort: recent activity</option>
                  <option value="enrolled">Sort: enrolled date</option>
                </select>
              </div>
            </div>
          </div>

          <div className="course-mgmt-card" style={card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                <thead>
                  <tr>
                    {["Student", "Enrolled", "Progress", "Quiz marks", "Assignments", "Last active"].map((heading) => (
                      <th key={heading} style={tableHead}>{heading}</th>
                    ))}
                    {canEnrol && <th style={tableHead}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {studentsRows.map((student) => (
                    <tr key={student.id} style={tableRow} onClick={() => setSelectedStudentId(student.id)}>
                      <td style={tableCell}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: "#034852" }}>{student.name}</p>
                          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>{student.email ?? "No email"}</p>
                        </div>
                      </td>
                      <td style={tableCell}>{formatDate(student.enrolled_at)}</td>
                      <td style={tableCell}>
                        <div style={{ display: "grid", gap: "6px" }}>
                          <div style={progressTrack}>
                            <div style={{ ...progressFill, width: `${student.progress_percent}%` }} />
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#034852" }}>
                            {student.progress_percent}% • {student.completed_lessons}/{student.total_lessons} lessons
                          </span>
                        </div>
                      </td>
                      <td style={tableCell}>{student.average_quiz_score_percent != null ? `${student.average_quiz_score_percent}%` : "No attempts"}</td>
                      <td style={tableCell}>
                        <span style={statusBadge(student.assignment_status)}>{humanizeStatus(student.assignment_status)}</span>
                      </td>
                      <td style={tableCell}>{student.last_active_at ? formatRelativeTime(student.last_active_at) : "No recent activity"}</td>
                      {canEnrol && (
                        <td style={tableCell} onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => void handleRemoveStudent(student.id, student.name)}
                            disabled={removingStudentId === student.id}
                            style={removeBtn}
                          >
                            {removingStudentId === student.id ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {emptyMessage && <p style={{ marginTop: "18px", color: "rgba(3,72,82,0.58)" }}>{emptyMessage}</p>}

            {students && students.total_pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginTop: "18px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)" }}>
                  Page {students.page} of {students.total_pages} • {students.total} students
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={!students.has_prev} style={ghostBtn}>
                    Previous
                  </button>
                  <button onClick={() => setPage((value) => value + 1)} disabled={!students.has_next} style={ghostBtn}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "curriculum" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="course-mgmt-card" style={card}>
            <p style={eyebrow}>Curriculum Snapshot</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "14px" }}>
              {curriculumPreview.map((module) => (
                <div key={module.id} style={miniCard}>
                  <p style={{ margin: 0, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#209379", fontWeight: 800 }}>
                    Module {module.order_index + 1}
                  </p>
                  <p style={{ margin: "8px 0 0", fontWeight: 700, color: "#034852" }}>{module.title}</p>
                  <p style={{ margin: "8px 0 0", fontSize: "13px", color: "rgba(3,72,82,0.58)" }}>
                    {module.lesson_count} lessons • {module.avg_completion_percent}% avg completion
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="course-mgmt-card" style={card}>
            <CourseCurriculumEditor courseId={courseId} />
          </div>
        </div>
      )}

      {activeTab === "analytics" && analytics && (
        <AnalyticsTab analytics={analytics} />
      )}

      {activeTab === "settings" && currentCourse && (
        <div className="course-mgmt-card" style={card}>
          <div style={{ marginBottom: "18px" }}>
            <p style={eyebrow}>Settings</p>
            <h3 style={{ ...title, fontSize: "22px", marginTop: "4px" }}>Course details and publishing</h3>
            <p style={subtitle}>Update metadata here while keeping learner preview and curriculum editing separate.</p>
          </div>
          <CourseMetaForm
            key={`${currentCourse.id}-${currentCourse.title}-${currentCourse.status}-${currentCourse.access_type}-${currentCourse.locking_mode}-${currentCourse.cover_image_url ?? ""}`}
            initial={currentCourse}
            submitLabel="Save settings"
            onSave={async (fields) => {
              await updateCourse(courseId, {
                ...fields,
                caller_id: callerId,
                caller_role: roleCode,
              });
              invalidate('courses');
              await loadSummary();
            }}
          />
        </div>
      )}

      {selectedStudentId && (
        <StudentDetailSlideOver detail={detail} loading={detailLoading} onClose={() => setSelectedStudentId(null)} />
      )}
    </div>
  );
}

function OverviewTab({ summary }: { summary: CourseManagementSummary }) {
  const metrics = summary.metrics;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px" }}>
        <MetricCard label="Enrolled students" value={String(metrics.enrolled_students)} />
        <MetricCard label="Average completion" value={`${metrics.average_completion_percent}%`} />
        <MetricCard label="Average quiz marks" value={`${metrics.average_quiz_score_percent}%`} />
        <MetricCard label="Assignment submission rate" value={`${metrics.assignment_submission_rate_percent}%`} />
        <MetricCard label="At-risk students" value={String(metrics.at_risk_students)} />
      </div>

      <div className="course-mgmt-grid-2col" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px" }}>
        <div className="course-mgmt-card" style={card}>
          <p style={eyebrow}>Recent activity</p>
          <h3 style={{ ...title, fontSize: "22px", marginTop: "4px" }}>What happened lately</h3>
          <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
            {summary.recent_activity.length === 0 && (
              <p style={{ margin: 0, color: "rgba(3,72,82,0.55)" }}>No course activity yet.</p>
            )}
            {summary.recent_activity.map((activity, idx) => (
              <div key={`${activity.student_name}-${activity.happened_at}-${idx}`} style={timelineRow}>
                <div style={timelineDot} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "#034852" }}>
                    {activity.student_name} • {humanizeActivityType(activity.type)}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(3,72,82,0.56)" }}>
                    {activity.label} • {formatRelativeTime(activity.happened_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="course-mgmt-card" style={card}>
          <p style={eyebrow}>Modules</p>
          <h3 style={{ ...title, fontSize: "22px", marginTop: "4px" }}>Module progress</h3>
          <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
            {summary.module_progress.map((module) => (
              <div key={module.id} style={miniCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#034852" }}>{module.title}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.52)" }}>
                      {module.lesson_count} lessons
                    </p>
                  </div>
                  <span style={{ fontWeight: 800, color: "#209379" }}>{module.avg_completion_percent}%</span>
                </div>
                <div style={{ ...progressTrack, marginTop: "10px" }}>
                  <div style={{ ...progressFill, width: `${module.avg_completion_percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTab({ analytics }: { analytics: CourseManagementAnalytics }) {
  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div className="course-mgmt-grid-2col" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "16px" }}>
        <div className="course-mgmt-card" style={card}>
          <p style={eyebrow}>Enrollment trend</p>
          <h3 style={{ ...title, fontSize: "22px", marginTop: "4px" }}>Enrollment over time</h3>
          <div style={{ display: "grid", gap: "10px", marginTop: "18px" }}>
            {analytics.enrollment_trend.length === 0 && (
              <p style={{ margin: 0, color: "rgba(3,72,82,0.55)" }}>No enrollment data yet.</p>
            )}
            {analytics.enrollment_trend.map((point) => (
              <div key={point.date} style={{ display: "grid", gridTemplateColumns: "100px 1fr 48px", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)" }}>{point.date}</span>
                <div style={progressTrack}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${Math.max(8, point.enrolled_students * 12)}px`,
                      maxWidth: "100%",
                    }}
                  />
                </div>
                <span style={{ fontWeight: 700, color: "#034852" }}>{point.enrolled_students}</span>
              </div>
            ))}
          </div>
        </div>

        <DistributionCard title="Progress distribution" items={analytics.progress_distribution} />
      </div>

      <DistributionCard title="Quiz score distribution" items={analytics.quiz_score_distribution} />
    </div>
  );
}

function DistributionCard({
  title: cardTitle,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <div className="course-mgmt-card" style={card}>
      <p style={eyebrow}>Distribution</p>
      <h3 style={{ ...title, fontSize: "22px", marginTop: "4px" }}>{cardTitle}</h3>
      <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "grid", gridTemplateColumns: "90px 1fr 40px", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "rgba(3,72,82,0.58)" }}>{item.label}</span>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${(item.count / max) * 100}%` }} />
            </div>
            <span style={{ fontWeight: 700, color: "#034852" }}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentDetailSlideOver({
  detail,
  loading,
  onClose,
}: {
  detail: CourseManagementStudentDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,20,30,0.35)", zIndex: 40, backdropFilter: "blur(2px)" }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(580px, 100vw)",
          background: "rgba(255,255,255,0.98)",
          boxShadow: "-16px 0 48px rgba(0,0,0,0.12)",
          zIndex: 50,
          padding: "28px 30px",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div>
            <p style={eyebrow}>Student Detail</p>
            <h3 style={{ ...title, fontSize: "24px", marginTop: "4px" }}>{detail?.name ?? "Loading…"}</h3>
            {detail?.email && <p style={subtitle}>{detail.email}</p>}
          </div>
          <button onClick={onClose} style={ghostBtn}>Close</button>
        </div>

        {loading || !detail ? (
          <div className="course-mgmt-card" style={{ ...card, marginTop: "18px", textAlign: "center" }}>
            <p style={eyebrow}>Loading</p>
            <p style={{ ...title, marginTop: "12px" }}>Fetching student detail…</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px", marginTop: "18px" }}>
            <div className="course-mgmt-slideover-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
              <MetricCard label="Progress" value={`${detail.progress_percent}%`} compact />
              <MetricCard label="Lessons" value={`${detail.completed_lessons}/${detail.total_lessons}`} compact />
              <MetricCard label="Quiz average" value={detail.average_quiz_score_percent != null ? `${detail.average_quiz_score_percent}%` : "—"} compact />
              <MetricCard label="Last active" value={detail.last_active_at ? formatRelativeTime(detail.last_active_at) : "—"} compact />
            </div>

            <SectionCard title="Lesson activity">
              {detail.lessons.map((lesson) => (
                <div key={lesson.id} style={listRow}>
                  <div>
                    <p style={listTitle}>{lesson.title}</p>
                    <p style={listMeta}>{lesson.module_title}</p>
                  </div>
                  <span style={statusBadge(lesson.is_complete ? "COMPLETED" : "PENDING")}>
                    {lesson.is_complete ? "Completed" : "Pending"}
                  </span>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Quiz attempts">
              {detail.quiz_attempts.length === 0 && <p style={emptyText}>No quiz attempts yet.</p>}
              {detail.quiz_attempts.map((attempt) => (
                <div key={attempt.id} style={listRow}>
                  <div>
                    <p style={listTitle}>{attempt.title}</p>
                    <p style={listMeta}>{attempt.submitted_at ? formatDate(attempt.submitted_at) : "In progress"}</p>
                  </div>
                  <span style={statusBadge(attempt.passed ? "PASSED" : attempt.score_percent != null ? "SCORED" : "PENDING")}>
                    {attempt.score_percent != null ? `${attempt.score_percent}%` : "Pending"}
                  </span>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Assignments">
              {detail.assignments.length === 0 && <p style={emptyText}>No assignments attached to this course.</p>}
              {detail.assignments.map((assignment) => (
                <div key={assignment.id} style={listRow}>
                  <div>
                    <p style={listTitle}>{assignment.title}</p>
                    <p style={listMeta}>{assignment.submitted_at ? formatDate(assignment.submitted_at) : "No submission yet"}</p>
                  </div>
                  <span style={statusBadge(assignment.status)}>{humanizeStatus(assignment.status)}</span>
                </div>
              ))}
            </SectionCard>
          </div>
        )}
      </div>
    </>
  );
}

function SectionCard({ title: sectionTitle, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="course-mgmt-card" style={card}>
      <h4 style={{ ...title, fontSize: "18px", marginTop: 0 }}>{sectionTitle}</h4>
      <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>{children}</div>
    </div>
  );
}

function MetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="course-mgmt-slideover-metric-card" style={{ ...miniCard, padding: compact ? "16px 18px" : "20px 22px" }}>
      <p style={{ margin: 0, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.18em", color: "#209379", fontWeight: 800 }}>
        {label}
      </p>
      <p style={{ margin: "10px 0 0", fontSize: compact ? "22px" : "26px", fontWeight: 800, color: "#034852" }}>{value}</p>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "13px" }}>
      <span style={{ color: "rgba(3,72,82,0.55)" }}>{label}</span>
      <span style={{ color: "#034852", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "green" | "red" | "amber" }) {
  const styles =
    tone === "green"
      ? { background: "rgba(10,190,98,0.14)", color: "#047857" }
      : tone === "red"
        ? { background: "rgba(229,62,62,0.12)", color: "#b83232" }
        : tone === "amber"
          ? { background: "rgba(245,158,11,0.16)", color: "#8a5a00" }
          : { background: "rgba(32,147,121,0.12)", color: "#209379" };
  return <span style={{ ...pill, ...styles }}>{children}</span>;
}

function tabLabel(tab: TabKey) {
  switch (tab) {
    case "overview":
      return "Overview";
    case "students":
      return "Students";
    case "curriculum":
      return "Curriculum";
    case "analytics":
      return "Analytics";
    case "settings":
      return "Settings";
  }
}

function humanizeStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeActivityType(type: string) {
  switch (type) {
    case "LESSON_COMPLETED":
      return "completed a lesson";
    case "QUIZ_SUBMITTED":
      return "submitted a quiz";
    case "ASSIGNMENT_SUBMITTED":
      return "submitted an assignment";
    default:
      return "enrolled in the course";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeTime(value: string) {
  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaHours = Math.max(1, Math.floor(deltaMs / (1000 * 60 * 60)));
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 30) return `${deltaDays}d ago`;
  return formatDate(value);
}

function statusBadge(status: string): React.CSSProperties {
  const normalized = status.toUpperCase();
  if (normalized === "GRADED" || normalized === "COMPLETED" || normalized === "PASSED") {
    return { ...badgeBase, background: "rgba(10,190,98,0.14)", color: "#047857" };
  }
  if (normalized === "LATE" || normalized === "PENDING" || normalized === "NOT_STARTED") {
    return { ...badgeBase, background: "rgba(245,158,11,0.16)", color: "#8a5a00" };
  }
  if (normalized === "GRADING" || normalized === "SUBMITTED" || normalized === "SCORED") {
    return { ...badgeBase, background: "rgba(37,99,235,0.12)", color: "#1d4ed8" };
  }
  return { ...badgeBase, background: "rgba(3,72,82,0.08)", color: "#034852" };
}

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "24px",
  padding: "24px 28px",
  boxShadow: "0 12px 30px rgba(3,72,82,0.06)",
};

const heroCard: React.CSSProperties = {
  ...card,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,250,248,0.98))",
};

const miniCard: React.CSSProperties = {
  background: "rgba(244,250,248,0.9)",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "18px",
  padding: "18px 20px",
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.24em",
  color: "#209379",
};

const title: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  color: "#034852",
};

const subtitle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "14px",
  lineHeight: 1.65,
  color: "rgba(3,72,82,0.6)",
};

const pill: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.08em",
};

const tabStrip: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  padding: "8px",
  borderRadius: "20px",
  background: "rgba(255,255,255,0.8)",
  border: "1px solid rgba(3,72,82,0.08)",
  boxShadow: "0 8px 22px rgba(3,72,82,0.05)",
};

const tabBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "14px",
  border: "1px solid transparent",
  background: "transparent",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 18px",
  border: "none",
  borderRadius: "14px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff",
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(10,190,98,0.18)",
};

const ghostBtn: React.CSSProperties = {
  padding: "12px 16px",
  border: "1px solid rgba(3,72,82,0.14)",
  borderRadius: "14px",
  background: "#fff",
  color: "#034852",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const removeBtn: React.CSSProperties = {
  padding: "7px 12px",
  border: "1px solid rgba(229,62,62,0.28)",
  borderRadius: "10px",
  background: "rgba(229,62,62,0.06)",
  color: "#b83232",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostLinkBtn: React.CSSProperties = {
  ...ghostBtn,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const errorBox: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "16px",
  background: "rgba(229,62,62,0.08)",
  border: "1px solid rgba(229,62,62,0.16)",
  color: "#b83232",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(3,72,82,0.12)",
  background: "rgba(244,250,248,0.95)",
  color: "#034852",
  fontSize: "14px",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  minWidth: "170px",
};

const tableHead: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(3,72,82,0.48)",
  textAlign: "left",
  borderBottom: "1px solid rgba(3,72,82,0.08)",
};

const tableCell: React.CSSProperties = {
  padding: "16px 12px",
  borderBottom: "1px solid rgba(3,72,82,0.06)",
  color: "#034852",
  verticalAlign: "top",
};

const tableRow: React.CSSProperties = {
  cursor: "pointer",
};

const progressTrack: React.CSSProperties = {
  height: "8px",
  borderRadius: "999px",
  background: "rgba(3,72,82,0.09)",
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #0abe62, #209379)",
};

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5px 10px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 800,
};

const timelineRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "10px 1fr",
  gap: "12px",
  alignItems: "start",
};

const timelineDot: React.CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "#0abe62",
  marginTop: "6px",
};

const listRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid rgba(3,72,82,0.06)",
};

const listTitle: React.CSSProperties = {
  margin: 0,
  fontWeight: 700,
  color: "#034852",
};

const listMeta: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "12px",
  color: "rgba(3,72,82,0.52)",
};

const emptyText: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "rgba(3,72,82,0.55)",
};
