import { describe, it, expect } from "vitest";
import { canAccessDashboardPath, PERM } from "@/lib/permissions";

describe("staff profile route gate", () => {
  const only = (...codes: string[]) => (c: string) => codes.includes(c);
  it("profile route needs only dashboard.view", () => {
    expect(canAccessDashboardPath("/dashboard/user-management/abc", only(PERM.dashboard.view))).toBe(true);
    expect(canAccessDashboardPath("/dashboard/user-management/me", only(PERM.dashboard.view))).toBe(true);
  });
  it("list root still needs user_management.view", () => {
    expect(canAccessDashboardPath("/dashboard/user-management", only(PERM.dashboard.view))).toBe(false);
    expect(canAccessDashboardPath("/dashboard/user-management", only(PERM.user_management.view))).toBe(true);
  });
});
