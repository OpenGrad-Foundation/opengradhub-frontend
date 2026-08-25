import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { TrackerExtension } from "@/lib/tracker-api";

let extensions: TrackerExtension[];
const grantMutate = vi.fn();

vi.mock("@/lib/queries/tracker", () => ({
  useRecordExtensions: () => ({ data: extensions, isLoading: false }),
  useGrantExtension: () => ({ mutateAsync: grantMutate, isPending: false }),
}));

import { ExtensionPanel } from "@/app/dashboard/tracker/_components/extension-panel";

const ext = (over: Partial<TrackerExtension> = {}): TrackerExtension => ({
  id: "e1", record_id: "r1", extended_to: "2026-08-30",
  reason: "Fellow was on leave.", granted_by: "u9", granted_by_name: "ZM One",
  granted_at: "2026-08-25T09:00:00.000Z", active: true, ...over,
});

const renderPanel = (props: Partial<React.ComponentProps<typeof ExtensionPanel>> = {}) =>
  render(<ExtensionPanel recordId="r1" overdue canGrant={false} {...props} />);

beforeEach(() => {
  extensions = [];
  grantMutate.mockReset();
});

describe("ExtensionPanel — the doer's view", () => {
  it("renders nothing when the row is not overdue", () => {
    const { container } = renderPanel({ overdue: false });
    expect(container.innerHTML).toBe("");
  });

  it("tells the fellow they need a manager, not another photo", () => {
    renderPanel();
    expect(screen.getByText(/overdue/i)).toBeTruthy();
    expect(screen.getByText(/ZM|PM|manager/i)).toBeTruthy();
  });

  it("offers a fellow no way to grant one themselves", () => {
    renderPanel({ canGrant: false });
    expect(screen.queryByRole("button", { name: /grant|extend/i })).toBeNull();
  });

  it("shows an active extension and its new date", () => {
    extensions = [ext()];
    renderPanel();
    // The date appears both in the summary line and in the grant history row.
    expect(screen.getAllByText(/Aug/).length).toBeGreaterThan(0);
    expect(screen.getByText(/on leave/i)).toBeTruthy();
  });

  it("distinguishes a lapsed extension from a live one", () => {
    extensions = [ext({ active: false })];
    renderPanel();
    expect(screen.getByText(/expired|lapsed/i)).toBeTruthy();
  });

  it("names who granted it", () => {
    extensions = [ext()];
    renderPanel();
    expect(screen.getByText(/ZM One/)).toBeTruthy();
  });
});

describe("ExtensionPanel — the manager's view", () => {
  it("offers a grant control to someone who may grant", () => {
    renderPanel({ canGrant: true });
    expect(screen.getByRole("button", { name: /grant|extend/i })).toBeTruthy();
  });

  it("requires both a date and a reason", async () => {
    renderPanel({ canGrant: true });
    fireEvent.click(screen.getByRole("button", { name: /grant|extend/i }));
    const form = screen.getByRole("form", { name: /extension/i });
    fireEvent.click(within(form).getByRole("button", { name: /confirm|grant/i }));
    await waitFor(() => expect(grantMutate).not.toHaveBeenCalled());
    // Submitting empty surfaces a specific validation message (labels also match
    // /reason|date/, so assert on the message itself).
    expect(screen.getByText(/pick a new due date/i)).toBeTruthy();
  });

  it("submits the new date and reason", async () => {
    renderPanel({ canGrant: true });
    fireEvent.click(screen.getByRole("button", { name: /grant|extend/i }));
    fireEvent.change(screen.getByLabelText(/new due date/i), { target: { value: "2026-09-05" } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "School was shut." } });
    const form = screen.getByRole("form", { name: /extension/i });
    fireEvent.click(within(form).getByRole("button", { name: /confirm|grant/i }));
    await waitFor(() =>
      expect(grantMutate).toHaveBeenCalledWith({
        recordId: "r1", extended_to: "2026-09-05", reason: "School was shut.",
      }),
    );
  });

  it("keeps earlier grants visible as history", () => {
    extensions = [ext({ id: "e2", active: true }), ext({ id: "e1", active: false, reason: "First try." })];
    renderPanel({ canGrant: true });
    expect(screen.getByText(/first try/i)).toBeTruthy();
  });
});
