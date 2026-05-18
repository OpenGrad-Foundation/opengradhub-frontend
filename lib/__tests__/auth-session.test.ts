import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// auth-session reads window.localStorage and document.cookie at runtime,
// both of which jsdom provides.

describe('getAuthProvider / isClerkMode', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AUTH_PROVIDER;

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = originalEnv;
    vi.resetModules();
  });

  it('returns "clerk" when NEXT_PUBLIC_AUTH_PROVIDER is "clerk"', async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    const { getAuthProvider, isClerkMode } = await import('../auth-session');
    expect(getAuthProvider()).toBe('clerk');
    expect(isClerkMode()).toBe(true);
  });

  it('returns "custom" for any other value', async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'custom';
    const { getAuthProvider, isClerkMode } = await import('../auth-session');
    expect(getAuthProvider()).toBe('custom');
    expect(isClerkMode()).toBe(false);
  });

  it('returns "custom" when env var is not set', async () => {
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
    const { getAuthProvider, isClerkMode } = await import('../auth-session');
    expect(getAuthProvider()).toBe('custom');
    expect(isClerkMode()).toBe(false);
  });
});

describe('persistAuthToken / getStoredAuthToken / clearStoredAuthToken', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'opengradhub_token=; Path=/; Max-Age=0';
  });

  it('persists a token to localStorage', async () => {
    const { persistAuthToken, getStoredAuthToken } = await import('../auth-session');
    persistAuthToken('test-jwt-abc');
    expect(getStoredAuthToken()).toBe('test-jwt-abc');
    expect(localStorage.getItem('opengradhub_token')).toBe('test-jwt-abc');
  });

  it('clearStoredAuthToken removes the token from localStorage', async () => {
    const { persistAuthToken, clearStoredAuthToken, getStoredAuthToken } =
      await import('../auth-session');
    persistAuthToken('test-jwt-abc');
    clearStoredAuthToken();
    expect(getStoredAuthToken()).toBeNull();
    expect(localStorage.getItem('opengradhub_token')).toBeNull();
  });

  it('getStoredAuthToken returns null when nothing is stored', async () => {
    const { getStoredAuthToken } = await import('../auth-session');
    expect(getStoredAuthToken()).toBeNull();
  });
});
