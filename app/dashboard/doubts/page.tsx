"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDoubts, submitDoubt, type Doubt } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

const ALLOWED_ROLES: RoleCode[] = ["SUPER_ADMIN", "STUDENT"];

export default function DoubtsPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId = data?.user?.id ?? "";

  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const isAllowed = ALLOWED_ROLES.includes(roleCode);

  const fetchDoubts = useCallback(async () => {
    if (!roleCode || !isAllowed) return;
    setLoading(true);
    setError(null);
    try {
      const studentId = roleCode === "STUDENT" ? userId : undefined;
      setDoubts(await getDoubts(roleCode, studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load doubts.");
    } finally {
      setLoading(false);
    }
  }, [roleCode, userId, isAllowed]);

  useEffect(() => {
    if (!userLoading) void fetchDoubts();
  }, [userLoading, fetchDoubts]);

  if (userLoading) return <LoadingState />;

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={glassCard}>
          <p style={labelStyle}>Access Denied</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>You do not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <p style={labelStyle}>Support</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Doubts</h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>
            {roleCode === "STUDENT" ? "Ask questions and track your answers" : "All student questions"}
          </p>
        </div>
        {roleCode === "STUDENT" && (
          <button
            style={primaryButton}
            onClick={() => setShowModal(true)}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            + Ask a Question
          </button>
        )}
      </div>

      {/* ── Submit Modal ────────────────────────────────────── */}
      {showModal && userId && (
        <SubmitDoubtModal
          studentId={userId}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); void fetchDoubts(); }}
        />
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={glassCard}><p style={{ ...titleStyle, color: "#e53e3e" }}>{error}</p></div>
      ) : doubts.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ ...titleStyle, marginTop: "8px" }}>No Doubts Yet</p>
          <p style={{ ...subtitleStyle, marginTop: "8px" }}>
            {roleCode === "STUDENT" ? "Click “Ask a Question” to get started." : "No students have submitted doubts yet."}
          </p>
        </div>
      ) : roleCode === "SUPER_ADMIN" ? (
        <AdminDoubtsList doubts={doubts} />
      ) : (
        <StudentDoubtsList doubts={doubts} />
      )}
    </div>
  );
}

// ── Admin View ─────────────────────────────────────────────────

function AdminDoubtsList({ doubts }: { doubts: Doubt[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {doubts.map((d) => (
        <div key={d.id} style={{ ...glassCard, padding: "28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: statusColor(d.status) }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#209379", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                {d.student_name ?? "Unknown Student"}
              </p>
              <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "18px", fontWeight: 700, color: "#034852", margin: 0, lineHeight: 1.3 }}>
                {d.subject}
              </h3>
            </div>
            <StatusBadge status={d.status} />
          </div>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.75)", lineHeight: 1.6, margin: 0 }}>
            {d.body}
          </p>
          <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.4)", marginTop: "12px" }}>
            {new Date(d.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Student View ───────────────────────────────────────────────

function StudentDoubtsList({ doubts }: { doubts: Doubt[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {doubts.map((d) => (
        <div key={d.id} style={{ ...glassCard, padding: "28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: statusColor(d.status) }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "18px", fontWeight: 700, color: "#034852", margin: 0, lineHeight: 1.3 }}>
              {d.subject}
            </h3>
            <StatusBadge status={d.status} />
          </div>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.75)", lineHeight: 1.6, margin: 0 }}>
            {d.body}
          </p>
          {d.status === "ANSWERED" && d.answer && (
            <div style={{ marginTop: "20px", padding: "16px 20px", background: "rgba(10,190,98,0.06)", borderRadius: "12px", borderLeft: "3px solid #0abe62" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0abe62", marginBottom: "6px" }}>Answer</p>
              <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.85)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                {d.answer}
              </p>
            </div>
          )}
          <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.4)", marginTop: "12px" }}>
            {new Date(d.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Submit Modal ───────────────────────────────────────────────

function SubmitDoubtModal({
  studentId,
  onClose,
  onCreated,
}: {
  studentId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitDoubt({
        student_id: studentId,
        subject: subject.trim(),
        body: body.trim(),
        role: "STUDENT",
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit doubt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,72,82,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose} />

      <div style={{ ...glassCard, position: "relative", width: "100%", maxWidth: "560px", textAlign: "left", animation: "floatIn 0.3s ease-out forwards" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <p style={labelStyle}>Ask a Question</p>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={formLabelStyle}>Subject *</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={inputStyle}
              placeholder="e.g. Explain the concept of recursion"
            />
          </div>

          <div>
            <label style={formLabelStyle}>Question *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Describe your doubt in detail…"
            />
          </div>

          {error && (
            <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>{error}</p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "10px 20px", background: "none", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "10px", color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !subject.trim() || !body.trim()}
              style={{ ...primaryButton, opacity: submitting || !subject.trim() || !body.trim() ? 0.6 : 1 }}
            >
              {submitting ? "Submitting…" : "Submit Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isAnswered = status === "ANSWERED";
  return (
    <span style={{
      padding: "4px 12px",
      borderRadius: "100px",
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.06em",
      whiteSpace: "nowrap",
      background: isAnswered ? "rgba(10,190,98,0.12)" : "rgba(255,222,0,0.18)",
      color: isAnswered ? "#0a944e" : "#7a6600",
      border: isAnswered ? "1px solid rgba(10,190,98,0.25)" : "1px solid rgba(255,222,0,0.4)",
    }}>
      {status}
    </span>
  );
}

function statusColor(status: string) {
  return status === "ANSWERED" ? "#0abe62" : "#ffde00";
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>Fetching doubts</p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Please wait&hellip;</p>
      </div>
    </div>
  );
}

// ── Interaction ────────────────────────────────────────────────

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 12px 20px rgba(10,190,98,0.3)";
}

function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 8px 16px rgba(10,190,98,0.2)";
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "24px",
  padding: "32px",
  boxShadow: "0 16px 40px rgba(0,0,0,0.06)",
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
  padding: "10px 20px",
  border: "none",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "18px",
  color: "rgba(3,72,82,0.5)",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: "8px",
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: "12px",
  color: "#034852",
  fontFamily: "var(--font-body)",
  fontSize: "14px",
  outline: "none",
};
