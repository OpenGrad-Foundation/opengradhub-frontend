"use client";

import { useEffect, useRef, useState } from "react";
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

const CTRL = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500";

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
  const containerRef = useRef<HTMLDivElement>(null);

  const visible = spec.filter((d) => !d.visibleFor || d.visibleFor({ role: role ?? "" }));
  const primary = primaryKeys ? visible.filter((d) => primaryKeys.includes(d.key)) : visible;
  const extra = primaryKeys ? visible.filter((d) => !primaryKeys.includes(d.key)) : [];
  const extraActive = extra.filter((d) => isActive(state[d.key]));

  useEffect(() => {
    if (!openExtra) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenExtra(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenExtra(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openExtra]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {primary.map((def) => (
          <Control key={def.key} def={def} value={state[def.key]} onChange={(v) => set({ [def.key]: v })} />
        ))}
        {extra.length > 0 && (
          <div className="relative" ref={containerRef}>
            <button
              type="button"
              onClick={() => setOpenExtra((o) => !o)}
              className={`${CTRL} inline-flex items-center gap-1.5 text-gray-700 transition-colors hover:border-teal-500 ${
                openExtra ? "border-teal-500 ring-1 ring-teal-500" : ""
              }`}
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
              <div
                className="absolute left-0 top-full z-30 mt-1.5 flex w-80 sm:w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
                role="dialog"
                aria-label="Additional filters"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Filters</span>
                    {extraActive.length > 0 && (
                      <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                        {extraActive.length} active
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenExtra(false)}
                    className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Close filters"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex max-h-[60vh] flex-col gap-3.5 overflow-y-auto pr-0.5">
                  {extra.map((def) => {
                    const id = `extra-filter-${def.key}`;
                    if (def.kind === "toggle") {
                      return (
                        <div key={def.key} className="py-0.5">
                          <Control id={id} def={def} value={state[def.key]} onChange={(v) => set({ [def.key]: v })} full />
                        </div>
                      );
                    }
                    return (
                      <div key={def.key} className="flex flex-col gap-1.5">
                        <label
                          htmlFor={isRange(def.kind) ? `${id}-from` : id}
                          className="text-xs font-medium text-gray-700"
                        >
                          {def.label}
                        </label>
                        <Control id={id} def={def} value={state[def.key]} onChange={(v) => set({ [def.key]: v })} full />
                      </div>
                    );
                  })}
                </div>

                {extraActive.length > 0 && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs">
                    <span className="text-gray-500">
                      {extraActive.length} filter{extraActive.length > 1 ? "s" : ""} applied
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const patch: FilterState = {};
                        extra.forEach((d) => { patch[d.key] = undefined; });
                        set(patch);
                      }}
                      className="font-medium text-teal-600 hover:text-teal-800 hover:underline"
                    >
                      Reset filters
                    </button>
                  </div>
                )}
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
  def, value, onChange, full, id,
}: {
  def: FilterDef<Row>;
  value: FilterState[string];
  onChange: (v: FilterState[string]) => void;
  full?: boolean;
  id?: string;
}) {
  const width = full ? "w-full" : "";
  if (isRange(def.kind)) {
    const range = (value ?? {}) as RangeValue;
    const type = def.kind === "daterange" ? "date" : "number";
    return (
      <div className={`flex items-center gap-2 ${full ? "w-full" : ""}`}>
        <input
          id={id ? `${id}-from` : undefined}
          type={type}
          value={range.from ?? ""}
          aria-label={`${def.label} from`}
          placeholder={def.kind === "numrange" ? "Min" : "From"}
          onChange={(e) => onChange({ ...range, from: e.target.value || undefined })}
          className={`${CTRL} ${full ? "min-w-0 flex-1 px-2 text-xs sm:text-sm" : "w-36"}`}
        />
        <span className="shrink-0 text-xs font-medium text-gray-400" aria-hidden="true">→</span>
        <input
          id={id ? `${id}-to` : undefined}
          type={type}
          value={range.to ?? ""}
          aria-label={`${def.label} to`}
          placeholder={def.kind === "numrange" ? "Max" : "To"}
          onChange={(e) => onChange({ ...range, to: e.target.value || undefined })}
          className={`${CTRL} ${full ? "min-w-0 flex-1 px-2 text-xs sm:text-sm" : "w-36"}`}
        />
      </div>
    );
  }
  if (def.kind === "toggle") {
    return (
      <label className={`inline-flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 hover:text-gray-900 ${width}`}>
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          aria-label={def.label}
          onChange={(e) => onChange(e.target.checked ? true : undefined)}
          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="font-medium text-gray-700">{def.label}</span>
      </label>
    );
  }
  if (def.kind === "select") {
    return (
      <select
        id={id}
        value={(value as string) ?? ""}
        aria-label={def.label}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`${CTRL} ${width} cursor-pointer text-gray-800`}
      >
        <option value="">All {def.label.toLowerCase()}</option>
        {(def.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <input
      id={id}
      value={(value as string) ?? ""}
      aria-label={def.label}
      placeholder={`${def.label}…`}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={`${CTRL} ${full ? "w-full" : "w-56"} text-gray-800`}
    />
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
