"use client";

import { useState } from "react";
import { CircleStop, Loader2 } from "lucide-react";
import { useUpdateTrackerTemplate } from "@/lib/queries/tracker";
import type { TrackerTemplate } from "@/lib/tracker-api";

/** What people see for a task's status. "archived" is the stored value for an ended task. */
export const TEMPLATE_STATUS_LABEL: Record<TrackerTemplate["status"], string> = {
  draft: "Draft", active: "Active", archived: "Ended",
};

/** Ends a task that is no longer needed: it leaves every active list and stops making new
 *  recurring rows, but keeps all data, and can be restored from Manage tasks › Ended. */
export function EndTaskButton({ templateId, name, onEnded }: { templateId: string; name: string; onEnded: () => void }) {
  const [open, setOpen] = useState(false);
  const end = useUpdateTrackerTemplate(templateId);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
        <CircleStop className="h-4 w-4" aria-hidden="true" /> End task
      </button>
      {open && (
        <div role="dialog" aria-label={`End ${name}`} className="absolute right-0 top-full z-20 mt-2 flex w-80 flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left shadow-lg">
          <div>
            <p className="text-sm font-semibold text-amber-900">End “{name}”?</p>
            <p className="mt-1 text-sm text-amber-800">It leaves every active task list and stops creating new recurring entries. All data and history are kept, and you can restore it from Manage tasks › Ended.</p>
          </div>
          {end.isError && <p className="text-sm text-red-700">{end.error instanceof Error ? end.error.message : "Could not end this task."}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={end.isPending}
              onClick={async () => { try { await end.mutateAsync({ status: "archived" }); setOpen(false); onEnded(); } catch { /* surfaced above */ } }}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {end.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} End task
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={end.isPending} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
