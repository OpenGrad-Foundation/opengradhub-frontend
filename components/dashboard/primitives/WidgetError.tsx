"use client";

import React from 'react';

type WidgetErrorProps = {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
};

export default function WidgetError({ message, onRetry, compact }: WidgetErrorProps) {
  return (
    <div role="alert" className={compact ? "flex flex-wrap items-center justify-between gap-3 py-4" : "rounded-[24px] bg-rose-50 p-6 text-center"}>
      <p className="text-sm text-rose-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={compact ? "min-h-11 rounded-lg px-4 text-sm font-medium text-[var(--teal)] hover:bg-[var(--color-info-surface)]" : "mt-3 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white"}
        >
          Retry
        </button>
      )}
    </div>
  );
}
