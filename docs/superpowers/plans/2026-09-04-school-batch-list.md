# School page: batch list instead of batch accordion — Implementation Plan

> **For agentic workers:** Implement this plan task by task, tests first. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the school detail page, replace the collapsible per-batch roster accordion with a plain list of batches whose rows navigate to that batch's own page (the Batches tab), and show the school's full student roster in one flat table.

**Architecture:** The batch list becomes its own presentational component, `SchoolBatchList`, in the school-detail folder, so it can be unit-tested without mounting the whole page (which needs Clerk, permissions, params and three panels). `app/dashboard/schools/[id]/page.tsx` renders it above the roster and loses all accordion state. Each batch row is a Next `<Link>` to `/dashboard/batches/<id>` carrying `?from=` via the existing `withFrom` helper, so the batch page's BackLink returns to the school.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, vitest + @testing-library/react (jsdom project matches `test/**/*.spec.tsx`), npm.

**Spec:** This document. User decisions captured up front:
- Batch rosters are no longer shown inline on the school page at all; they live on the batch page.
- The school page's Students table shows the **full school roster** (`detail.students`) in one table — no "Not in any batch" split.
- Branch target: cut from `main` (this worktree is already `feat/school-batch-list` off `main`).

## Global Constraints

- Package manager is **npm** only (`package-lock.json`). Never run pnpm/yarn.
- No prettier or other formatters. Match the surrounding code style exactly: inline `React.CSSProperties` style objects, double quotes, 2-space indent, trailing semicolons.
- Do **not** run `git add` and do **not** commit. Claude commits.
- Do not touch any path outside this worktree.
- Only these files may change:
  - Create `app/dashboard/schools/[id]/SchoolBatchList.tsx`
  - Create `test/school-batch-list.spec.tsx`
  - Modify `app/dashboard/schools/[id]/page.tsx`
- Existing shared styles live in `app/dashboard/schools/styles.ts` (import as `../styles` from the `[id]` folder). Do not edit that file.
- Labels/copy: batch rows must not invent new terminology. "Batches", "student"/"students", "View batch".

---

### Task 1: `SchoolBatchList` component + its tests

**Files:**
- Create: `app/dashboard/schools/[id]/SchoolBatchList.tsx`
- Test: `test/school-batch-list.spec.tsx`

**Interfaces:**
- Consumes: `withFrom(href, currentUrl)` from `@/lib/nav`; `titleStyle` from `../styles`; the `batches` element type of `SchoolRosterDetail` in `@/lib/api` (`{ id: string; name: string; programme_type: string | null; students: SchoolRosterStudent[] }`).
- Produces: `export function SchoolBatchList({ batches, currentUrl }: { batches: SchoolRosterDetail["batches"]; currentUrl: string })` — used by Task 2.

- [ ] **Step 1: Write the failing test**

Create `test/school-batch-list.spec.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SchoolBatchList } from "@/app/dashboard/schools/[id]/SchoolBatchList";

const student = (id: string, name: string) => ({
  id, name, roll_number: null, email: null, programme: null, status: "ACTIVE",
});

const batches = [
  {
    id: "b1",
    name: "CAT Morning",
    programme_type: "CAT",
    students: [student("s1", "Asha Rao"), student("s2", "Bala K")],
  },
  { id: "b2", name: "NEET Evening", programme_type: null, students: [] },
];

const currentUrl = "/dashboard/schools/sch-1";

describe("SchoolBatchList", () => {
  it("links each batch to its own batch page, carrying the school as ?from=", () => {
    render(<SchoolBatchList batches={batches} currentUrl={currentUrl} />);

    const first = screen.getByRole("link", { name: /CAT Morning/ });
    expect(first.getAttribute("href")).toBe(
      `/dashboard/batches/b1?from=${encodeURIComponent(currentUrl)}`,
    );
    expect(
      screen.getByRole("link", { name: /NEET Evening/ }).getAttribute("href"),
    ).toBe(`/dashboard/batches/b2?from=${encodeURIComponent(currentUrl)}`);
  });

  it("shows the programme and the member count on each row", () => {
    render(<SchoolBatchList batches={batches} currentUrl={currentUrl} />);

    expect(screen.getByText("CAT")).toBeTruthy();
    expect(screen.getByText("2 students")).toBeTruthy();
    expect(screen.getByText("0 students")).toBeTruthy();
  });

  it("is a flat list: no expand control and no inline roster", () => {
    const { container } = render(
      <SchoolBatchList batches={batches} currentUrl={currentUrl} />,
    );

    expect(container.querySelector("[aria-expanded]")).toBeNull();
    expect(screen.queryByText("Asha Rao")).toBeNull();
    expect(screen.queryByText("Bala K")).toBeNull();
  });

  it("says so when the school hosts no batches", () => {
    render(<SchoolBatchList batches={[]} currentUrl={currentUrl} />);

    expect(screen.getByText(/no batches at this school yet/i)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run test/school-batch-list.spec.tsx`
Expected: FAIL — cannot resolve `@/app/dashboard/schools/[id]/SchoolBatchList`.

- [ ] **Step 3: Write the component**

