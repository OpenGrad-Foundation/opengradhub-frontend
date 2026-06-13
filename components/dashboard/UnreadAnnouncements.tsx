"use client";

import React from "react";
import Link from "next/link";
import ListCard from "@/components/dashboard/primitives/ListCard";
import FeedItem from "@/components/dashboard/primitives/FeedItem";
import { useAnnouncements } from "@/lib/queries/announcements";

const MAX_VISIBLE = 2;

/**
 * Overview widget: surfaces the caller's newest unread announcements (max 2).
 * Renders nothing when there are no unread items so it never clutters a quiet
 * dashboard. Server already filters /announcements to the caller's role and
 * stamps is_read per user, so we only slice the client side.
 */
export default function UnreadAnnouncements({ role }: { role: string }) {
  const { data, isLoading } = useAnnouncements(role);

  const unread = (data ?? []).filter((a) => !a.is_read);
  const visible = unread.slice(0, MAX_VISIBLE);

  // Skip the card entirely while loading or when nothing is unread.
  if (isLoading || visible.length === 0) return null;

  return (
    <ListCard title="Unread announcements">
      {visible.map((a) => (
        <FeedItem
          key={a.id}
          icon="announcement"
          text={a.title}
          timestamp={new Date(a.created_at).toLocaleString()}
          href="/dashboard/inbox"
        />
      ))}
      {unread.length > MAX_VISIBLE && (
        <Link
          href="/dashboard/inbox"
          className="block px-2 pt-1 text-xs font-semibold text-[var(--dark-teal)] hover:underline"
        >
          +{unread.length - MAX_VISIBLE} more in inbox
        </Link>
      )}
    </ListCard>
  );
}
