import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchableSelect } from "@/app/dashboard/analytics/_components/SearchableSelect";

describe("SearchableSelect dropdown", () => {
  const options = [
    { value: "p1", label: "TESTEPMPROGRAMME" },
    { value: "p2", label: "TESTPROG1" },
    { value: "p3", label: "Engineering Mentorship Programme" },
  ];

  it("opens and renders options with placeholder", () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={options}
        placeholder="All programmes"
      />
    );

    // Initial state: closed
    expect(screen.queryByPlaceholderText("Search…")).toBeNull();

    // Click trigger button
    fireEvent.click(screen.getByRole("button", { name: /All programmes/ }));

    // Menu is open
    expect(screen.getByPlaceholderText("Search…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "TESTEPMPROGRAMME" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "TESTPROG1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Engineering Mentorship Programme" })).toBeTruthy();
  });

  it("filters options by search query", () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={options}
        placeholder="All programmes"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /All programmes/ }));
    const searchInput = screen.getByPlaceholderText("Search…");

    fireEvent.change(searchInput, { target: { value: "PROG1" } });
    expect(screen.getByRole("button", { name: "TESTPROG1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "TESTEPMPROGRAMME" })).toBeNull();
  });

  it("selects an option and closes the dropdown", () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={options}
        placeholder="All programmes"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /All programmes/ }));
    fireEvent.click(screen.getByRole("button", { name: "TESTEPMPROGRAMME" }));

    expect(onChange).toHaveBeenCalledWith("p1");
    expect(screen.queryByPlaceholderText("Search…")).toBeNull();
  });

  it("resets selection when placeholder is clicked", () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value="p1"
        onChange={onChange}
        options={options}
        placeholder="All programmes"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /TESTEPMPROGRAMME/ }));
    fireEvent.click(screen.getByRole("button", { name: "All programmes" }));

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.queryByPlaceholderText("Search…")).toBeNull();
  });

  it("closes on Escape key press", () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={options}
        placeholder="All programmes"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /All programmes/ }));
    expect(screen.getByPlaceholderText("Search…")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Search…")).toBeNull();
  });

  it("closes on click outside", () => {
    const onChange = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <SearchableSelect
          value=""
          onChange={onChange}
          options={options}
          placeholder="All programmes"
        />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: /All programmes/ }));
    expect(screen.getByPlaceholderText("Search…")).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByPlaceholderText("Search…")).toBeNull();
  });

  it("resets search query when closed and reopened", () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={options}
        placeholder="All programmes"
      />
    );

    // Open and type search query
    fireEvent.click(screen.getByRole("button", { name: /All programmes/ }));
    const searchInput = screen.getByPlaceholderText("Search…");
    fireEvent.change(searchInput, { target: { value: "PROG1" } });
    expect(screen.getByRole("button", { name: "TESTPROG1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "TESTEPMPROGRAMME" })).toBeNull();

    // Close via Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Search…")).toBeNull();

    // Reopen - all options should be visible again
    fireEvent.click(screen.getByRole("button", { name: /All programmes/ }));
    expect(screen.getByRole("button", { name: "TESTEPMPROGRAMME" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "TESTPROG1" })).toBeTruthy();
  });
});

