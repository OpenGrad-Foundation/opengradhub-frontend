"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { getDoubts, submitDoubt, answerDoubt, deleteDoubt, type Doubt } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

export default function DoubtsPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId = data?.user?.id ?? "";

  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // PBAC view gate:
  //   - canRespond OR canDelete => staff view (filters + per-doubt action buttons)
  //   - else => student view (own doubts + ask form)
  // STUDENT lacks both perms; PM/ZM/FELLOW/SUPER_ADMIN hold at least one.
  const canSubmit  = has(PERM.doubts.submit);
  const canRespond = has(PERM.doubts.respond);
  const canDelete  = has(PERM.doubts.delete);
  const isStaffViewer = canRespond || canDelete;

  const reload = useCallback(async () => {
    if (!roleCode) return;
    setLoading(true);
    setError(null);
    try {
      const studentId = canSubmit ? userId : undefined;
      setDoubts(await getDoubts(roleCode, studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load doubts.");
    } finally {
      setLoading(false);
    }
  }, [roleCode, userId, canSubmit]);

  useEffect(() => {
    if (!userLoading) void reload();
  }, [userLoading, reload]);

  if (userLoading) return <LoadingState />;

  if (isStaffViewer) {
    return (
      <StaffDoubtsView
        doubts={doubts}
        loading={loading}
        error={error}
        onReload={reload}
        canRespond={canRespond}
        canDelete={canDelete}
      />
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <p style={labelStyle}>Support</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Doubts</h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>Ask questions and track your answers</p>
        </div>
        {canSubmit && (
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
          onCreated={() => { setShowModal(false); void reload(); }}
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
            Click &ldquo;Ask a Question&rdquo; to get started.
          </p>
        </div>
      ) : (
        <StudentDoubtsList doubts={doubts} />
      )}
    </div>
  );
}

// ── Staff View ─────────────────────────────────────────────────

type StaffFilter = 'ALL' | 'OPEN' | 'ESCALATED' | 'ANSWERED' | 'ORPHAN';

function StaffDoubtsView({ doubts, loading, error, onReload, canRespond, canDelete }: {
  doubts: Doubt[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  canRespond: boolean;
  canDelete: boolean;
}) {
  const [filter, setFilter] = useState<StaffFilter>('OPEN');
  const [answering, setAnswering] = useState<Doubt | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(doubt: Doubt) {
    if (!confirm(`Delete this doubt from ${doubt.student_name ?? "this student"}? This cannot be undone.`)) return;
    setDeletingId(doubt.id);
    try {
      await deleteDoubt(doubt.id);
      onReload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete doubt.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = doubts.filter((d) => {
    switch (filter) {
      case 'OPEN':      return d.status === 'OPEN';
      case 'ESCALATED': return d.status === 'OPEN' && (d.escalated_to_zm_at || d.escalated_to_pm_at);
      case 'ANSWERED':  return d.status === 'ANSWERED';
      case 'ORPHAN':    return d.school_name == null;
      default:          return true;
    }
  });

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>Support</p>
        <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Doubts</h1>
        <p style={{ ...subtitleStyle, marginTop: "4px" }}>
          Doubts from students in your scope.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(["ALL", "OPEN", "ESCALATED", "ANSWERED", "ORPHAN"] as StaffFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 14px", borderRadius: 8,
              border: filter === f ? "1px solid #0abe62" : "1px solid rgba(3,72,82,0.15)",
              background: filter === f ? "rgba(10,190,98,0.1)" : "#fff",
              color: filter === f ? "#0abe62" : "#034852",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >{f.charAt(0) + f.slice(1).toLowerCase()}</button>
        ))}
      </div>

      {error && (
        <div style={{ background: "rgba(229,62,62,0.07)", padding: 16, borderRadius: 12, marginBottom: 16 }}>
          <p style={{ color: "#c53030", fontSize: 14, margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: "rgba(3,72,82,0.5)" }}>Loading&hellip;</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "rgba(3,72,82,0.5)" }}>No doubts match this filter.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((d) => (
            <StaffDoubtCard
              key={d.id}
              doubt={d}
              onAnswer={canRespond ? () => setAnswering(d) : null}
              onDelete={canDelete ? () => handleDelete(d) : null}
              deleting={deletingId === d.id}
            />
          ))}
        </div>
      )}

      {answering && (
        <AnswerModal
          doubt={answering}
          onClose={() => setAnswering(null)}
          onAnswered={() => { setAnswering(null); onReload(); }}
        />
      )}
    </div>
  );
}

