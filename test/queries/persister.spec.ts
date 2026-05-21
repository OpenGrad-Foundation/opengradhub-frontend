import { describe, it, expect, beforeEach } from 'vitest';
import { idbGet, idbSet, idbDel, APP_VERSION } from '../../lib/queries/persister';

describe('IDB persister store', () => {
  beforeEach(async () => {
    await idbDel('test:key');
  });

  it('round-trips a value through IndexedDB', async () => {
    await idbSet('test:key', { hello: 'world' });
    expect(await idbGet('test:key')).toEqual({ hello: 'world' });
  });

  it('returns undefined for a missing key', async () => {
    expect(await idbGet('test:missing')).toBeUndefined();
  });

  it('del removes a key', async () => {
    await idbSet('test:key', 1);
    await idbDel('test:key');
    expect(await idbGet('test:key')).toBeUndefined();
  });

  it('exposes a non-empty APP_VERSION string used as the persister buster', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});
