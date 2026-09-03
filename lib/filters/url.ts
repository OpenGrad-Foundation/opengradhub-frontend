import {
  isActive, isRange, rangeUrlKeys,
  type FilterDef, type FilterState, type RangeValue,
} from "./spec";

/**
 * The URL codec.
 *
 * Filter state lives in the URL so a filtered view can be sent to the person who
 * has to act on it, and so Back undoes a filter change. Two rules make that safe
 * to bolt onto pages that already carry query params:
 *
 *   - only NON-DEFAULT values are written, so a bare URL and a fully cleared one
 *     are byte-identical;
 *   - parameters the spec does not own are copied through untouched. The tracker's
 *     existing `?task=` deep link and the repo-wide `?from=` back-nav key
 *     (lib/nav.ts) both pass through here on every keystroke.
 */

/** Query params -> filter state. Unknown params are ignored, never guessed at. */
export function readFilterState<Row>(spec: FilterDef<Row>[], params: URLSearchParams): FilterState {
  const state: FilterState = {};
  for (const def of spec) {
    if (isRange(def.kind)) {
      const keys = rangeUrlKeys(def as FilterDef<never>);
      const from = params.get(keys.from) ?? undefined;
      const to = params.get(keys.to) ?? undefined;
      if (from || to) {
        const range: RangeValue = {};
        if (from) range.from = from;
        if (to) range.to = to;
        state[def.key] = range;
      }
      continue;
    }
    const raw = params.get(def.urlKey);
    if (raw === null) continue;
    if (def.kind === "toggle") {
      if (raw === "1") state[def.key] = true;
      continue;
    }
    if (raw !== "") state[def.key] = raw;
  }
  return state;
}

/**
 * Filter state -> query params, layered over `base` so unrelated params survive.
 * An inactive filter is DELETED rather than written empty, which is what keeps a
 * cleared filter from leaving `?q=&school=` litter behind.
 */
export function writeFilterParams<Row>(
  spec: FilterDef<Row>[], state: FilterState, base: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams(base.toString());
  for (const def of spec) {
    const value = state[def.key];
    const active = isActive(value);
    if (isRange(def.kind)) {
      const keys = rangeUrlKeys(def as FilterDef<never>);
      const range = (active ? value : {}) as RangeValue;
      range.from ? out.set(keys.from, range.from) : out.delete(keys.from);
      range.to ? out.set(keys.to, range.to) : out.delete(keys.to);
      continue;
    }
    if (!active) { out.delete(def.urlKey); continue; }
    out.set(def.urlKey, def.kind === "toggle" ? "1" : String(value).trim());
  }
  return out;
}
