"use client";

import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * PBAC client-side gate.
 *
 * Reads the caller's effective permission set from `GET /users/me` (cached by
 * `useCurrentUser`). Mirrors the backend `PermissionsGuard`: SUPER_ADMIN holds
 * every permission implicitly (wildcard), everyone else must have the code in
 * their effective set (role grants ∪ user ALLOW − user DENY).
 *
 * This is UI affordance only — the real enforcement is the backend guard.
 * Hiding a button you can't use is a courtesy, not a security boundary.
 */

const SUPER_ADMIN = "SUPER_ADMIN";

export function usePermissions(): {
  has: (code: string) => boolean;
  hasAny: (...codes: string[]) => boolean;
  hasAll: (...codes: string[]) => boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
} {
  const { data, isLoading } = useCurrentUser();

  const isSuperAdmin = data?.role?.code === SUPER_ADMIN;
  const granted = new Set(data?.permissions ?? []);

  const has = (code: string) => isSuperAdmin || granted.has(code);
  const hasAny = (...codes: string[]) => codes.some(has);
  const hasAll = (...codes: string[]) => codes.every(has);

  return { has, hasAny, hasAll, isSuperAdmin, isLoading };
}

/** Convenience: does the current user hold this permission code? */
export function usePermission(code: string): boolean {
  return usePermissions().has(code);
}

/** Convenience: does the current user hold ANY of these permission codes? */
export function useAnyPermission(...codes: string[]): boolean {
  return usePermissions().hasAny(...codes);
}
