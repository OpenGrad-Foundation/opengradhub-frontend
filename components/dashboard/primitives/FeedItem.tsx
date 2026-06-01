"use client";

import React from 'react';
import Link from 'next/link';

type IconType = 'quiz' | 'doubt' | 'announcement' | 'live' | 'submission' | 'system';

type FeedItemProps = {
  icon: IconType;
  text: string;
  timestamp: string;
  href?: string;
};

const ICONS: Record<IconType, string> = {
  quiz: '📝',
  doubt: '❓',
  announcement: '📣',
  live: '🎥',
  submission: '✅',
  system: '⚙️',
};

export default function FeedItem({ icon, text, timestamp, href }: FeedItemProps) {
  const body = (
    <div className="flex items-start gap-3 py-2">
      <span aria-hidden className="text-base leading-none">{ICONS[icon]}</span>
      <div className="flex-1">
        <p className="text-sm text-[var(--dark-teal)]">{text}</p>
        <p className="text-xs text-slate-500">{timestamp}</p>
      </div>
    </div>
  );

  return href ? <Link href={href} className="block hover:bg-slate-50 rounded px-2">{body}</Link> : body;
}
