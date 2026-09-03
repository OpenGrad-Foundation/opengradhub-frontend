/**
 * The filter kit's vocabulary.
 *
 * Four tracker surfaces each grew their own filter row, with their own control
 * markup and their own idea of what could be filtered. A surface now declares a
 * `FilterDef[]` instead, and the kit supplies the URL codec, the controls and
 * the matching. Nothing else in the codebase enumerates filters.
 *
 * A def owns three separate vocabularies, which are deliberately allowed to
 * differ:
 *
 *   key     the state key                      "zone"
 *   urlKey  the query parameter                "zone"
 *   apiKey  the request parameter              "district"
 *
 * The screen says "Zone", the URL says `zone`, and the backend still says
 * `district` — see lib/labels.ts, which renamed the concept on screen only.
 */

export type FilterKind =
  | "select"   // one value out of `options`
  | "text"     // free text, matched case-insensitively
  | "daterange"// two bound params: `${urlKey}_from` / `${urlKey}_to`
  | "numrange" // two bound params: `${urlKey}_min` / `${urlKey}_max`
  | "toggle";  // presence of the key means "on"

export type RangeValue = { from?: string; to?: string };
export type FilterValue = string | boolean | RangeValue | undefined;
export type FilterState = Record<string, FilterValue>;

export type FilterOption = { value: string; label: string };

export type FilterDef<Row = unknown> = {
  key: string;
  urlKey: string;
  /** Request-parameter name. Ranges derive `${apiKey}From` / `${apiKey}To`. */
  apiKey: string;
  label: string;
  kind: FilterKind;
  options?: FilterOption[];
  /** Hide a control that cannot apply to this viewer — e.g. a ZM filtering by ZM. */
  visibleFor?: (ctx: { role: string }) => boolean;
  /**
   * Client-side matcher. Present on client-executed filters, absent on
   * server-executed ones (where `toQuery` is what consumes the def).
   */
  match?: (row: Row, value: NonNullable<FilterValue>) => boolean;
};

export const isRange = (kind: FilterKind): boolean => kind === "daterange" || kind === "numrange";

/** Suffixes a range kind uses in the URL. Numbers read as min/max, dates as from/to. */
export function rangeUrlKeys(def: FilterDef<never>): { from: string; to: string } {
  return def.kind === "numrange"
    ? { from: `${def.urlKey}_min`, to: `${def.urlKey}_max` }
    : { from: `${def.urlKey}_from`, to: `${def.urlKey}_to` };
}

/** Is this value worth writing to the URL / sending to the server? */
export function isActive(value: FilterValue): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim() !== "";
  return Boolean(value.from || value.to);
}

/** How many controls the user has actually set — a range counts once. */
export function activeFilterCount(spec: FilterDef<never>[], state: FilterState): number {
  return spec.filter((d) => isActive(state[d.key])).length;
}
