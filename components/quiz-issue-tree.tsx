"use client";

import { useMemo, useState } from "react";
import type { ParsedBulkQuiz, ParseDiagnostic } from "@/lib/api";
import { groupDiagnostics, type DiagGroup } from "@/lib/quiz-import-diagnostics";

/**
 * Cascading (tree) view of import diagnostics: Quiz → Section → Question →
 * items, every level collapsible with rolled-up ⛔/⚠ counts. Groups that hold
 * an error start open; warning-only groups start folded, so a long list of
 * "no topic" warnings never buries the three things that actually block the
 * save. Presentation only — what clicking an item or its action does is the
 * caller's decision (jump to a line in the source, open a panel in the
 * preview).
 */

const SEV_ICON: Record<ParseDiagnostic["severity"], string> = { error: "⛔", warning: "⚠️", info: "ℹ️" };
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export type IssueAction = { label: string; onClick: () => void };

export function QuizIssueTree({
  quiz,
  diagnostics,
  onItemClick,
  itemAction,
  onGroupClick,
  activeLine,
  showLines = true,
  dense = false,
}: {
  quiz: ParsedBulkQuiz | null;
  diagnostics: ParseDiagnostic[];
  onItemClick?: (d: ParseDiagnostic) => void;
  /** Optional per-item button (e.g. "Rename to [DIFFICULTY]" / "Apply"). */
  itemAction?: (d: ParseDiagnostic) => IssueAction | null;
  /** Clicking a group header's label (e.g. jump to the question's line). */
  onGroupClick?: (g: DiagGroup) => void;
  /** Highlights items/groups anchored at this line. */
  activeLine?: number | null;
  showLines?: boolean;
  dense?: boolean;
}) {
  const [errorsOnly, setErrorsOnly] = useState(false);
  // Explicit user toggles win; otherwise groups with errors are open.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const visible = useMemo(
    () => diagnostics.filter((d) => d.severity !== "info" && (!errorsOnly || d.severity === "error")),
    [diagnostics, errorsOnly],
  );
  const groups = useMemo(() => groupDiagnostics(quiz, visible), [quiz, visible]);

  const allKeys = useMemo(() => {
    const out: string[] = [];
    const walk = (g: DiagGroup) => { out.push(g.key); g.children.forEach(walk); };
    groups.forEach(walk);
    return out;
  }, [groups]);

  const isOpen = (g: DiagGroup) => toggled[g.key] ?? g.counts.errors > 0;
  const setAll = (open: boolean) =>
    setToggled(Object.fromEntries(allKeys.map((k) => [k, open])));

  const hasWarnings = diagnostics.some((d) => d.severity === "warning");
  const fs = dense ? "11px" : "12px";

  return (
    <div style={{ fontSize: fs }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: "10px", padding: dense ? "4px 8px" : "6px 12px",
          borderBottom: "1px solid rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.6)", fontSize: "11px",
        }}
      >
        <button type="button" onClick={() => setAll(true)} style={linkBtn}>Expand all</button>
        <span aria-hidden>·</span>
        <button type="button" onClick={() => setAll(false)} style={linkBtn}>Collapse all</button>
        {hasWarnings && (
          <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
            <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
            Errors only
          </label>
        )}
      </div>

      {groups.length === 0 && (
        <div style={{ padding: "12px", color: "rgba(3,72,82,0.5)" }}>
          {errorsOnly ? "No errors." : "No issues."}
        </div>
      )}

      {groups.map((g) => (
        <GroupNode
          key={g.key}
          group={g}
          depth={0}
          isOpen={isOpen}
          toggle={(k, open) => setToggled((t) => ({ ...t, [k]: open }))}
          onItemClick={onItemClick}
          itemAction={itemAction}
          onGroupClick={onGroupClick}
          activeLine={activeLine ?? null}
          showLines={showLines}
          dense={dense}
        />
      ))}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "#0f6b58", fontWeight: 700, fontSize: "11px", fontFamily: "inherit",
};

