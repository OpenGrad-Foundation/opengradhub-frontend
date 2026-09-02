import { describe, it, expect } from "vitest";
import { IN_CHARGE, ROLE_LABELS, roleLabel, TRACKER_NAME, ZONE } from "@/lib/labels";

describe("display vocabulary", () => {
  it("renames the FELLOW role on screen only", () => {
    expect(ROLE_LABELS.FELLOW).toBe("School In-Charge");
    expect(IN_CHARGE).toBe("School In-Charge");
  });

  it("maps a role code to its label", () => {
    expect(roleLabel("FELLOW")).toBe("School In-Charge");
    expect(roleLabel("ZONAL_MANAGER")).toBe("Zonal Manager");
  });

  it("maps the display name the backend stores, not just the code", () => {
    // GET /users/me hands us `role.name` ("Fellow"), never the code.
    expect(roleLabel("Fellow")).toBe("School In-Charge");
    expect(roleLabel("Zonal Manager")).toBe("Zonal Manager");
  });

  it("title-cases a role it has never heard of instead of leaking the code", () => {
    expect(roleLabel("REGIONAL_LEAD")).toBe("Regional Lead");
  });

  it("falls back when there is no role at all", () => {
    expect(roleLabel(null)).toBe("");
    expect(roleLabel(undefined, "Team")).toBe("Team");
    expect(roleLabel("", "Team")).toBe("Team");
  });

  it("carries the other two renames", () => {
    expect(ZONE).toBe("Zone");
    expect(TRACKER_NAME).toBe("Task Tracker");
  });
});
