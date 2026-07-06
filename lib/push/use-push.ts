'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPushPublicKey, savePushSubscription, deletePushSubscription } from '@/lib/api';
import { registerServiceWorker } from './register-sw';

/** Convert a URL-safe base64 VAPID key into the Uint8Array applicationServerKey wants.
 *  Backed by an explicit ArrayBuffer so the type is the BufferSource pushManager expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIosLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /ipad|iphone|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function usePush() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [isIosNeedsInstall, setIsIosNeedsInstall] = useState(false);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    setIsIosNeedsInstall(!ok && isIosLike() && !isStandalone());
    if (!ok) return;
    setPermission(Notification.permission);
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        setSubscribed(!!sub);
        // Rebind any existing subscription to the CURRENT auth user. On a shared
        // browser / profile switch the same endpoint may still be bound to a
        // previous user server-side; re-POST so the server upsert reassigns it.
        if (sub) {
          try {
            await savePushSubscription(sub.toJSON() as PushSubscriptionJSON, navigator.userAgent);
          } catch {
            /* best-effort — enable() re-saves on explicit toggle */
          }
        }
      })
      .catch(() => undefined);
  }, []);

  const enable = useCallback(async () => {
    const key = await getPushPublicKey();
    if (!key) throw new Error('Push is not configured on the server');
    const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await savePushSubscription(sub.toJSON() as PushSubscriptionJSON, navigator.userAgent);
    setPermission(Notification.permission);
    setSubscribed(true);
  }, []);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, []);

  return { supported, permission, subscribed, isIosNeedsInstall, enable, disable };
}
