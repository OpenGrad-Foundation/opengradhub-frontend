import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from '../lib/push/use-push';

describe('urlBase64ToUint8Array', () => {
  it('decodes a URL-safe base64 VAPID key to bytes', () => {
    const out = urlBase64ToUint8Array('BJxNr-AB_cd');
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(0);
  });

  it('handles URL-safe chars (- and _) without throwing', () => {
    expect(() => urlBase64ToUint8Array('a-b_c-d_')).not.toThrow();
  });
});
