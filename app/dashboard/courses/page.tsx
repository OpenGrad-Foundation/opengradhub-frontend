"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getCourses, createCourse, type Course } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

// ── Role guards ────────────────────────────────────────────────

const COURSES_ALLOWED_ROLES: RoleCode[] = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "STUDENT",
];

const COURSE_CREATE_ROLES: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

// ── Page ───────────────────────────────────────────────────────

export default function CoursesPage() {
  const { data, isLoading: userLoading } = useCurrentUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const roleCode = (data?.role?.code ?? "STUDENT") as RoleCode;
  const programmeType = data?.user?.programme ?? null;
  const isAllowed = COURSES_ALLOWED_ROLES.includes(roleCode);
  const canCreate = COURSE_CREATE_ROLES.includes(roleCode);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Students only see courses matching their programme type
      const filter =
        roleCode === "STUDENT" && programmeType ? programmeType : undefined;
      const data = await getCourses(filter);
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, [roleCode, programmeType]);

  useEffect(() => {
    if (!userLoading && isAllowed) {
      void fetchCourses();
    }
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
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>
            Courses
          </h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>
            {roleCode === "STUDENT"
              ? `Showing ${programmeType ?? "all"} courses`
              : "All active courses across programmes"}
          </p>
        </div>

        {canCreate && (
          <button
            id="new-course-btn"
            onClick={() => setShowForm((prev) => !prev)}
            style={primaryButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 12px 20px rgba(10,190,98,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 8px 16px rgba(10,190,98,0.2)";
            }}
          >
            {showForm ? "✕ Cancel" : "+ New Course"}
          </button>
        )}
      </div>

      {/* ── Create form ─────────────────────────────────────── */}
      {showForm && data && (
        <CreateCourseForm
          userId={data.user.id}
          roleCode={roleCode}
          onCreated={() => {
            setShowForm(false);
            void fetchCourses();
          }}
        />
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={glassCard}>
          <p style={labelStyle}>Error</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>{error}</p>
        </div>
      ) : courses.length === 0 ? (
        <div style={glassCard}>
          <p style={labelStyle}>No Courses</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>
            No courses available yet.
          </p>
          <p style={{ ...subtitleStyle, marginTop: "8px" }}>
            {canCreate
              ? 'Click "New Course" to create one.'
              : "Check back soon — new courses are being added."}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "24px",
          }}
        >
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

// ── Course Card ────────────────────────────────────────────────

function CourseCard({ course }: { course: Course }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      id={`course-card-${course.id}`}
      style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: hovered
          ? "1px solid rgba(10,190,98,0.4)"
          : "1px solid rgba(255,255,255,0.4)",
        borderRadius: "24px",
        boxShadow: hovered
          ? "0 16px 48px rgba(10,190,98,0.12)"
          : "0 8px 32px rgba(0,0,0,0.07)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover image */}
      <div
        style={{
          height: "160px",
          background: course.cover_image_url
            ? `url(${course.cover_image_url}) center/cover`
            : "linear-gradient(135deg, #006d6c 0%, #034852 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {!course.cover_image_url && (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        )}

        {/* Locking mode badge */}
        <span
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            padding: "4px 10px",
            borderRadius: "100px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            background:
              course.locking_mode === "SEQUENTIAL"
                ? "rgba(255,222,0,0.9)"
                : "rgba(10,190,98,0.9)",
            color:
              course.locking_mode === "SEQUENTIAL" ? "#034852" : "#ffffff",
          }}
        >
          {course.locking_mode}
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: "20px 24px 24px" }}>
        {/* Programme badge */}
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: "100px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            background: "rgba(32,147,121,0.12)",
            color: "#209379",
            marginBottom: "10px",
          }}
        >
          {course.programme_type}
        </span>

        {/* Access type badge */}
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: "100px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            background:
              course.access_type === "PAID"
                ? "rgba(255,222,0,0.15)"
                : "rgba(10,190,98,0.08)",
            color: course.access_type === "PAID" ? "#b38f00" : "#0abe62",
            marginBottom: "10px",
            marginLeft: "6px",
          }}
        >
          {course.access_type}
        </span>

        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "17px",
            fontWeight: 700,
            color: "#034852",
            margin: "0 0 8px",
            lineHeight: 1.3,
          }}
        >
          {course.title}
        </h3>

        {course.description && (
          <p
            style={{
              fontSize: "13px",
              color: "rgba(3,72,82,0.6)",
              lineHeight: 1.6,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {course.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Create Course Form ─────────────────────────────────────────

function CreateCourseForm({
  userId,
  roleCode,
  onCreated,
}: {
  userId: string;
  roleCode: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [programmeType, setProgrammeType] = useState("UG");
  const [lockingMode, setLockingMode] = useState("OPEN");
  const [accessType, setAccessType] = useState("FREE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
        programme_type: programmeType,
        locking_mode: lockingMode,
        access_type: accessType,
        created_by: userId,
        role: roleCode,
      });
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create course."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        ...glassCard,
        marginBottom: "28px",
        animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        opacity: 0,
        transform: "translateY(12px)",
      }}
    >
      <p style={labelStyle}>Create New Course</p>

      <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
        <div style={{ display: "grid", gap: "16px" }}>
          {/* Title */}
          <div>
            <label style={formLabelStyle}>Title *</label>
            <input
              id="course-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Data Science"
              required
              style={formInputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={formLabelStyle}>Description</label>
            <textarea
              id="course-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief course description..."
              rows={3}
              style={{ ...formInputStyle, resize: "vertical" as const }}
            />
          </div>

          {/* Row: Programme / Locking / Access */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label style={formLabelStyle}>Programme</label>
              <select
                id="course-programme-select"
                value={programmeType}
                onChange={(e) => setProgrammeType(e.target.value)}
                style={formInputStyle}
              >
                <option value="UG">UG</option>
                <option value="PG">PG</option>
                <option value="SCHOOL">School</option>
              </select>
            </div>

            <div>
              <label style={formLabelStyle}>Locking Mode</label>
              <select
                id="course-locking-select"
                value={lockingMode}
                onChange={(e) => setLockingMode(e.target.value)}
                style={formInputStyle}
              >
                <option value="OPEN">Open</option>
                <option value="SEQUENTIAL">Sequential</option>
              </select>
            </div>

            <div>
              <label style={formLabelStyle}>Access</label>
              <select
                id="course-access-select"
                value={accessType}
                onChange={(e) => setAccessType(e.target.value)}
                style={formInputStyle}
              >
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <p
            style={{
              marginTop: "12px",
              fontSize: "13px",
              color: "#e53e3e",
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}

        <button
          id="course-submit-btn"
          type="submit"
          disabled={submitting || !title.trim()}
          style={{
            ...primaryButton,
            marginTop: "20px",
            opacity: submitting || !title.trim() ? 0.6 : 1,
            cursor: submitting || !title.trim() ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Creating…" : "Create Course"}
        </button>
      </form>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function LoadingState() {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={glassCard}>
        <p style={labelStyle}>Loading</p>
        <p
          style={{
            marginTop: "12px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#034852",
          }}
        >
          Fetching courses
        </p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>
          Loading your course catalogue&hellip;
        </p>
      </div>
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "24px",
  padding: "40px 48px",
  textAlign: "center",
  boxShadow: "0 32px 64px rgba(0,0,0,0.1)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: "#209379",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "22px",
  fontWeight: 700,
  color: "#034852",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
};

const primaryButton: React.CSSProperties = {
  padding: "12px 24px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
  whiteSpace: "nowrap",
};

const formLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "rgba(3,72,82,0.7)",
  marginBottom: "6px",
};

const formInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: "12px",
  color: "#034852",
  fontFamily: "var(--font-body)",
  fontSize: "14px",
  outline: "none",
  transition: "border-color 200ms, box-shadow 200ms",
};
