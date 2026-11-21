'use client';

import { useCallback, useSyncExternalStore } from 'react';

export function useRetryCountdown(retryAt: number | undefined) {
  const remaining = useCallback(
    () => retryAt === undefined ? 0 : Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000)),
    [retryAt],
  );
  const subscribe = useCallback((onChange: () => void) => {
    if (!remaining()) return () => {};
    const timer = setInterval(() => {
      onChange();
      if (!remaining()) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [remaining]);

  return useSyncExternalStore(subscribe, remaining, () => 0);
}
