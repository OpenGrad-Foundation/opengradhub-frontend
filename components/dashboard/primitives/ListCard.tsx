"use client";

import React from 'react';
import EmptyState from './EmptyState';

type ListCardProps = {
  title: string;
  emptyHelper?: string;
  isLoading?: boolean;
  children?: React.ReactNode;
  plain?: boolean;
};

export default function ListCard({ title, emptyHelper, isLoading, children, plain }: ListCardProps) {
  const childArray = React.Children.toArray(children);
  const isEmpty = childArray.length === 0;

  return (
    <div className={plain ? "py-4" : "rounded-[24px] bg-white p-6 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"}>
      <h3 className={plain ? "mb-2 text-base font-semibold text-[var(--color-text)]" : "mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[rgba(3,72,82,0.6)]"}>
        {title}
      </h3>
      {isLoading ? (
        <div data-testid="list-skeleton" className="space-y-2">
          <div className="h-8 animate-pulse rounded bg-slate-100" />
          <div className="h-8 animate-pulse rounded bg-slate-100" />
          <div className="h-8 animate-pulse rounded bg-slate-100" />
        </div>
      ) : isEmpty ? (
        plain ? <p className="py-2 text-sm text-[var(--color-text-muted)]">{emptyHelper ?? 'Nothing here yet'}</p> : <EmptyState helperText={emptyHelper ?? 'Nothing here yet'} />
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
