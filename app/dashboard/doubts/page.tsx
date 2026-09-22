"use client";

import { HeaderActions } from "@/components/dashboard/HeaderActions";
import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { submitDoubt, answerDoubt, deleteDoubt, type Doubt } from "@/lib/api";
import { useStaffDoubts } from "@/lib/queries/doubts";
import { useInvalidate } from "@/lib/mutations/invalidation";

export default function DoubtsPage() {
  return <Suspense fallback={<LoadingState />}><DoubtsPageContent /></Suspense>;
}

function DoubtsPageContent() {
  const programmeId = useSearchParams().get("programme_id");
  const { data, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const userId = data?.user?.id ?? "";

  const [showModal, setShowModal] = useState(false);

  // Deep-link target from the dashboard tasks/activity bar (?focus=<doubtId>).
  // Read from window to avoid the useSearchParams Suspense requirement.
  const [focusId, setFocusId] = useState<string | null>(null);
  // Which status the caller wants pre-selected (?status=OPEN|ANSWERED|ALL),
  // sent by the doubts stat cards elsewhere in the dashboard so the count you
  // clicked is the list you land on.
  const [statusParam, setStatusParam] = useState<StaffFilter | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const f = q.get("focus");
    if (f) setFocusId(f);
    const s = (q.get("status") ?? "").toUpperCase();
    if (s === "OPEN" || s === "ANSWERED" || s === "ALL") setStatusParam(s);
  }, []);

  // PBAC view gate:
  //   - canRespond OR canDelete => staff view (filters + per-doubt action buttons)
  //   - else => student view (own doubts + ask form)
  // STUDENT lacks both perms; PM/ZM/FELLOW/SUPER_ADMIN hold at least one.
  const canSubmit  = has(PERM.doubts.submit);
  const canRespond = has(PERM.doubts.respond);
  const canDelete  = has(PERM.doubts.delete);
  const isStaffViewer = canRespond || canDelete || has(PERM.students.view);

  // Single stable cache entry — `getDoubts` ignores its args and the backend
  // scopes the list by `req.auth`, so we never partition the cache by filters.
  const { data: doubtsData, isPending, isError, error: queryError } = useStaffDoubts({ programme_id: programmeId ?? undefined });
  const doubts = doubtsData ?? [];
  const loading = isPending;
  const error = isError ? (queryError instanceof Error ? queryError.message : "Failed to load doubts.") : null;

  // After any mutation (answer / delete / submit) invalidate the doubts cache so
  // the list refreshes immediately instead of waiting for the staleTime window.
  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['og', 'doubts'] });
  }, [queryClient]);

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
        focusId={focusId}
        statusParam={statusParam}
      />
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <BackLink fallback="/dashboard" style={backLinkStyle}><ArrowLeft size={18} aria-hidden="true" />Back</BackLink>
      {/* ── Header ─────────────────────────────────────────── */}
      {canSubmit && (
        <HeaderActions>
          <button
            type="button"
            style={primaryButton}
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} aria-hidden="true" />Ask a Question
          </button>
        </HeaderActions>
      )}

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
        <div style={glassCard}><p role="alert" style={{ ...titleStyle, color: "#b83232", margin: 0 }}>{error}</p></div>
      ) : doubts.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ ...titleStyle, margin: 0 }}>No Doubts Yet</p>
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

type StaffFilter = 'ALL' | 'OPEN' | 'ANSWERED';

