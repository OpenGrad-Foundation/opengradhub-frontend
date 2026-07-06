/** Idempotent: registering the same /sw.js twice returns the existing registration
 *  and rolls out an updated worker to existing subscribers. Safe to call every load. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}
