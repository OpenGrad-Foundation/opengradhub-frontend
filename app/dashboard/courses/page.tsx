"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getCourses, getStudentCourses, type Course, type StudentCourse } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

// ── Role guards ────────────────────────────────────────────────

const COURSES_ALLOWED_ROLES: RoleCode[] = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "STUDENT",
];

const COURSE_CREATE_ROLES: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];
const COURSE_MANAGE_ROLES: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

// ── Page ───────────────────────────────────────────────────────

export default function CoursesPage() {
  const { data, isLoading: userLoading } = useCurrentUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleCode = (data?.role?.code ?? "STUDENT") as RoleCode;
  const userId = data?.user?.id ?? null;
  const programmeType = data?.user?.programme ?? null;
  const isAllowed = COURSES_ALLOWED_ROLES.includes(roleCode);
  const canCreate = COURSE_CREATE_ROLES.includes(roleCode);
  const canManage = COURSE_MANAGE_ROLES.includes(roleCode);

  const fetchCourses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      if (roleCode === "STUDENT") {
        setStudentCourses(await getStudentCourses(userId));
      } else if (roleCode === "PROGRAM_MANAGER") {
        // PM sees their own courses (all statuses)
        setCourses(await getCourses(undefined, undefined, userId));
      } else if (roleCode === "SUPER_ADMIN") {
        // SA sees all courses (all statuses)
        setCourses(await getCourses(undefined, undefined, undefined, true));
      } else {
        // ZONAL_MANAGER and others: active courses only
        setCourses(await getCourses());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, [roleCode, userId, programmeType]);

  useEffect(() => {
    if (!userLoading && isAllowed) void fetchCourses();
  }, [userLoading, isAllowed, fetchCourses]);

  // ── Role guard ─────────────────────────────────────────────

  if (userLoading) {
    return <PageShell><LoadingState /></PageShell>;
  }

  if (!isAllowed) {
    return (
      <PageShell>
        <div style={glassCard}>
          <p style={labelStyle}>Access Denied</p>
          <p style={{ ...titleStyle, marginTop: "12px" }}>
            You do not have access to the Courses module.
          </p>
          <p style={{ ...subtitleStyle, marginTop: "8px" }}>
            Contact your administrator if you believe this is an error.
          </p>
        </div>
      </PageShell>
    );
  }

  const subtitle =
    roleCode === "STUDENT"
      ? "Your enrolled courses"
      : roleCode === "PROGRAM_MANAGER"
      ? "Courses you have created"
      : "All courses across programmes";

  return (
    <PageShell>
      {/* ── Header ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
        }}
      >
        <div>
          <p style={labelStyle}>Learning</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Courses</h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>{subtitle}</p>
        </div>

        {canCreate && (
          <Link id="new-course-btn" href="/dashboard/courses/new" style={primaryButton}>
            + New Course
          </Link>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={glassCard}>
          <p style={labelStyle}>Error</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>{error}</p>
        </div>
      ) : roleCode === "STUDENT" && studentCourses.length === 0 ? (
        <div style={glassCard}>
          <p style={labelStyle}>No Courses</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>No courses assigned yet.</p>
          <p style={{ ...subtitleStyle, marginTop: "8px" }}>
            Your administrator will enrol you in courses when they are ready.
          </p>
        </div>
      ) : roleCode !== "STUDENT" && courses.length === 0 ? (
        <div style={glassCard}>
          <p style={labelStyle}>No Courses</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>No courses found.</p>
          <p style={{ ...subtitleStyle, marginTop: "8px" }}>
            {canCreate ? 'Click "New Course" to create one.' : "Check back soon."}
          </p>
        </div>
      ) : roleCode === "STUDENT" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
          {studentCourses.map((course) => (
            <StudentCourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} canManage={canManage} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

// ── Course Card ────────────────────────────────────────────────

function CourseCard({ course, canManage }: { course: Course; canManage: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      id={`course-card-${course.id}`}
      style={{
        background: "#ffffff",
        border: hovered
          ? "1px solid rgba(10,190,98,0.4)"
          : "1px solid rgba(255,255,255,0.4)",
        borderRadius: "24px",
        boxShadow: hovered
          ? "0 16px 48px rgba(10,190,98,0.12)"
          : "0 2px 8px rgba(0,0,0,0.05)",
        overflow: "hidden",
        transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover image */}
      <div
        style={{
          height: "148px",
          background: course.cover_image_url
            ? `url(${course.cover_image_url}) center/cover`
            : "linear-gradient(135deg, #006d6c 0%, #034852 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {!course.cover_image_url && (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        )}

        {/* Status badge (top-left) */}
        <span style={{
          position: "absolute", top: "12px", left: "12px",
          padding: "4px 10px", borderRadius: "100px",
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
          ...statusBadgeStyle(course.status),
        }}>
          {course.status}
        </span>

        {/* Locking mode badge (top-right) */}
        <span style={{
          position: "absolute", top: "12px", right: "12px",
          padding: "4px 10px", borderRadius: "100px",
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
          background: course.locking_mode === "SEQUENTIAL"
            ? "rgba(255,222,0,0.9)" : "rgba(10,190,98,0.9)",
          color: course.locking_mode === "SEQUENTIAL" ? "#034852" : "#ffffff",
        }}>
          {course.locking_mode}
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: "18px 22px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Programme + access badges */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
          <span style={{
            display: "inline-block", padding: "3px 10px", borderRadius: "100px",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
            background: "rgba(32,147,121,0.12)", color: "#209379",
          }}>
            {course.programme_type}
          </span>
          <span style={{
            display: "inline-block", padding: "3px 10px", borderRadius: "100px",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
            background: course.access_type === "PAID"
              ? "rgba(255,222,0,0.15)" : "rgba(10,190,98,0.08)",
            color: course.access_type === "PAID" ? "#b38f00" : "#0abe62",
          }}>
            {course.access_type}
          </span>
        </div>

        <h3 style={{
          fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700,
          color: "#034852", margin: "0 0 6px", lineHeight: 1.3,
        }}>
          {course.title}
        </h3>

        {course.description && (
          <p style={{
            fontSize: "13px", color: "rgba(3,72,82,0.6)", lineHeight: 1.6,
            margin: "0 0 12px",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {course.description}
          </p>
        )}

        {/* Lesson count */}
        <p style={{
          fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: "auto 0 0",
          paddingTop: "8px",
        }}>
          {course.lesson_count} lesson{course.lesson_count !== 1 ? "s" : ""}
        </p>

        {/* Manager actions */}
        {canManage && (
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <Link
              href={`/dashboard/courses/${course.id}/edit`}
              style={outlineButton}
              onClick={(e) => e.stopPropagation()}
            >
              Edit
            </Link>
            <Link
              href={`/dashboard/courses/${course.id}/builder`}
              style={outlineButtonGreen}
              onClick={(e) => e.stopPropagation()}
            >
              Builder
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "ACTIVE":
      return { background: "rgba(10,190,98,0.85)", color: "#ffffff" };
    case "ARCHIVED":
      return { background: "rgba(100,100,100,0.7)", color: "#ffffff" };
    default: // DRAFT
      return { background: "rgba(255,222,0,0.9)", color: "#034852" };
  }
}

// ── Student Course Card (with progress bar) ────────────────────

function StudentCourseCard({ course }: { course: StudentCourse }) {
  const [hovered, setHovered] = useState(false);
  const pct = course.completion_percent;

  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "#ffffff",
          border: hovered ? "1px solid rgba(10,190,98,0.4)" : "1px solid rgba(255,255,255,0.4)",
          borderRadius: "24px",
          boxShadow: hovered ? "0 16px 48px rgba(10,190,98,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
          overflow: "hidden",
          transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Cover */}
        <div style={{
          height: "140px",
          background: course.cover_image_url
            ? `url(${course.cover_image_url}) center/cover`
            : "linear-gradient(135deg, #006d6c 0%, #034852 100%)",
          position: "relative",
          flexShrink: 0,
        }}>
          {/* Completion badge */}
          <span style={{
            position: "absolute", top: "12px", right: "12px",
            padding: "4px 10px", borderRadius: "100px",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
            background: pct === 100 ? "rgba(10,190,98,0.9)" : "rgba(3,72,82,0.75)",
            color: "#fff",
          }}>
            {pct === 100 ? "✓ Complete" : `${pct}%`}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{
            display: "inline-block", padding: "3px 9px", borderRadius: "100px",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
            background: "rgba(32,147,121,0.12)", color: "#209379",
            marginBottom: "8px", alignSelf: "flex-start",
          }}>
            {course.programme_type}
          </span>

          <h3 style={{
            fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700,
            color: "#034852", margin: "0 0 10px", lineHeight: 1.3,
          }}>
            {course.title}
          </h3>

          {/* Progress bar */}
          <div style={{ marginTop: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)", fontWeight: 600 }}>
                {course.completed_lessons} / {course.total_lessons} lessons
              </span>
              <span style={{ fontSize: "11px", color: pct === 100 ? "#0abe62" : "rgba(3,72,82,0.55)", fontWeight: 700 }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: "rgba(3,72,82,0.1)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: "3px",
                background: pct === 100
                  ? "#0abe62"
                  : "linear-gradient(90deg, #0abe62 0%, #209379 100%)",
                transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
              }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={glassCard}>
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
          Fetching courses
        </p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Loading your course catalogue&hellip;</p>
      </div>
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "24px",
  padding: "40px 48px",
  textAlign: "center",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px", color: "rgba(3,72,82,0.6)",
};

const primaryButton: React.CSSProperties = {
  padding: "12px 24px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "14px", cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
  whiteSpace: "nowrap", textDecoration: "none", display: "inline-block",
};

const outlineButton: React.CSSProperties = {
  flex: 1, padding: "8px 0", textAlign: "center",
  border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "10px",
  background: "transparent", color: "#034852",
  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "12px",
  cursor: "pointer", textDecoration: "none",
  transition: "all 180ms ease",
};

const outlineButtonGreen: React.CSSProperties = {
  ...outlineButton,
  border: "1.5px solid rgba(10,190,98,0.4)",
  color: "#0abe62",
};
