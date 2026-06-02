"use client";

import React from 'react';
import Link from 'next/link';

type IconType = 'doubt' | 'quiz' | 'live' | 'review' | 'system';

type TaskItemProps = {
  icon: IconType;
  title: string;
  subtitle?: string;
  actionHref: string;
  actionLabel: string;
};

const ICONS: Record<IconType, string> = {
  doubt: '❓',
  quiz: '📝',
  live: '🎥',
  review: '🔍',
  system: '⚙️',
};

export default function TaskItem({ icon, title, subtitle, actionHref, actionLabel }: TaskItemProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3 flex-1">
        <span aria-hidden className="text-base leading-none">{ICONS[icon]}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--dark-teal)]">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <Link
        href={actionHref}
        className="shrink-0 rounded-full bg-[var(--teal)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
