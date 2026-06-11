'use client';

import { usePathname, useSearchParams } from 'next/navigation';

/** Current pathname + query string, suitable as the `currentUrl` arg of `withFrom`. */
export function useCurrentUrl(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
