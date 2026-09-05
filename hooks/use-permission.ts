"use client";

import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * PBAC client-side gate.
 *
 * Reads the caller's effective permission set from `GET /users/me` (cached by
 * `useCurrentUser`). Mirrors the backend `PermissionsGuard`: every caller,
 * including SUPER_ADMIN, must hold the code in their effective set
 * (role grants ∪ user ALLOW − user DENY).
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

  // `isSuperAdmin` is still reported, because a few screens legitimately want to
  // SAY "you are an admin". It no longer decides what anyone may do.
  const isSuperAdmin = data?.role?.code === SUPER_ADMIN;
  const granted = new Set(data?.permissions ?? []);

  // No role short-circuit. `has` used to return true for any SUPER_ADMIN
  // regardless of their permissions -- the frontend mirror of the wildcard that
  // was removed from PermissionsGuard, and the same contradiction of "PBAC is
  // the source of truth": the screen would offer an action the API then refused,
  // or keep offering one after the permission was revoked.
  //
  // A super admin now holds every route permission explicitly (101 of them,
  // covering all 94 guarded routes; src/auth/scope/sa-coverage.spec.ts fails the
  // backend build if that stops being true), so this is the same answer arrived
  // at honestly.
  const has = (code: string) => granted.has(code);
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
