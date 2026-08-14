import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const mutate = vi.fn();
vi.mock("@/lib/queries/tracker", () => ({ useNudge: () => ({ mutate, isPending: false }) }));

import { NudgeButton } from "@/app/dashboard/tracker/_components/nudge-button";

beforeEach(() => { mutate.mockReset(); });

describe("NudgeButton", () => {
  it("is disabled and shows 'Reminded' when nudged within the cooldown", () => {
    const recent = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { getByRole } = render(<NudgeButton doerId="d" templateId="t" lastNudgedAt={recent} />);
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/Reminded/);
  });

  it("nudges with doerId + templateId when clicked", () => {
    const { getByRole } = render(<NudgeButton doerId="d" templateId="t" lastNudgedAt={null} />);
    fireEvent.click(getByRole("button"));
    expect(mutate).toHaveBeenCalledWith({ doerId: "d", templateId: "t" });
  });

  it("omits templateId for a digest nudge", () => {
    const { getByRole } = render(<NudgeButton doerId="d" lastNudgedAt={null} label="Nudge all" />);
    fireEvent.click(getByRole("button"));
    expect(mutate).toHaveBeenCalledWith({ doerId: "d", templateId: undefined });
  });
});
