import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

// Heavy leaf components (charts etc.) aren't the point of this test — stub
// them so we exercise only ProgrammeInsights' own programme-control logic.
vi.mock("@/app/dashboard/analytics/_components/KpiStrip", () => ({ KpiStrip: () => null }));
vi.mock("@/app/dashboard/analytics/_components/TrendDistribution", () => ({ TrendDistribution: () => null }));
vi.mock("@/app/dashboard/analytics/_components/NeedsAttention", () => ({ NeedsAttention: () => null }));
vi.mock("@/app/dashboard/analytics/_components/SchoolDetail", () => ({ default: () => null }));
vi.mock("@/app/dashboard/analytics/_components/ManagerDrill", () => ({ default: () => null }));

let scopeKind: "partner" | "global" | "programme" | "school" = "partner";
const geoCalls: unknown[][] = [];
const insightsCalls: Array<{ programme?: string; programmeId?: string }> = [];
vi.mock("@/lib/queries/analytics", () => ({
  useProgrammeInsights: (filters: any) => {
    insightsCalls.push(filters);
    return {
      data: {
        scope: { kind: scopeKind, label: "x", programme_ids: scopeKind === "partner" ? ["p1"] : undefined, programme_filter: null, programme_filter_id: null },
        kpis: {}, trend: [], distribution: { entity: "district", rows: [] }, needs_attention: null,
      },
      isPending: false, error: null,
    };
  },
  useAnalyticsFilterProgrammes: () => ({ data: [{ id: "p1", name: "CAT Kerala 2026" }, { id: "p2", name: "UG Karnataka 2026" }] }),
  useAnalyticsFilterStates: (...args: unknown[]) => { geoCalls.push(args); return { data: [] }; },
  useAnalyticsFilterDistricts: (...args: unknown[]) => { geoCalls.push(args); return { data: [] }; },
  useAnalyticsFilterSchools: (...args: unknown[]) => { geoCalls.push(args); return { data: [] }; },
}));

import ProgrammeInsights from "@/app/dashboard/analytics/_components/ProgrammeInsights";

afterEach(() => {
  cleanup();
  insightsCalls.length = 0; geoCalls.length = 0;
});

describe("ProgrammeInsights programme records and dependent filters", () => {
  it("writes programmeId, never programme, for a partner scope", () => {
    scopeKind = "partner";
    const { getByText } = render(<ProgrammeInsights />);
    fireEvent.click(getByText("All programmes"));
    fireEvent.click(getByText("CAT Kerala 2026"));
    const last = insightsCalls[insightsCalls.length - 1];
    expect(last.programmeId).toBe("p1");
    expect(last.programme).toBeUndefined();
  });

  it.each(["global", "programme", "school"] as const)("uses current programme records for a %s scope", kind => {
    scopeKind = kind;
    const { getByText, queryByText, getByPlaceholderText } = render(<ProgrammeInsights />);
    fireEvent.click(getByText("All programmes"));
    expect(queryByText("UG")).toBeNull();
    fireEvent.change(getByPlaceholderText("Search…"), { target: { value: "karnataka" } });
    expect(queryByText("CAT Kerala 2026")).toBeNull();
    fireEvent.click(getByText("UG Karnataka 2026"));
    const last = insightsCalls[insightsCalls.length - 1];
    expect(last.programmeId).toBe("p2");
    expect(last.programme).toBeUndefined();
    expect(geoCalls.slice(-3)).toEqual([["p2"], [undefined, "p2"], [undefined, undefined, "p2"]]);
  });
});
