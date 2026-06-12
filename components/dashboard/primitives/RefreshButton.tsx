"use client";

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

type RefreshButtonProps = {
  queryKey: readonly unknown[];
  /**
   * Hook-level refetch from the widget's query. Invalidation alone skips
   * disabled queries (enabled: false), so pass this to guarantee a fetch.
   */
  onRefresh?: () => unknown;
};

export default function RefreshButton({ queryKey, onRefresh }: RefreshButtonProps) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      // Hold the busy state for at least 500ms — widget refetches often
      // resolve instantly (same data), which made the button look dead.
      await Promise.all([
        qc.invalidateQueries({ queryKey: [...queryKey] }),
        onRefresh?.(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label="Refresh"
      aria-busy={busy}
      disabled={busy}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw size={12} className={busy ? 'animate-spin' : undefined} />
      {busy ? 'Refreshing' : 'Refresh'}
    </button>
  );
}
