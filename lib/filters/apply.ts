import { isActive, type FilterDef, type FilterState } from "./spec";

/**
 * The client-side executor, for surfaces whose rows are all already in memory:
 * the task grid (getGrid is unpaginated) and My Tasks.
 *
 * A def with no `match` is server-executed, and is skipped here rather than
 * treated as "matches nothing" — otherwise mixing a server filter into a client
 * spec would silently empty the view.
 */
export function applyFilters<Row>(rows: Row[], spec: FilterDef<Row>[], state: FilterState): Row[] {
  const active = spec.filter((d) => d.match && isActive(state[d.key]));
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every((d) => d.match!(row, state[d.key] as NonNullable<typeof state[string]>)));
}
