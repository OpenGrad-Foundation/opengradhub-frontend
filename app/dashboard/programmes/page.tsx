"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useProgrammes } from "@/lib/queries/programmes";
import { useCreateProgramme } from "@/lib/mutations/programmes";
import { ApiError } from "@/lib/api";
import {
  cardStyle, errorStyle, formLabelStyle, inputStyle, labelStyle, levelBadge,
  noticeStyle, primaryButton, secondaryButton, tdStyle, thStyle, titleStyle,
} from "./styles";

/** Slug a display name into the A-Z0-9_ shape the API requires. */
function suggestCode(name: string, state: string): string {
  return [name, state]
    .filter(Boolean)
    .join("_")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Row-level navigation that does not cost the anchor's behaviour.
 *
 * The name stays a real `<Link>`, so keyboard tabbing, cmd/middle-click into a
 * new tab, "copy link address" and screen-reader link semantics all keep
 * working — a `<tr onClick>` alone silently removes every one of those. This
 * only adds the convenience click, and stands aside whenever the browser is
 * already doing something better:
 *
 *   - a modifier or non-left button  -> the anchor's own new-tab handling
 *   - a click on any interactive child -> that control's job, not ours
 *   - a click that ends a text selection -> the user was selecting, not navigating
 *
 * No tabIndex/role on the row: that would add a second tab stop announcing the
 * same destination the name link already announces.
 */
function useRowNavigation() {
  const router = useRouter();
  return (href: string) => ({
    onClick: (e: MouseEvent<HTMLTableRowElement>) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
      if (window.getSelection()?.toString()) return;
      router.push(href);
    },
  });
}

export default function ProgrammesPage() {
  const { has } = usePermissions();
  const canEdit = has(PERM.programmes.edit);
  const rowNav = useRowNavigation();
  const [hovered, setHovered] = useState<string | null>(null);

  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const { data: programmes = [], isLoading, error } = useProgrammes(includeArchived);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={labelStyle}>Organisation</div>
          <h1 style={titleStyle}>Programmes</h1>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(3,72,82,0.75)" }}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show archived
          </label>
          {canEdit && (
            <button style={primaryButton} onClick={() => setShowCreate(true)}>
              New programme
            </button>
          )}
        </div>
      </div>

      {/*
        This notice used to say membership granted nothing. That stopped being
        true when the content-edit resolver shipped, and a banner that
        understates a grant is worse than none: someone adds a fellow to
        "UG Kerala" believing it is bookkeeping. State exactly what it does and
        does not hand over. (programmes-wiring.spec.ts fails if the old wording
        comes back.)
      */}
      <div style={noticeStyle}>
        <strong>What membership grants.</strong> OWNERs and EDITORs can edit the courses and
        assignments a programme owns; VIEWERs cannot. Owning content is not always enough to
        edit it: if another programme&apos;s batch or students also use it, it stays read-only
        for everyone but its creator. Membership never grants student data — rosters,
        progress, attempts and scores stay with the school and batch hierarchy. It also never
        grants a permission the member&apos;s role lacks.
      </div>

      {error && (
        <div style={errorStyle}>
          {error instanceof ApiError ? error.message : "Failed to load programmes."}
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(3,72,82,0.03)" }}>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Kind</th>
              <th style={thStyle}>State</th>
              <th style={thStyle}>Your level</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td style={tdStyle} colSpan={6}>Loading…</td></tr>
            )}
            {!isLoading && programmes.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, color: "rgba(3,72,82,0.55)" }} colSpan={6}>
                  No programmes yet.{canEdit ? " Create one to get started." : ""}
                </td>
              </tr>
            )}
            {programmes.map((p) => (
              <tr
                key={p.id}
                {...rowNav(`/dashboard/programmes/${p.id}`)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))}
                style={{
                  borderTop: "1px solid rgba(3,72,82,0.06)",
                  cursor: "pointer",
                  background: hovered === p.id ? "rgba(10,190,98,0.05)" : undefined,
                  transition: "background 120ms",
                }}
              >
                <td style={tdStyle}>
                  <Link href={`/dashboard/programmes/${p.id}`} style={{ color: "#0abe62", fontWeight: 700, textDecoration: "none" }}>
                    {p.name}
                  </Link>
                  {p.cohort_label && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "rgba(3,72,82,0.5)" }}>
                      {p.cohort_label}
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{p.code}</td>
                <td style={tdStyle}>{p.kind}</td>
                <td style={tdStyle}>{p.state ?? "—"}</td>
                <td style={tdStyle}>
                  {p.my_level
                    ? <span style={levelBadge(p.my_level)}>{p.my_level}</span>
                    : <span style={{ color: "rgba(3,72,82,0.4)" }}>not a member</span>}
                </td>
                <td style={tdStyle}>
                  {p.status === "ARCHIVED"
                    ? <span style={{ color: "rgba(3,72,82,0.45)" }}>Archived</span>
                    : <span style={{ color: "#067a45", fontWeight: 600 }}>Active</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateProgrammeModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateProgrammeModal({ onClose }: { onClose: () => void }) {
  const create = useCreateProgramme();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("UG");
  const [state, setState] = useState("");
  const [code, setCode] = useState("");
  const [cohort, setCohort] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const effectiveCode = code.trim() || suggestCode(name, state);

  async function submit() {
    setErr(null);
    try {
      await create.mutateAsync({
        code: effectiveCode,
        name: name.trim(),
        kind: kind.trim(),
        state: state.trim() || undefined,
        cohort_label: cohort.trim() || undefined,
      });
      onClose();
    } catch (e) {
      // Surface the server's words: it distinguishes a duplicate code (409)
      // from a malformed one (400), and the fix differs.
      setErr(e instanceof ApiError ? e.message : "Failed to create programme.");
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 20, padding: 28, width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={titleStyle}>New programme</h2>
        <p style={{ fontSize: 13, color: "rgba(3,72,82,0.65)", margin: 0, lineHeight: 1.6 }}>
          A programme is a track in a place — “UG Kerala”, “CAT Kerala”. You become its
          first OWNER.
        </p>

        <div>
          <label style={formLabelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="UG Kerala" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={formLabelStyle}>Kind</label>
            <input style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)} placeholder="UG" />
          </div>
          <div>
            <label style={formLabelStyle}>State</label>
            <input style={inputStyle} value={state} onChange={(e) => setState(e.target.value)} placeholder="KERALA" />
          </div>
        </div>

        <div>
          <label style={formLabelStyle}>Code</label>
          <input
            style={{ ...inputStyle, fontFamily: "monospace" }}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={effectiveCode || "UG_KERALA"}
          />
          <div style={{ fontSize: 11, color: "rgba(3,72,82,0.5)", marginTop: 6 }}>
            Letters, digits and underscores. Permanent once set — leave blank to use{" "}
            <code>{effectiveCode || "…"}</code>.
          </div>
        </div>

        <div>
          <label style={formLabelStyle}>Cohort label (optional)</label>
          <input style={inputStyle} value={cohort} onChange={(e) => setCohort(e.target.value)} placeholder="AY 2026" />
        </div>

        {err && <div style={errorStyle}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button style={secondaryButton} onClick={onClose}>Cancel</button>
          <button
            style={{ ...primaryButton, opacity: create.isPending || !name.trim() || !effectiveCode ? 0.6 : 1 }}
            disabled={create.isPending || !name.trim() || !effectiveCode}
            onClick={submit}
          >
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
