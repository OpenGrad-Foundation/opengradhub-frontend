/** `tracker_field_definitions.field_key` is varchar(80); the label (shown to users) is separate. */
export const FIELD_KEY_MAX = 80;

/** Lowercase, runs of non-alphanumerics become one `_`, no leading/trailing `_`. */
export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function fit(base: string, room: number): string {
  return base.slice(0, room).replace(/_+$/, "") || "field";
}

/** A field key derived from the label: fits the column, and is not already in `used`. */
export function fieldKey(label: string, used: ReadonlySet<string>): string {
  const base = slugify(label) || "field";
  let key = fit(base, FIELD_KEY_MAX);
  for (let n = 2; used.has(key); n++) {
    const suffix = `_${n}`;
    key = fit(base, FIELD_KEY_MAX - suffix.length) + suffix;
  }
  return key;
}