Create `app/dashboard/schools/[id]/SchoolBatchList.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { SchoolRosterDetail } from "@/lib/api";
import { withFrom } from "@/lib/nav";
import { titleStyle } from "../styles";

/**
 * ACTIVE batches hosted at this school, as a flat list.
 *
 * This used to be an accordion that unfolded each batch's roster in place. The
 * batch page already owns that roster (and the enrol/remove controls that go
 * with it), so the school page names the batches and hands off: a whole row is
 * one link, and `withFrom` makes the batch page's BackLink return here.
 */
export function SchoolBatchList({
  batches,
  currentUrl,
}: {
  batches: SchoolRosterDetail["batches"];
  currentUrl: string;
}) {
  if (batches.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "14px", color: "rgba(3,72,82,0.5)" }}>
        No batches at this school yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {batches.map((b) => (
        <Link key={b.id} href={withFrom(`/dashboard/batches/${b.id}`, currentUrl)} style={rowStyle}>
          <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ ...titleStyle, fontSize: "16px" }}>{b.name}</span>
            {b.programme_type && <span style={chipStyle}>{b.programme_type}</span>}
            <span style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)" }}>
              {b.students.length} student{b.students.length === 1 ? "" : "s"}
            </span>
          </span>
          <span aria-hidden="true" style={{ fontSize: "13px", fontWeight: 700, color: "#0abe62" }}>
            View batch →
          </span>
        </Link>
      ))}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  padding: "14px 18px",
  borderRadius: "14px",
  border: "1px solid rgba(3,72,82,0.08)",
  background: "#fff",
  textDecoration: "none",
  color: "inherit",
};

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "999px",
  background: "rgba(3,72,82,0.06)",
  fontSize: "12px",
  fontWeight: 600,
  color: "#034852",
};
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run test/school-batch-list.spec.tsx`
Expected: PASS, 4 tests.

If `titleStyle` spread onto a `<span>` brings a block-level `margin`, that is fine visually here, but if a test fails on accessible-name matching (`getByRole("link", { name: /CAT Morning/ })`), do not change the assertion — check that the name, chip and count are all inside the anchor.

- [ ] **Step 5: Stop. Do not commit.**

---

### Task 2: School page renders the list and one flat roster

**Files:**
- Modify: `app/dashboard/schools/[id]/page.tsx`

**Interfaces:**
- Consumes: `SchoolBatchList` from Task 1.
- Produces: nothing further.

- [ ] **Step 1: Delete the accordion state**

In `app/dashboard/schools/[id]/page.tsx`, remove:
- the `expanded` state and its comment (`// Collapsed-by-default accordion. Keys: batch ids + "unbatched".` + `const [expanded, setExpanded] = useState<Set<string>>(new Set());`)
- the whole `function toggleSection(key: string) { ... }`
- the derived `batchedIds` and `unbatched` consts near `const schoolStudentIds = ...`
- the module-level `sectionHeaderStyle` const at the bottom of the file (nothing else uses it — verify with `grep -n "sectionHeaderStyle" app/dashboard/schools/\[id\]/page.tsx` before deleting).

- [ ] **Step 2: Import the new component**

Add next to the other local imports (`AddStudentsPanel`, `AttachBatchPanel`, `AttendancePanel`):

```tsx
import { SchoolBatchList } from "./SchoolBatchList";
```

- [ ] **Step 3: Replace the two accordion blocks and re-title the roster**

Replace the region that currently starts at the `{/* Roster */}` comment and ends just before the `{/* Committed register attendance ... */}` comment with:

```tsx
      {/* Batches hosted at this school. The roster of each one lives on the
          batch page, so a row is a link, not a disclosure. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h2 style={{ ...titleStyle, fontSize: "18px", margin: 0 }}>
          Batches ({detail.batches.length})
        </h2>
        {canAttachBatch && (
          <button onClick={() => setShowAddBatch(true)} style={secondaryButton}>+ Add Batch</button>
        )}
      </div>

      {showAddBatch && (
        <AttachBatchPanel
          schoolId={school.id}
          schoolName={school.name}
          onClose={() => setShowAddBatch(false)}
          onChanged={() => void load()}
        />
      )}

      <div style={{ marginBottom: "24px" }}>
        <SchoolBatchList batches={detail.batches} currentUrl={currentUrl} />
      </div>

      {/* Roster: every student of this school, batched or not. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h2 style={{ ...titleStyle, fontSize: "18px", margin: 0 }}>
          Students ({stats.student_count})
        </h2>
        {canEditRoster && (
          <button onClick={() => setShowAdd(true)} style={primaryButton}>+ Add Students</button>
        )}
      </div>

      {rosterError && (
        <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px" }}>{rosterError}</p>
      )}

      <RosterTable
        rows={students}
        emptyMessage="No students assigned to this school yet."
        {...tableProps}
      />
```

Note what this deliberately keeps: `showAddBatch`/`AttachBatchPanel`, `rosterError`, `tableProps`, `AddStudentsPanel`, `AttendancePanel`, and the `RosterTable` component itself (its `schoolStudentIds` guard still matters — leave `RosterTable` untouched).

- [ ] **Step 4: Drop imports that are now unused**

`Link` and `withFrom` were used only by the accordion header's "View batch →" link. Check both with grep; remove `import Link from "next/link";` and the `withFrom` import **only if** no other usage remains. `useCurrentUrl`/`currentUrl` is still used — it is passed to `SchoolBatchList`. `linkBtnStyle` is still used by `RosterTable`.

- [ ] **Step 5: Run the gates**

Run each, in this order, and report the output verbatim for any that fail:

```bash
npx tsc --noEmit
npm run lint
npm test
```

Expected: `tsc` clean; `eslint` reports no errors for the changed files (pre-existing warnings elsewhere are acceptable — say so if any appear); vitest all green.

- [ ] **Step 6: Stop. Do not commit.**

---

## Report back

Last message, in this order:
1. Files changed.
2. Each gate command with pass/fail and the failing lines verbatim.
3. Deviations from this plan, with reasons.
4. Anything you could not verify.
