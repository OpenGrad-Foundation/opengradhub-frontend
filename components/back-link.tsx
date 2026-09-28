'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { getBackHref } from '@/lib/nav';

type BackLinkProps = {
  /** Canonical parent route used when no valid `from` param is present. */
  fallback: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/** Back button that returns to the validated `?from=` origin, else `fallback`. */
export function BackLink({ fallback, style, children }: BackLinkProps) {
  const from = useSearchParams().get('from');
  return (
    <Link href={getBackHref(from, fallback)} style={style}>
      {children ?? '← Back'}
    </Link>
  );
}