function Counts({ counts }: { counts: DiagGroup["counts"] }) {
  return (
    <span style={{ display: "inline-flex", gap: "4px", flexShrink: 0 }}>
      {counts.errors > 0 && (
        <span style={{ fontSize: "10px", fontWeight: 800, color: "#fff", background: "#e53e3e", borderRadius: "100px", padding: "1px 7px" }}>
          {counts.errors} ⛔
        </span>
      )}
      {counts.warnings > 0 && (
        <span style={{ fontSize: "10px", fontWeight: 800, color: "#956f00", background: "rgba(255,222,0,0.3)", borderRadius: "100px", padding: "1px 7px" }}>
          {counts.warnings} ⚠
        </span>
      )}
    </span>
  );
}

function GroupNode({
  group, depth, isOpen, toggle, onItemClick, itemAction, onGroupClick, activeLine, showLines, dense,
}: {
  group: DiagGroup;
  depth: number;
  isOpen: (g: DiagGroup) => boolean;
  toggle: (key: string, open: boolean) => void;
  onItemClick?: (d: ParseDiagnostic) => void;
  itemAction?: (d: ParseDiagnostic) => IssueAction | null;
  onGroupClick?: (g: DiagGroup) => void;
  activeLine: number | null;
  showLines: boolean;
  dense: boolean;
}) {
  const open = isOpen(group);
  const pad = 10 + depth * 14;
  const rowPad = dense ? "5px" : "7px";
  return (
    <div>
      {/* Group header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: "8px", padding: `${rowPad} 10px ${rowPad} ${pad}px`,
          borderBottom: "1px solid rgba(3,72,82,0.05)", background: depth === 0 ? "rgba(3,72,82,0.025)" : "transparent",
          cursor: "pointer", userSelect: "none",
        }}
        onClick={() => toggle(group.key, !open)}
        role="button"
        aria-expanded={open}
      >
        <span aria-hidden style={{ width: "12px", display: "inline-block", color: "rgba(3,72,82,0.5)", fontSize: "10px", transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms" }}>
          ▶
        </span>
        <span
          style={{ flex: 1, minWidth: 0, fontWeight: depth === 0 ? 800 : 700, color: "#034852", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          onClick={(e) => { if (onGroupClick) { e.stopPropagation(); onGroupClick(group); } }}
          title={onGroupClick ? "Go to this item" : undefined}
        >
          {group.label}
        </span>
        {showLines && group.line != null && (
          <span style={{ fontFamily: MONO, fontSize: "10px", color: "rgba(3,72,82,0.4)", flexShrink: 0 }}>L{group.line}</span>
        )}
        <Counts counts={group.counts} />
      </div>

      {open && (
        <div>
          {group.items.map((d, i) => {
            const action = itemAction?.(d) ?? null;
            const active = activeLine != null && d.line === activeLine;
            return (
              <div
                key={d.id ?? `${group.key}-${i}`}
                onClick={() => onItemClick?.(d)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "8px",
                  padding: `${rowPad} 10px ${rowPad} ${pad + 20}px`,
                  borderBottom: "1px solid rgba(3,72,82,0.04)",
                  cursor: onItemClick ? "pointer" : "default",
                  background: active ? "rgba(10,190,98,0.07)" : "transparent",
                  color: d.severity === "error" ? "#c53030" : "#956f00", fontWeight: 600,
                }}
              >
                <span aria-hidden style={{ flexShrink: 0 }}>{SEV_ICON[d.severity]}</span>
                {showLines && d.line != null && (
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: "rgba(3,72,82,0.45)", flexShrink: 0, paddingTop: "2px" }}>L{d.line}</span>
                )}
                <span style={{ flex: 1, minWidth: 0, color: "#034852", fontWeight: 500 }}>{d.message}</span>
                {action && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                    style={{
                      flexShrink: 0, padding: "2px 9px", borderRadius: "7px", fontSize: "11px", fontWeight: 700,
                      border: "1.5px solid #0abe62", background: "#fff", color: "#0f6b58", cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    ✓ {action.label}
                  </button>
                )}
              </div>
            );
          })}
          {group.children.map((c) => (
            <GroupNode
              key={c.key}
              group={c}
              depth={depth + 1}
              isOpen={isOpen}
              toggle={toggle}
              onItemClick={onItemClick}
              itemAction={itemAction}
              onGroupClick={onGroupClick}
              activeLine={activeLine}
              showLines={showLines}
              dense={dense}
            />
          ))}
        </div>
      )}
    </div>
  );
}
