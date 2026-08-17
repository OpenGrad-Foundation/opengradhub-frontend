import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  PROGRAMME_KINDS,
  PROGRAMME_KIND_VALUES,
  isKnownProgrammeKind,
  normProgrammeKind,
  programmeKindLabel,
} from "@/lib/programme-kinds";

/**
 * lib/programme-kinds.ts is the source of truth; the backend keeps a hand-edited
 * mirror at src/common/programme-kinds.ts because the packages cannot import
 * each other. Both sides have a spec asserting the same list, so editing one
 * without the other fails a build rather than shipping a dropdown the API
 * rejects.
 */
describe("programme kinds", () => {
  it("is the list the backend mirror also asserts", () => {
    expect(PROGRAMME_KIND_VALUES).toEqual(["UG", "PG", "CAT"]);
  });

  it("normalises loose input to the value form", () => {
    expect(normProgrammeKind(" cat ")).toBe("CAT");
    expect(normProgrammeKind("Ug")).toBe("UG");
    expect(normProgrammeKind(undefined)).toBe("");
  });

  it("accepts known kinds and refuses everything else", () => {
    expect(isKnownProgrammeKind("CAT")).toBe(true);
    expect(isKnownProgrammeKind("NEET")).toBe(false);
    expect(isKnownProgrammeKind("")).toBe(false);
  });

  it("echoes an unknown kind back rather than rendering blank", () => {
    // Rows created before a kind was retired must still show something. A
    // lookup that returned undefined would render an empty badge.
    expect(programmeKindLabel("CAT")).toBe("CAT");
    expect(programmeKindLabel("LEGACY_THING")).toBe("LEGACY_THING");
    expect(programmeKindLabel(null)).toBe("");
  });

  it("every option carries a non-empty label", () => {
    for (const o of PROGRAMME_KINDS) expect(o.label.trim()).not.toBe("");
  });
});

describe("no form hardcodes the old two-value domain", () => {
  const roots = ["app", "components", "lib"];

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next") continue;
        walk(full, out);
      } else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
    return out;
  }

  const files = roots.flatMap((r) => {
    const dir = path.join(__dirname, "..", r);
    return fs.existsSync(dir) ? walk(dir) : [];
  });

  it("offers no hardcoded UG/PG option pair", () => {
    // Every programme control renders from PROGRAMME_KINDS. A hardcoded pair is
    // how CAT became uncreatable everywhere except the programmes page itself:
    // the container accepted it, and then no form would.
    const offenders = files
      .filter((f) => !f.endsWith(path.join("lib", "programme-kinds.ts")))
      .filter((f) => {
        const body = fs.readFileSync(f, "utf-8");
        return /<option value="UG">/.test(body) || /\{ value: "UG"/.test(body);
      })
      .map((f) => path.relative(path.join(__dirname, ".."), f));
    expect(offenders).toEqual([]);
  });

  it("keeps the email rule identical to the server's isUgStudent", () => {
    // Email is optional only for a UG student. The previous form read "not PG
    // means UG", which silently exempted CAT students the server would reject.
    const page = fs.readFileSync(
      path.join(__dirname, "..", "app", "dashboard", "user-management", "page.tsx"),
      "utf-8",
    );
    expect(page).toMatch(/const emailRequired = !\(isStudent && programme === "UG"\);/);
  });
});
