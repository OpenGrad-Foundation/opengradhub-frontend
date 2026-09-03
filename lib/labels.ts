/**
 * User-facing vocabulary.
 *
 * The product renamed three concepts on screen only — the database, the API
 * contract, the role codes and the URLs still speak the original words:
 *
 *   role code FELLOW      → "School In-Charge"
 *   geo column `district` → "Zone"
 *   "FellowTracker"       → "Task Tracker"
 *
 * Anything a user reads must come from here, so the wire vocabulary and the
 * screen vocabulary can drift apart without a migration. Never map in the
 * other direction: no request body, query key or route may be built from
 * these strings.
 */

export const IN_CHARGE = "School In-Charge";
export const IN_CHARGE_PLURAL = "School In-Charges";
export const IN_CHARGE_LOWER = "school in-charge";
export const IN_CHARGE_LOWER_PLURAL = "school in-charges";

export const ZONE = "Zone";
export const ZONE_PLURAL = "Zones";
export const ZONE_LOWER = "zone";

export const TRACKER_NAME = "Task Tracker";

/**
 * The partner-facing name for the same module.
 *
 * Government and funding officials see this on the one surface they can reach
 * (/dashboard/shared-tracker); internal staff see TRACKER_NAME on theirs. Two
 * names, on purpose, because the two audiences are reading different things —
 * the partner view is a subset someone opted them into, not the tracker.
 *
 * It says "Fellow" where the rest of the product now says "School In-Charge".
 * That is a deliberate exception, requested for the external surface; do not
 * take it as licence to reintroduce "Fellow" anywhere else.
 */
export const PARTNER_TRACKER_NAME = "Fellow Tracker";

/** Role code → screen label. Codes stay as the backend defines them. */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  PROGRAM_MANAGER: "Program Manager",
  ZONAL_MANAGER: "Zonal Manager",
  FELLOW: IN_CHARGE,
  STUDENT: "Student",
  GOVERNMENT: "Government",
  FUNDING_PARTNER: "Funding Partner",
};

/** `FELLOW` / `Zonal Manager` → `School_In_Charge`-style lookup key. */
function normalise(value: string): string {
  return value.trim().replace(/[\s-]+/g, "_").toUpperCase();
}

/** Title-cases an unknown code so a new backend role still reads sanely. */
function prettify(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Screen label for a role, accepting either the code (`FELLOW`) or the
 * display name the backend already stores (`Fellow`) — the `/me` payload
 * hands us the latter. Unknown roles fall back to a title-cased form rather
 * than leaking a SCREAMING_CASE code into the UI.
 */
export function roleLabel(codeOrName: string | null | undefined, fallback = ""): string {
  if (!codeOrName) return fallback;
  return ROLE_LABELS[normalise(codeOrName)] ?? prettify(codeOrName);
}
