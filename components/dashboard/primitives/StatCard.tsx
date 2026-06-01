"use client";

import React from 'react';

type StatCardProps = {
  label: string;
  value: number | string | null;
  helperText?: string;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export default function StatCard({
  label,
  value,
  helperText,
  delta,
  isLoading,
  error,
  onRetry,
}: StatCardProps) {
  const display = value === null || value === undefined ? '—' : String(value);

  return (
    <div className="relative rounded-[24px] bg-white px-6 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
      {isLoading ? (
        <div data-testid="stat-skeleton" className="h-12 animate-pulse rounded bg-slate-100" />
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-rose-600">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="text-[32px] font-semibold text-[var(--dark-teal)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {display}
          </div>
          {delta && (
            <div
              className={`mt-1 text-xs font-semibold ${
                delta.direction === 'up'
                  ? 'text-emerald-600'
                  : delta.direction === 'down'
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {delta.value}
            </div>
          )}
          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(3,72,82,0.6)]">
            {label}
          </div>
          {helperText && (
            <div className="mt-2 text-xs text-slate-500">{helperText}</div>
          )}
        </>
      )}
    </div>
  );
}
