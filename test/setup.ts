import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// ── Next.js navigation mocks ──────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement('a', { href, ...props }, children),
}));

// ── Clerk mocks ───────────────────────────────────────────────────────────────
// Tests that need specific Clerk state should override these per-test with vi.mocked().

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: 'test-user-id',
    getToken: vi.fn().mockResolvedValue('test-token'),
  }),
  useClerk: () => ({ signOut: vi.fn() }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  auth: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
  currentUser: vi.fn().mockResolvedValue(null),
}));
