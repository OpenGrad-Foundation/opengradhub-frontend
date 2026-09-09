import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

// Heavy leaf components (charts etc.) aren't the point of this test — stub
// them so we exercise only ProgrammeInsights' own programme-control logic.
vi.mock("@/app/dashboard/analytics/_components/KpiStrip", () => ({ KpiStrip: () => null }));
vi.mock("@/app/dashboard/analytics/_components/TrendDistribution", () => ({ TrendDistribution: () => null }));
vi.mock("@/app/dashboard/analytics/_components/NeedsAttention", () => ({ NeedsAttention: () => null }));
vi.mock("@/app/dashboard/analytics/_components/SchoolDetail", () => ({ default: () => null }));
vi.mock("@/app/dashboard/analytics/_components/ManagerDrill", () => ({ default: () => null }));

let scopeKind: "partner" | "global" = "partner";
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
  useAnalyticsFilterProgrammes: () => ({ data: [{ id: "p1", name: "CAT Kerala 2026" }] }),
  useAnalyticsFilterStates: () => ({ data: [] }),
  useAnalyticsFilterDistricts: () => ({ data: [] }),
  useAnalyticsFilterSchools: () => ({ data: [] }),
}));

import ProgrammeInsights from "@/app/dashboard/analytics/_components/ProgrammeInsights";

afterEach(() => {
  cleanup();
  insightsCalls.length = 0;
});

describe("ProgrammeInsights programme control — the two-state-variable invariant", () => {
  it("writes programmeId, never programme, for a partner scope", () => {
    scopeKind = "partner";
    const { getByText } = render(<ProgrammeInsights />);
    fireEvent.click(getByText("All programmes"));
    fireEvent.click(getByText("CAT Kerala 2026"));
    const last = insightsCalls[insightsCalls.length - 1];
    expect(last.programmeId).toBe("p1");
    expect(last.programme).toBeUndefined();
  });

  it("writes programme, never programmeId, for a global scope", () => {
    scopeKind = "global";
    const { getByText } = render(<ProgrammeInsights />);
    fireEvent.click(getByText("All programmes"));
    fireEvent.click(getByText("UG"));
    const last = insightsCalls[insightsCalls.length - 1];
    expect(last.programme).toBe("UG");
    expect(last.programmeId).toBeUndefined();
  });
});
