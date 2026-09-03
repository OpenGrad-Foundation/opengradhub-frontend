"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  isActive, isRange,
  type FilterDef, type FilterState, type RangeValue,
} from "@/lib/filters";

/**
 * One filter row for every tracker surface.
 *
 * `primary` defs sit inline, always visible. Everything else lives behind "Add
 * filter", because a template can define twenty fields and a control per field
 * would bury the grid it is meant to help read. Whatever is set appears as a
 * removable chip, so an active filter is never invisible — an empty list with a
 * forgotten filter on it reads as "there is no work here", which is the one
 * wrong answer this screen can give.
 */

const CTRL = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500";

export function FilterBar<Row>({
  spec, state, set, clear, activeCount, role, primaryKeys, children,
}: {
  spec: FilterDef<Row>[];
  state: FilterState;
  set: (patch: FilterState) => void;
  clear: () => void;
  activeCount: number;
  role?: string;
  /** Defs shown inline; the rest go behind "Add filter". Defaults to all of them. */
  primaryKeys?: string[];
  /** Surface-specific trailing controls, e.g. a sort selector. */
  children?: React.ReactNode;
}) {
  const [openExtra, setOpenExtra] = useState(false);
  const visible = spec.filter((d) => !d.visibleFor || d.visibleFor({ role: role ?? "" }));
  const primary = primaryKeys ? visible.filter((d) => primaryKeys.includes(d.key)) : visible;
  const extra = primaryKeys ? visible.filter((d) => !primaryKeys.includes(d.key)) : [];
  const extraActive = extra.filter((d) => isActive(state[d.key]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {primary.map((def) => (
          <Control key={def.key} def={def} value={state[def.key]} onChange={(v) => set({ [def.key]: v })} />
        ))}
        {extra.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenExtra((o) => !o)}
              className={`${CTRL} inline-flex items-center gap-1.5 text-gray-700 hover:border-teal-500`}
              aria-expanded={openExtra}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add filter
              {extraActive.length > 0 && (
                <span className="rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white">
                  {extraActive.length}
                </span>
              )}
            </button>
            {openExtra && (
              <div className="absolute left-0 top-10 z-20 flex w-72 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                {extra.map((def) => (
                  <label key={def.key} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-600">{def.label}</span>
                    <Control def={def} value={state[def.key]} onChange={(v) => set({ [def.key]: v })} full />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {children}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visible.filter((d) => isActive(state[d.key])).map((def) => (
            <button
              key={def.key}
              type="button"
              onClick={() => set({ [def.key]: undefined })}
              className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
            >
              {def.label}: {describe(def, state[def.key])}
              <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Remove {def.label} filter</span>
            </button>
          ))}
          <button type="button" onClick={clear} className="px-1.5 py-1 text-xs font-medium text-gray-500 underline hover:text-gray-800">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Control<Row>({
  def, value, onChange, full,
}: {
  def: FilterDef<Row>;
  value: FilterState[string];
  onChange: (v: FilterState[string]) => void;
  full?: boolean;
}) {
  const width = full ? "w-full" : "";
  if (isRange(def.kind)) {
    const range = (value ?? {}) as RangeValue;
    const type = def.kind === "daterange" ? "date" : "number";
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type={type} value={range.from ?? ""} aria-label={`${def.label} from`}
          onChange={(e) => onChange({ ...range, from: e.target.value || undefined })}
          className={`${CTRL} ${full ? "w-full" : "w-36"}`} />
        <span className="text-xs text-gray-400">→</span>
        <input
          type={type} value={range.to ?? ""} aria-label={`${def.label} to`}
          onChange={(e) => onChange({ ...range, to: e.target.value || undefined })}
          className={`${CTRL} ${full ? "w-full" : "w-36"}`} />
      </span>
    );
  }
  if (def.kind === "toggle") {
    return (
      <label className={`inline-flex items-center gap-1.5 text-sm text-gray-700 ${width}`}>
        <input
          type="checkbox" checked={value === true}
          onChange={(e) => onChange(e.target.checked ? true : undefined)}
          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
        {def.label}
      </label>
    );
  }
  if (def.kind === "select") {
    return (
      <select
        value={(value as string) ?? ""} aria-label={def.label}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`${CTRL} ${width}`}>
        <option value="">All {def.label.toLowerCase()}</option>
        {(def.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <input
      value={(value as string) ?? ""} aria-label={def.label} placeholder={`${def.label}…`}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={`${CTRL} ${full ? "w-full" : "w-56"}`} />
  );
}

/** Chip text: the option's label where there is one, so a chip never shows a UUID. */
function describe<Row>(def: FilterDef<Row>, value: FilterState[string]): string {
  if (value === true) return "yes";
  if (typeof value === "string") {
    return def.options?.find((o) => o.value === value)?.label ?? value;
  }
  const range = (value ?? {}) as RangeValue;
  if (range.from && range.to) return `${range.from} → ${range.to}`;
  return range.from ? `from ${range.from}` : `until ${range.to}`;
}
