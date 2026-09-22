"use client";

import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Layers, Mail, MapPin, School } from "lucide-react";
import { EntityLink } from "../../programmes/_components/entity-link";
import { usePermissions } from "@/hooks/use-permission";
import { PERM, STUDENT_PROFILE_PERMISSIONS } from "@/lib/permissions";
import { BackLink } from "@/components/back-link";
import { PerformanceHistoryTable } from "@/components/performance-history-table";
import workspace from "@/components/dashboard/workspace.module.css";
import { Tabs, type TabDef } from "../../_components/Tabs";
import catalogue from "../../_components/catalogue.module.css";
import styles from "../students.module.css";
import { TrackerSection } from "./_components/tracker-section";
import { useStudentProfile } from "@/lib/queries/students";
import { useTopicStrength } from "@/lib/queries/analytics";
import { useReportHistory } from "@/lib/queries/reports";
import type { StudentProfile } from "@/lib/api";

const linkStyle: React.CSSProperties = { color: "var(--teal)", fontWeight: 600, textDecoration: "none" };
const backLink = <BackLink fallback="/dashboard/analytics" className={styles.back}><ArrowLeft size={16} aria-hidden="true" />Back</BackLink>;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { has, hasAny } = usePermissions();
  const { data, isPending, error } = useStudentProfile(id);
  // Both degrade silently — the profile itself is the page, these are extras.
  const { data: history } = useReportHistory(id, hasAny(...STUDENT_PROFILE_PERMISSIONS));
  const { data: topics } = useTopicStrength(id);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.toolbar}>{backLink}</div>
        <section role="alert" className={catalogue.empty}>
          <AlertTriangle size={28} aria-hidden="true" />
          <h2>Student profile unavailable</h2>
          <p>{error instanceof Error ? error.message : "Failed to load student profile."}</p>
        </section>
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.toolbar}>{backLink}</div>
        <div role="status" aria-label="Loading student" className={styles.skeletonTable}>
          {[0, 1, 2, 3].map((index) => <div key={index} aria-hidden="true" />)}
        </div>
      </div>
    );
  }

  const { student, kpis, courses } = data;

  const tabs: TabDef[] = [
    {
      key: "courses",
      label: "Courses",
      count: courses.length,
      panel: (
        <section className={styles.section} aria-labelledby="student-courses">
          <h3 id="student-courses">Enrolled courses</h3>
          {courses.length === 0 ? (
            <p className={styles.muted}>No course enrolments.</p>
          ) : (
            <div className={catalogue.tableWrap}>
              <table className={catalogue.table}>
                <thead>
                  <tr>
                    <th scope="col">Course</th>
                    <th scope="col">Lessons</th>
                    <th scope="col">Completion</th>
                    <th scope="col">Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id}>
                      <td className={styles.name}>
                        <EntityLink
                          href={`/dashboard/courses/${c.id}`} permissions={[PERM.courses.view]}
                          style={{ color: "var(--color-text)" }}
                        >
                          {c.title}
                        </EntityLink>
                      </td>
                      <td>{c.lessons_done} / {c.lessons_total}</td>
                      <td>{c.completion_pct}%</td>
                      <td>{c.avg_score == null ? "—" : `${c.avg_score}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ),
    },
    {
      key: "performance",
      label: "Performance",
      panel: (
        <>
          {topics && topics.length > 0 && (
            <section className={styles.section} aria-labelledby="student-topics">
              <h3 id="student-topics">Topic strength</h3>
              <div className={catalogue.tableWrap}>
                <table className={catalogue.table}>
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col" className={styles.left}>Topic</th>
                      <th scope="col">Correct</th>
                      <th scope="col">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((t, i) => (
                      <tr key={`${t.subject}-${t.topic ?? i}`}>
                        <td>{t.subject}</td>
                        <td className={styles.left}>{t.topic ?? "—"}</td>
                        <td>{t.correct} / {t.total}</td>
                        <td>{t.accuracy_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className={styles.section} aria-labelledby="student-history">
            <h3 id="student-history">Quiz history</h3>
            {history && history.rows.length > 0 ? (
              <PerformanceHistoryTable rows={history.rows} />
            ) : (
              <p className={styles.muted}>No completed attempts yet.</p>
            )}
          </section>
        </>
      ),
    },
  ];
  if (has(PERM.tracker.view)) {
    tabs.push({ key: "tracker", label: "Tracker", panel: <TrackerSection studentId={id} /> });
  }

  return (
    <div className={styles.page}>
      <Header student={student} atRisk={kpis.at_risk} canViewContact={has(PERM.students.view_contact)} />

      <div className={styles.kpis}>
        <Kpi label="Completion" value={`${kpis.completion_pct}%`} />
        <Kpi label="Average score" value={kpis.avg_score == null ? "—" : `${kpis.avg_score}%`} />
        <Kpi label="Quiz attempts" value={String(kpis.attempts)} />
        <Kpi label="Last activity" value={formatDate(kpis.last_activity_at)} />
      </div>

      <div className={`${workspace.stickyTabs} ${styles.tabs}`}>
        <Tabs ariaLabel="Student profile" tabs={tabs} />
      </div>
    </div>
  );
}

function Header({
  student, atRisk, canViewContact,
}: { student: StudentProfile["student"]; atRisk: boolean; canViewContact: boolean }) {
  const facts = [
    student.programme,
    student.roll_number ? `Roll ${student.roll_number}` : null,
    student.status === "ACTIVE" ? null : student.status,
  ].filter(Boolean) as string[];

  return (
    <div className={styles.header}>
      <div className={styles.toolbar}>{backLink}</div>
      <div className={styles.identity}>
        <div className={styles.titleRow}>
          <h2>{student.name}</h2>
          {atRisk && (
            <span className={styles.risk}><AlertTriangle size={14} aria-hidden="true" />At risk</span>
          )}
        </div>

        <p className={styles.meta}>
          <span>
            <School size={14} aria-hidden="true" />
            {student.school_id ? (
              <EntityLink href={`/dashboard/schools/${student.school_id}`} permissions={[PERM.schools.view]} style={linkStyle}>
                {student.school_name ?? "School"}
              </EntityLink>
            ) : (
              student.school_name ?? "No school"
            )}
          </span>
          {facts.map((fact) => <span key={fact}>{fact}</span>)}
          {student.district && <span><MapPin size={14} aria-hidden="true" />{student.district}</span>}
          {canViewContact && student.email && <span><Mail size={14} aria-hidden="true" />{student.email}</span>}
        </p>

        {student.batches.length > 0 && (
          <p className={styles.meta}>
            <span>
              <Layers size={14} aria-hidden="true" />
              Batches:{" "}
              {student.batches.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ", "}
                  <EntityLink href={`/dashboard/batches/${b.id}`} permissions={[PERM.batches.view]} style={linkStyle}>
                    {b.name}
                  </EntityLink>
                </span>
              ))}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpi}>
      <p>{label}</p>
      <p>{value}</p>
    </div>
  );
}
