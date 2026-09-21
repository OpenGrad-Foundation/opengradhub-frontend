"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Megaphone, MessageCircle } from "lucide-react";
import styles from "@/components/dashboard/workspace.module.css";
import { useDoubtsActivity } from "@/lib/queries/dashboard/_doubts-activity";
import WidgetError from "@/components/dashboard/primitives/WidgetError";

export default function PMActivity({ userId, preview = false }: { userId: string; preview?: boolean }) {
  const { items, isLoading, error, refetch } = useDoubtsActivity("PROGRAM_MANAGER", userId);
  const headingId = preview ? "updates-heading" : "activity-heading";
  return (
    <section aria-labelledby={headingId} className={preview ? styles.activityPreview : "w-full"}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h2 id={headingId} className="text-base font-semibold text-[var(--color-text)] sm:text-lg">{preview ? "Recent updates" : "Recent activity"}</h2>
        </div>
        {preview && <Link href="/dashboard?tab=activity" aria-label="View all activity" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded text-sm font-medium text-[var(--teal)] hover:underline">View all <ArrowRight size={16} aria-hidden="true" /></Link>}
      </div>
      <div>
        {isLoading ? <p role="status" className="py-8 text-sm text-[var(--color-text-muted)]">Loading activity…</p>
          : error ? <WidgetError compact message={error} onRetry={refetch} />
          : items.length === 0 ? <p className="py-8 text-sm text-[var(--color-text-muted)]">No activity yet. New doubts and announcements will appear here.</p>
          : <ul className={preview ? "divide-y divide-[var(--color-border)]" : "space-y-4"}>
            {(preview ? items.slice(0, 3) : items).map((item, index) => {
              const announcement = item.kind === "announcement";
              return (
                <li key={`${item.ts}-${index}`}>
                  <Link href={item.href} className={`${styles.actionCard} ${preview ? styles.activityRow : ""}`}>
                    {preview && <span className={styles.updateIcon} aria-hidden="true">
                      {announcement ? <Megaphone size={18} /> : <MessageCircle size={18} />}
                    </span>}
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium leading-relaxed text-[var(--color-text)]">{item.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                        <span>{announcement ? "Announcement" : "Student doubt"}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={item.ts}>{new Date(item.ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
                      </div>
                    </div>
                    {preview ? <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" /> : <span aria-hidden="true" className={styles.actionArrow}>→</span>}
                  </Link>
                </li>
              );
            })}
          </ul>}
      </div>
    </section>
  );
}