function StaffDoubtCard({ doubt, onAnswer, onDelete, deleting }: {
  doubt: Doubt;
  onAnswer: (() => void) | null;
  onDelete: (() => void) | null;
  deleting: boolean;
}) {
  const daysOpen = Math.floor((Date.now() - new Date(doubt.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const tier =
    doubt.status === "ANSWERED"    ? { label: "Answered",         color: "#0abe62", bg: "rgba(10,190,98,0.1)" } :
    doubt.escalated_to_pm_at       ? { label: "Escalated to PM",  color: "#c53030", bg: "rgba(229,62,62,0.1)" } :
    doubt.escalated_to_zm_at       ? { label: "Escalated to ZM",  color: "#d97706", bg: "rgba(217,119,6,0.1)" } :
                                     { label: `Open · ${daysOpen}d`, color: "rgba(3,72,82,0.6)", bg: "rgba(3,72,82,0.06)" };

  return (
    <div style={{
      background: "rgba(255,255,255,0.75)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 14, padding: "16px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "#209379" }}>
            {doubt.student_name ?? "—"}{doubt.school_name ? ` · ${doubt.school_name}` : " · (orphan)"}
          </p>
          <h3 style={{ margin: "3px 0 6px", fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#034852" }}>
            {doubt.subject}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(3,72,82,0.7)" }}>{doubt.body}</p>
          {doubt.answer && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#0abe62", borderLeft: "3px solid #0abe62", paddingLeft: 8 }}>
              {doubt.answer}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: tier.bg, color: tier.color }}>
            {tier.label}
          </span>
          {doubt.status === "OPEN" && onAnswer && (
            <button
              onClick={onAnswer}
              style={{
                padding: "6px 14px", border: "none", borderRadius: 8,
                background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
                color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >Answer</button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                padding: "6px 14px", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 8,
                background: "#fff", color: "#c53030",
                fontWeight: 700, fontSize: 12,
                cursor: deleting ? "default" : "pointer",
                opacity: deleting ? 0.6 : 1,
              }}
            >{deleting ? "Deleting…" : "Delete"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function AnswerModal({ doubt, onClose, onAnswered }: {
  doubt: Doubt;
  onClose: () => void;
  onAnswered: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) { setErr("Answer required."); return; }
    setBusy(true); setErr(null);
    try {
      await answerDoubt(doubt.id, text.trim());
      onAnswered();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.4)", backdropFilter: "blur(4px)", zIndex: 50 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(560px, 92vw)", background: "#fff", borderRadius: 14, padding: 24, zIndex: 51,
        boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
      }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "#034852" }}>Answer doubt</h2>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#034852" }}>{doubt.subject}</p>
        {doubt.student_name && (
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "rgba(3,72,82,0.5)" }}>
            from {doubt.student_name}{doubt.school_name ? ` · ${doubt.school_name}` : ""}
          </p>
        )}
        <div style={{
          margin: "0 0 14px", padding: 12, borderRadius: 8,
          background: "rgba(3,72,82,0.04)", borderLeft: "3px solid rgba(3,72,82,0.2)",
          fontSize: 13, color: "#034852", whiteSpace: "pre-wrap",
        }}>
          {doubt.body}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Your answer…"
          style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(3,72,82,0.15)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
        />
        {err && <p style={{ color: "#c53030", fontSize: 13, marginTop: 8 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ padding: "8px 14px", border: "1px solid rgba(3,72,82,0.15)", borderRadius: 8, background: "#fff", cursor: busy ? "default" : "pointer" }}
          >Cancel</button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontWeight: 700, cursor: busy ? "default" : "pointer" }}
          >{busy ? "Sending…" : "Send answer"}</button>
        </div>
      </div>
    </>
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
  background: "#ffffff",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "24px",
  padding: "32px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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
