"use client";

import React from 'react';

type WidgetErrorProps = {
  message: string;
  onRetry?: () => void;
};

export default function WidgetError({ message, onRetry }: WidgetErrorProps) {
  return (
    <div className="rounded-[24px] bg-rose-50 p-6 text-center">
      <p className="text-sm text-rose-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white"
        >
          Retry
        </button>
      )}
    </div>
  );
}
