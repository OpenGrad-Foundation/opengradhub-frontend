"use client";

import React from 'react';

type EmptyStateProps = {
  helperText?: string;
};

export default function EmptyState({ helperText = '—' }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-8 text-center">
      <p className="text-sm text-slate-500">{helperText}</p>
    </div>
  );
}
