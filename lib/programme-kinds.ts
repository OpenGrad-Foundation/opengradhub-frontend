// Source of truth for the programme-kind whitelist.
// MIRRORED by opengradhub-backend/src/common/programme-kinds.ts (separate
// package, cannot import). A spec on each side guards drift — the same
// arrangement lib/geo.ts uses for states.
//
// Why this lives in app code rather than a database CHECK: seven inline
// CHECK (programme_type IN ('UG','PG')) constraints used to pin this domain, so
// adding a kind meant a migration, and a rejected value surfaced as a raw 23514
// from Postgres *after* other side effects had run. Migration 070 moved states
// out for exactly that reason; migration 093 does the same here.
//
// To add a kind: add it below, on BOTH sides, and update the two drift specs.
// Nothing else needs to change.

export type ProgrammeKindOption = { value: string; label: string };

/** Single source of truth for every programme dropdown and validator. */
export const PROGRAMME_KINDS: ProgrammeKindOption[] = [
  { value: "UG", label: "UG" },
  { value: "PG", label: "PG" },
  { value: "CAT", label: "CAT" },
];

export const PROGRAMME_KIND_VALUES: string[] = PROGRAMME_KINDS.map((k) => k.value);

/**
 * Canonicalize a programme kind. Accepts stored value or loose user input
 * ("cat", " Cat ") and returns the value form ("CAT").
 */
export const normProgrammeKind = (s: string | null | undefined): string =>
  (s ?? "").trim().toUpperCase().replace(/\s+/g, "_");

/** True only for a kind on the whitelist. Empty/unknown are both false. */
export function isKnownProgrammeKind(s: string | null | undefined): boolean {
  const k = normProgrammeKind(s);
  return k !== "" && PROGRAMME_KIND_VALUES.includes(k);
}

/** Display label for a kind; echoes the raw value back if it is not known. */
export function programmeKindLabel(s: string | null | undefined): string {
  const k = normProgrammeKind(s);
  return PROGRAMME_KINDS.find((o) => o.value === k)?.label ?? (s ?? "");
}
