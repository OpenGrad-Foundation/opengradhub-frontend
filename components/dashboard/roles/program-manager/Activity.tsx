"use client";

import Link from "next/link";
import styles from "@/components/dashboard/workspace.module.css";
import { useDoubtsActivity } from "@/lib/queries/dashboard/_doubts-activity";
import WidgetError from "@/components/dashboard/primitives/WidgetError";

export default function PMActivity({ userId }: { userId: string }) {
  const { items, isLoading, error, refetch } = useDoubtsActivity("PROGRAM_MANAGER", userId);
  return (
    <section aria-labelledby="activity-heading" className="w-full">
      <div className="flex items-center justify-between gap-4 pb-4">
        <div>
          <h2 id="activity-heading" className="text-lg font-semibold text-[var(--color-text)]">Recent activity</h2>
        </div>
        <button type="button" onClick={refetch} aria-label="Refresh activity" className={styles.utilityButton}>Refresh</button>
      </div>
      <div>
        {isLoading ? <p role="status" className="py-8 text-sm text-[var(--color-text-muted)]">Loading activity…</p>
          : error ? <WidgetError compact message={error} onRetry={refetch} />
          : items.length === 0 ? <p className="py-8 text-sm text-[var(--color-text-muted)]">No activity yet. New doubts and announcements will appear here.</p>
          : <ul className="space-y-4">
            {items.map((item, index) => {
              const announcement = item.kind === "announcement";
              return (
                <li key={`${item.ts}-${index}`}>
                  <Link href={item.href} className={styles.actionCard}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                        <span>{announcement ? "Announcement" : "Student doubt"}</span>
                        <time dateTime={item.ts}>{new Date(item.ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
                      </div>
                      <p className="mt-2 break-words text-sm font-medium leading-relaxed text-[var(--color-text)]">{item.text}</p>
                    </div>
                    <span aria-hidden="true" className={styles.actionArrow}>→</span>
                  </Link>
                </li>
              );
            })}
          </ul>}
      </div>
    </section>
  );
}
