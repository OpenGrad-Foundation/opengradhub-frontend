import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { SearchMultiPicker, type MultiPickOption } from "@/components/SearchMultiPicker";

afterEach(cleanup);

const OPTIONS: MultiPickOption[] = [
  { id: "u1", label: "Asha PM", sublabel: "asha@x.in" },
  { id: "u2", label: "Binu ZM", sublabel: "binu@x.in" },
  { id: "u3", label: "Chitra Fellow", sublabel: "chitra@x.in" },
];

/** Controlled harness — the picker is a controlled component like its callers use it. */
function Harness(props: { options?: MultiPickOption[]; onQueryChange?: (q: string) => void }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <SearchMultiPicker
      options={props.options ?? OPTIONS}
      value={value}
      onChange={setValue}
      placeholder="Search…"
      onQueryChange={props.onQueryChange}
    />
  );
}

/** The list is collapsed until the search box is focused. */
function openPicker(getByPlaceholderText: (t: string) => HTMLElement) {
  fireEvent.focus(getByPlaceholderText("Search…"));
}

describe("SearchMultiPicker", () => {
  it("keeps the list collapsed until the search box is focused", () => {
    const { getByPlaceholderText, queryByText } = render(<Harness />);
    expect(queryByText("Asha PM")).toBeNull();
    openPicker(getByPlaceholderText);
    expect(queryByText("Asha PM")).toBeTruthy();
  });

  it("renders the menu outside its container, so an overflow-hidden card cannot clip it", () => {
    // The programme cards all carry `overflow: hidden` for their rounded
    // corners. An in-container menu showed as a clipped sliver; the menu is
    // portalled to document.body so no ancestor can crop it.
    const { getByPlaceholderText, getByText, container } = render(
      <div style={{ overflow: "hidden" }}>
        <Harness />
      </div>,
    );
    openPicker(getByPlaceholderText);
    const option = getByText("Asha PM");
    expect(container.contains(option)).toBe(false);
    expect(document.body.contains(option)).toBe(true);
  });

  it("keeps the menu inside the viewport and scrollable when the input sits low", () => {
    // A fixed-position menu anchored below an input near the bottom of the
    // window would render off-screen with no way to scroll to it — the menu
    // follows the input. It must clamp to the room available and scroll inside.
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });
    // Input near the bottom: only ~40px below it.
    vi.spyOn(HTMLInputElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 520, bottom: 560, left: 20, right: 320, width: 300, height: 40, x: 20, y: 520,
      toJSON: () => ({}),
    } as DOMRect);

    const { getByPlaceholderText, getByText } = render(<Harness />);
    openPicker(getByPlaceholderText);
    const menu = getByText("Asha PM").closest("div[style]") as HTMLElement;

    expect(menu.style.overflowY).toBe("auto");
    const maxHeight = parseInt(menu.style.maxHeight, 10);
    const top = parseInt(menu.style.top, 10);
    // Flipped above the input rather than running off the bottom edge.
    expect(top).toBeLessThan(520);
    expect(top + maxHeight).toBeLessThanOrEqual(600);

    vi.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { value: originalHeight, configurable: true });
  });

  it("collapses again on an outside click, keeping chips visible", () => {
    const { getByPlaceholderText, getByText, queryByText, getByLabelText } = render(<Harness />);
    openPicker(getByPlaceholderText);
    fireEvent.click(getByText("Asha PM"));
    fireEvent.mouseDown(document.body);
    expect(queryByText("Binu ZM")).toBeNull();
    expect(getByLabelText("Remove Asha PM")).toBeTruthy();
  });

  it("renders every option with label and sublabel", () => {
    const { getByText, getByPlaceholderText } = render(<Harness />);
    openPicker(getByPlaceholderText);
    expect(getByText("Asha PM")).toBeTruthy();
    expect(getByText("binu@x.in")).toBeTruthy();
  });

  it("filters client-side over label and sublabel", () => {
    const { getByPlaceholderText, queryByText } = render(<Harness />);
    fireEvent.change(getByPlaceholderText("Search…"), { target: { value: "chitra@" } });
    expect(queryByText("Chitra Fellow")).toBeTruthy();
    expect(queryByText("Asha PM")).toBeNull();
  });

  it("toggles selection and renders chips with remove buttons", () => {
    const { getByText, getByPlaceholderText, getAllByRole, getByLabelText, queryByLabelText } = render(<Harness />);
    openPicker(getByPlaceholderText);
    fireEvent.click(getByText("Asha PM"));
    fireEvent.click(getByText("Binu ZM"));
    // Two chips (each with an aria-labelled remove button) + checked boxes.
    expect(getByLabelText("Remove Asha PM")).toBeTruthy();
    expect(getByLabelText("Remove Binu ZM")).toBeTruthy();
    const checked = getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked);
    expect(checked).toHaveLength(2);

    fireEvent.click(getByLabelText("Remove Asha PM"));
    expect(queryByLabelText("Remove Asha PM")).toBeNull();
  });

  it("keeps a selected chip renderable after the options list no longer contains it", () => {
    // Server-search mode narrows `options` on every query; a selection made
    // under an earlier query must not lose its label.
    function ServerHarness() {
      const [value, setValue] = useState<string[]>([]);
      const [options, setOptions] = useState(OPTIONS);
      return (
        <SearchMultiPicker
          options={options}
          value={value}
          onChange={setValue}
          placeholder="Search…"
          onQueryChange={(q) =>
            setOptions(OPTIONS.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())))
          }
        />
      );
    }
    const { getByText, getByPlaceholderText, getByLabelText } = render(<ServerHarness />);
    openPicker(getByPlaceholderText);
    fireEvent.click(getByText("Asha PM"));
    fireEvent.change(getByPlaceholderText("Search…"), { target: { value: "binu" } });
    // Asha is gone from options, but her chip must survive.
    expect(getByLabelText("Remove Asha PM")).toBeTruthy();
  });

  it("reports the query instead of filtering when onQueryChange is set", () => {
    const onQueryChange = vi.fn();
    const { getByPlaceholderText, queryByText } = render(<Harness onQueryChange={onQueryChange} />);
    fireEvent.change(getByPlaceholderText("Search…"), { target: { value: "zzz" } });
    expect(onQueryChange).toHaveBeenCalledWith("zzz");
    // No client filtering: all options remain (parent owns narrowing).
    expect(queryByText("Asha PM")).toBeTruthy();
  });
});
