"use client";

import React from 'react';

type WidgetSkeletonProps = {
  variant: 'stat' | 'chart' | 'list';
};

export default function WidgetSkeleton({ variant }: WidgetSkeletonProps) {
  if (variant === 'stat') {
    return (
      <div
        data-variant="stat"
        className="rounded-[24px] bg-white p-6 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
      >
        <div className="h-8 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-3 w-24 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }
  if (variant === 'chart') {
    return (
      <div
        data-variant="chart"
        className="rounded-[24px] bg-white p-6 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
      >
        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-48 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }
  return (
    <div
      data-variant="list"
      className="rounded-[24px] bg-white p-6 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
    >
      <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
      <div className="mt-4 space-y-2">
        <div className="h-8 animate-pulse rounded bg-slate-100" />
        <div className="h-8 animate-pulse rounded bg-slate-100" />
        <div className="h-8 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
