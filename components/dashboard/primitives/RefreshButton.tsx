"use client";

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

type RefreshButtonProps = {
  queryKey: readonly unknown[];
};

export default function RefreshButton({ queryKey }: RefreshButtonProps) {
  const qc = useQueryClient();
  return (
    <button
      type="button"
      aria-label="Refresh"
      onClick={() => qc.invalidateQueries({ queryKey: [...queryKey] })}
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
    >
      Refresh
    </button>
  );
}
