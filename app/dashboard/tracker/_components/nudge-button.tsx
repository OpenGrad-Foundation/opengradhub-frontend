"use client";

import { Bell, Loader2 } from "lucide-react";
import { useNudge } from "@/lib/queries/tracker";

function hoursAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function NudgeButton({
  doerId,
  templateId,
  lastNudgedAt,
  label = "Remind",
  cooldownHours = 24,
}: {
  doerId: string;
  templateId?: string;
  lastNudgedAt: string | null;
  label?: string;
  cooldownHours?: number;
}) {
  const nudge = useNudge();
  const within = lastNudgedAt != null && Date.now() - new Date(lastNudgedAt).getTime() < cooldownHours * 3600_000;

  if (within) {
    return (
      <button type="button" disabled className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-400" title={`Reminded ${hoursAgo(lastNudgedAt!)}`}>
        <Bell className="h-3.5 w-3.5" aria-hidden="true" /> Reminded {hoursAgo(lastNudgedAt!)}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); nudge.mutate({ doerId, templateId }); }}
      disabled={nudge.isPending}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
    >
      {nudge.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Bell className="h-3.5 w-3.5" aria-hidden="true" />} {label}
    </button>
  );
}
