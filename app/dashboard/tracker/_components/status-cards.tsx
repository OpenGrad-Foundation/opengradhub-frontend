import { TASK_STATE_META, TASK_STATE_ORDER, type StateCounts, type TaskState } from "@/lib/tracker-status";

const TONE_TEXT = {
  green: "text-emerald-700",
  gray: "text-[var(--color-text)]",
  amber: "text-amber-700",
  red: "text-red-700",
} as const;

/** Active-card ring + tint per tone (used when a card is the selected filter). */
const TONE_ACTIVE = {
  green: "ring-emerald-500 bg-emerald-50",
  gray: "ring-[var(--color-border-strong)] bg-[#eef5f3]",
  amber: "ring-amber-500 bg-amber-50",
  red: "ring-red-500 bg-red-50",
} as const;

/** Four-card status strip (Done / Pending / Overdue / Blocked). Reused by the global
 *  overview strip (counts = tasks) and the per-task drill-in (counts = targets).
 *  When `onSelect` is given the cards become filter toggles: clicking one selects that
 *  state (click again to clear), and `activeState` gets the highlighted ring. */
export function StatusCards({
  counts,
  activeState = null,
  onSelect,
}: {
  counts: StateCounts;
  activeState?: TaskState | null;
  onSelect?: (state: TaskState) => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TASK_STATE_ORDER.map((state) => {
        const meta = TASK_STATE_META[state];
        const active = activeState === state;
        const body = (
          <>
            <p className="text-xs font-medium uppercase text-[var(--color-text-muted)]">{meta.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${TONE_TEXT[meta.tone]}`}>{counts[state]}</p>
          </>
        );
        if (!onSelect) {
          return (
            <div key={state} className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
              {body}
            </div>
          );
        }
        return (
          <button
            key={state}
            type="button"
            onClick={() => onSelect(state)}
            aria-pressed={active}
            className={
              "rounded-xl border px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--teal)] " +
              (active
                ? `border-transparent ring-2 ${TONE_ACTIVE[meta.tone]}`
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-border-strong)] hover:bg-[#eef5f3]")
            }
          >
            {body}
          </button>
        );
      })}
    </section>
  );
}
