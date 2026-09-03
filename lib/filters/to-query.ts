import { isActive, isRange, type FilterDef, type FilterState, type RangeValue } from "./spec";

/**
 * The server-side executor, for surfaces the server paginates: All Tasks and the
 * task drill-down. Filtering a fetched page in the browser would leave the totals
 * and the status cards describing a different set than the list.
 *
 * Ranges expand to `${apiKey}From` / `${apiKey}To`, matching the camel-case
 * filter types the tracker services already declare.
 */
export function toQuery<Row>(spec: FilterDef<Row>[], state: FilterState): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const def of spec) {
    const value = state[def.key];
    if (!isActive(value)) continue;
    if (isRange(def.kind)) {
      const range = value as RangeValue;
      if (range.from) query[`${def.apiKey}From`] = range.from;
      if (range.to) query[`${def.apiKey}To`] = range.to;
      continue;
    }
    query[def.apiKey] = def.kind === "toggle" ? true : String(value).trim();
  }
  return query;
}
