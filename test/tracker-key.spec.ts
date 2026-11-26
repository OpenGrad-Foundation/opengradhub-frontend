import { describe, expect, it } from "vitest";
import { FIELD_KEY_MAX, fieldKey } from "@/lib/tracker-key";

// Real column names that 500'd in production (Sentry OPENGRAD-HUB-BD-3T).
const PROD_LABELS = [
  'OBC-NCL certificate (Central Govt format) TN BC / MBC certificate alone is not accepted; must say "Non-Creamy Layer"',
  "Government school certificate, Class 6 - 12 (7.5% reservation) Only if Class 6 - 12 fully in TN govt schools",
  "Any suggestions to improve the class or increase the entrance effective coaching? (General Feedback)",
  "Aadhaar card (Student) Name & date of birth must match the Class 10 marksheet; mobile linked",
  "First Graduate certificate + joint declaration Only if no one in the family has a degree",
  "Community certificate (permanent) SC / ST certificate is also used for national exams",
];

describe("fieldKey", () => {
  it("keeps short labels unchanged", () => {
    expect(fieldKey("Passport-size photograph", new Set())).toBe("passport_size_photograph");
    expect(fieldKey("!!!", new Set())).toBe("field");
  });

  it.each(PROD_LABELS)("fits the 80-char column: %s", (label) => {
    const key = fieldKey(label, new Set());
    expect(key.length).toBeLessThanOrEqual(FIELD_KEY_MAX);
    expect(key).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
  });

  it("keeps truncated duplicates unique and within the limit", () => {
    const used = new Set<string>();
    const label = "x".repeat(200);
    for (let i = 0; i < 12; i++) used.add(fieldKey(label, used));
    expect(used.size).toBe(12);
    for (const k of used) expect(k.length).toBeLessThanOrEqual(FIELD_KEY_MAX);
  });
});
