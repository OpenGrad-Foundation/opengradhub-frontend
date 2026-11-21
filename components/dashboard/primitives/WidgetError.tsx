"use client";

import React from 'react';
import { useRetryCountdown } from '@/hooks/use-retry-countdown';

type WidgetErrorProps = {
  message: string;
  onRetry?: () => void;
  retryAt?: number;
  isFetching?: boolean;
};

export default function WidgetError({ message, onRetry, retryAt, isFetching }: WidgetErrorProps) {
  const seconds = useRetryCountdown(retryAt);
  return (
    <div className="rounded-[24px] bg-rose-50 p-6 text-center">
      <p className="text-sm text-rose-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isFetching || seconds > 0}
          className="mt-3 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60"
        >
          {seconds > 0 ? `Retry in ${seconds} s` : isFetching ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}
