/**
 * One way to render a tracker cell value as text. Pure (no React) so the editable
 * grid and the read-only student profile stay in agreement about what a stored
 * value looks like — a multiselect, a boolean and an unset field should not read
 * differently depending on which page you are on.
 */
export function displayCellValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
