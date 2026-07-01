"use client";

import { useMemo, useState } from "react";
import { Flag, Loader2, Save } from "lucide-react";
import { useRaiseTrackerBlocker, useSaveTrackerBatch } from "@/lib/queries/tracker";
import type { TrackerBatchEdit, TrackerGrid, TrackerTemplate } from "@/lib/tracker-api";

type RowDraft = { values: Record<string, unknown>; status?: string };

export function TrackerEditableGrid({
  template,
  grid,
  canFill,
}: {
  template: TrackerTemplate;
  grid: TrackerGrid;
  canFill: boolean;
}) {
  const save = useSaveTrackerBatch();
  const raise = useRaiseTrackerBlocker();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [blockerText, setBlockerText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const editableKeys = useMemo(
    () => new Set(grid.columns.filter((c) => c.source !== "profile").map((c) => c.field_key)),
    [grid.columns],
  );

  const dirtyCount = Object.values(drafts).filter((d) => Object.keys(d.values).length > 0 || d.status !== undefined).length;

  function setCell(recordId: string, key: string, value: unknown) {
    setDrafts((d) => ({ ...d, [recordId]: { ...d[recordId], values: { ...(d[recordId]?.values ?? {}), [key]: value } } }));
  }
  function setStatus(recordId: string, status: string) {
    setDrafts((d) => ({ ...d, [recordId]: { ...d[recordId], values: d[recordId]?.values ?? {}, status } }));
  }

  async function onSave() {
    setError(null);
    const edits: TrackerBatchEdit[] = Object.entries(drafts)
      .filter(([, d]) => Object.keys(d.values).length > 0 || d.status !== undefined)
      .map(([record_id, d]) => ({ record_id, values: d.values, status: d.status }));
    if (edits.length === 0) return;
    try {
      await save.mutateAsync(edits);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function onRaise(recordId: string) {
    const text = (blockerText[recordId] ?? "").trim();
    if (!text) return;
    setError(null);
    try {
      await raise.mutateAsync({ recordId, text });
      setBlockerText((b) => ({ ...b, [recordId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not raise blocker.");
    }
  }

  const inputClass = "h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100";

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-950">{template.name}</h2>
        {canFill && (
          <button
            type="button"
            onClick={onSave}
            disabled={save.isPending || dirtyCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </button>
        )}
      </div>
      {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-3 font-semibold">{template.completion_style === "workflow" ? "Stage" : "Done?"}</th>
              {grid.columns.map((c) => (
                <th key={c.field_key} className="px-3 py-3 font-semibold">{c.label}</th>
              ))}
              <th className="px-3 py-3 font-semibold">Stuck?</th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const draft = drafts[row.record_id];
              const currentStatus = draft?.status ?? row.status;
              return (
                <tr key={row.record_id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-3">
                    {template.completion_style === "workflow" ? (
                      <select value={currentStatus} disabled={!canFill} onChange={(e) => setStatus(row.record_id, e.target.value)} className={inputClass}>
                        {(template.workflow_statuses ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                        <input type="checkbox" disabled={!canFill} checked={currentStatus === "done"} onChange={(e) => setStatus(row.record_id, e.target.checked ? "done" : "not_started")} />
                        {currentStatus === "done" ? "Done" : "Open"}
                      </label>
                    )}
                  </td>
                  {grid.columns.map((col) => {
                    const cell = row.cells.find((c) => c.field_key === col.field_key);
                    const editable = canFill && editableKeys.has(col.field_key);
                    const draftVal = draft?.values[col.field_key];
                    const value = draftVal !== undefined ? draftVal : cell?.value;
                    return (
                      <td key={col.field_key} className="px-3 py-3 text-gray-700">
                        {!editable ? (
                          cell?.notSet ? <span className="text-gray-400">Not set</span> : <span>{display(value)}</span>
                        ) : (
                          <EditableCell col={col} value={value} onChange={(v) => setCell(row.record_id, col.field_key, v)} inputClass={inputClass} />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3">
                    {row.blocked ? (
                      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Blocked</span>
                    ) : canFill ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={blockerText[row.record_id] ?? ""}
                          onChange={(e) => setBlockerText((b) => ({ ...b, [row.record_id]: e.target.value }))}
                          placeholder="What's stuck?"
                          className="h-9 w-40 rounded border border-gray-300 px-2 text-sm outline-none focus:border-teal-500"
                        />
                        <button type="button" onClick={() => onRaise(row.record_id)} disabled={raise.isPending} aria-label="Raise blocker" className="rounded border border-gray-300 p-2 text-gray-500 hover:text-red-600">
                          <Flag className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditableCell({
  col,
  value,
  onChange,
  inputClass,
}: {
  col: TrackerGrid["columns"][number];
  value: unknown;
  onChange: (v: unknown) => void;
  inputClass: string;
}) {
  switch (col.field_type) {
    case "boolean":
      return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case "number":
      return <input type="number" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />;
    case "date":
      return <input type="date" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value || null)} className={inputClass} />;
    case "select":
      return (
        <select value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
          <option value="">—</option>
          {(col.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {(col.options ?? []).map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
                className={"rounded-full border px-2 py-0.5 text-xs " + (on ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-300 text-gray-600")}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return <input type={col.field_type === "url" ? "url" : "text"} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  }
}

function display(value: unknown): string {
  if (value == null || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