function StaffDoubtsView({ doubts, loading, error, onReload, canRespond, canDelete, focusId, statusParam }: {
  doubts: Doubt[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  canRespond: boolean;
  canDelete: boolean;
  focusId: string | null;
  statusParam: StaffFilter | null;
}) {
  // When deep-linked to a specific doubt, show ALL so it isn't hidden by the
  // default OPEN filter (it may already be answered). An explicit ?status wins
  // over the default but not over a focused doubt, which would otherwise be
  // filtered out of the very list it asked to scroll to.
  const [filter, setFilter] = useState<StaffFilter>(focusId ? 'ALL' : (statusParam ?? 'OPEN'));

  // The params are read in an effect one tick after mount, so the initial state
  // above misses them on the first render. Adopt them when they arrive.
  useEffect(() => {
    if (focusId) { setFilter('ALL'); return; }
    if (statusParam) setFilter(statusParam);
  }, [focusId, statusParam]);
  const [answering, setAnswering] = useState<Doubt | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const invalidate = useInvalidate();

  // Scroll to and briefly highlight the focused doubt once the list has loaded.
  useEffect(() => {
    if (!focusId || loading) return;
    const el = document.getElementById(`doubt-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "box-shadow 300ms ease";
    el.style.boxShadow = "0 0 0 3px rgba(10,190,98,0.55)";
    const t = setTimeout(() => { el.style.boxShadow = "none"; }, 2200);
    return () => clearTimeout(t);
  }, [focusId, loading, doubts]);

  async function handleDelete(doubt: Doubt) {
    if (!confirm(`Delete this doubt from ${doubt.student_name ?? "this student"}? This cannot be undone.`)) return;
    setDeletingId(doubt.id);
    try {
      await deleteDoubt(doubt.id);
      invalidate('doubts');
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
      case 'ANSWERED':  return d.status === 'ANSWERED';
      default:          return true;
    }
  });

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <BackLink fallback="/dashboard" style={backLinkStyle}><ArrowLeft size={18} aria-hidden="true" />Back</BackLink>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        {(["ALL", "OPEN", "ANSWERED"] as StaffFilter[]).map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            style={{
              minHeight: 44, padding: "8px 14px", borderRadius: 12,
              border: filter === f ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border)",
              background: filter === f ? "var(--color-success-surface)" : "var(--color-surface)",
              color: filter === f ? "var(--dark-teal)" : "var(--color-text-muted)",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >{f.charAt(0) + f.slice(1).toLowerCase()}</button>
        ))}
      </div>

      {error && (
        <div role="alert" style={{ background: "rgba(184,50,50,0.06)", border: "1px solid rgba(184,50,50,0.2)", padding: 16, borderRadius: 12, marginBottom: 16 }}>
          <p style={{ color: "#b83232", fontSize: 14, margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading&hellip;</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No doubts match this filter.</p>
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

  // Age, stated directly, where the escalation tier used to be.
  //
  // The badge always meant "how neglected is this" — it just said so through
  // the ladder, because the ladder was the only thing that measured neglect.
  // With escalation gone the in-charge, their ZM and their PM all see a doubt
  // from the moment it is asked, so the colour reads off the age instead. The
  // old thresholds are kept: 3 days was when it used to reach a ZM, 6 a PM.
  const tier =
    doubt.status === "ANSWERED" ? { label: "Answered",             color: "#08784a",           bg: "var(--color-success-surface)" } :
    daysOpen >= 6               ? { label: `Open · ${daysOpen}d`,  color: "#b83232",           bg: "rgba(184,50,50,0.08)" } :
    daysOpen >= 3               ? { label: `Open · ${daysOpen}d`,  color: "#9a5a00",           bg: "rgba(217,119,6,0.1)" } :
                                  { label: `Open · ${daysOpen}d`,  color: "var(--color-text-muted)", bg: "#eef5f3" };

  return (
    <div id={`doubt-${doubt.id}`} style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 12, padding: "clamp(16px,4vw,24px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>
            {doubt.student_name ?? "—"}{doubt.school_name ? ` · ${doubt.school_name}` : " · no school"}
          </p>
          <h3 style={{ margin: "4px 0 6px", fontSize: 16, fontWeight: 600, color: "var(--color-text)" }}>
            {doubt.subject}
          </h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--color-text-muted)" }}>{doubt.body}</p>
          {doubt.answer && (
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--color-text)", borderLeft: "3px solid var(--green)", paddingLeft: 8 }}>
              {doubt.answer}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", background: tier.bg, color: tier.color }}>
            {tier.label}
          </span>
          {doubt.status === "OPEN" && onAnswer && (
            <button
              onClick={onAnswer}
              style={primaryButton}
            >Answer</button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                ...secondaryButton, color: "#b83232",
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
        style={{ position: "fixed", inset: 0, background: "rgb(3 20 30 / 35%)", zIndex: 50 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(560px, 92vw)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "clamp(16px,4vw,24px)", zIndex: 51,
      }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "var(--color-text)" }}>Answer doubt</h2>
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{doubt.subject}</p>
        {doubt.student_name && (
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>
            from {doubt.student_name}{doubt.school_name ? ` · ${doubt.school_name}` : ""}
          </p>
        )}
        <div style={{
          margin: "0 0 14px", padding: 12, borderRadius: 8,
          background: "#eef5f3", borderLeft: "3px solid var(--color-border-strong)",
          fontSize: 14, color: "var(--color-text)", whiteSpace: "pre-wrap",
        }}>
          {doubt.body}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Your answer…"
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
        {err && <p role="alert" style={{ color: "#b83232", fontSize: 14, marginTop: 8 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ ...secondaryButton, cursor: busy ? "default" : "pointer" }}
          >Cancel</button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            style={{ ...primaryButton, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
          >{busy ? "Sending…" : "Send answer"}</button>
        </div>
      </div>
    </>
  );
}

// ── Student View ───────────────────────────────────────────────

function StudentDoubtsList({ doubts }: { doubts: Doubt[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {doubts.map((d) => (
        <div key={d.id} style={{ ...glassCard, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: statusColor(d.status) }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", margin: 0, lineHeight: 1.4 }}>
              {d.subject}
            </h3>
            <StatusBadge status={d.status} />
          </div>
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0 }}>
            {d.body}
          </p>
          {d.status === "ANSWERED" && d.answer && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "var(--color-success-surface)", borderRadius: "8px", borderLeft: "3px solid var(--green)" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#08784a", margin: "0 0 6px" }}>Answer</p>
              <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                {d.answer}
              </p>
            </div>
          )}
          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "12px 0 0" }}>
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
  const invalidate = useInvalidate();

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
      invalidate('doubts');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit doubt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgb(3 20 30 / 35%)" }} onClick={onClose} />

      <div style={{ ...glassCard, position: "relative", width: "100%", maxWidth: "560px", textAlign: "left", animation: "floatIn 0.3s ease-out forwards" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ ...titleStyle, margin: 0 }}>Ask a Question</h2>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close"><X size={20} aria-hidden="true" /></button>
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
            <p role="alert" style={{ fontSize: "14px", color: "#b83232", fontWeight: 600, margin: 0 }}>{error}</p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={secondaryButton}
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
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: 600,
      whiteSpace: "nowrap",
      background: isAnswered ? "var(--color-success-surface)" : "rgba(255,222,0,0.18)",
      color: isAnswered ? "#08784a" : "#7a5a00",
    }}>
      {isAnswered ? "Answered" : status === "OPEN" ? "Open" : status}
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
        <p role="status" style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--color-text)" }}>Fetching doubts</p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Please wait&hellip;</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "var(--color-text)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--color-text-muted)",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "44px",
  padding: "8px 16px",
  borderRadius: "12px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const primaryButton: React.CSSProperties = {
  ...btnBase,
  border: "1px solid var(--green)",
  background: "var(--green)",
  color: "var(--dark-teal)",
};

const secondaryButton: React.CSSProperties = {
  ...btnBase,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const backLinkStyle: React.CSSProperties = {
  ...secondaryButton,
  textDecoration: "none",
};

const closeBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "44px",
  minHeight: "44px",
  background: "none",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  borderRadius: "8px",
};

const formLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "8px 12px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "8px",
  color: "var(--color-text)",
  fontSize: "14px",
  boxSizing: "border-box",
};
