"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ApiError, fetchCurrentUser, getMe, setApiAuthToken } from "@/lib/api";
import { clearStoredAuthToken, getStoredAuthToken, isClerkMode } from "@/lib/auth-session";
import type { CurrentUserResponse } from "@/lib/types";
import { mockUser } from "@/lib/mockUser";
import { roleDashboardPathByCode } from "@/lib/role-dashboard";

const USE_MOCK = false;

// ── Session cache ─────────────────────────────────────────────────────────────
// Stores the resolved user profile for the lifetime of the browser tab.
// Key is versioned so stale entries from prior deployments are ignored.

const CACHE_KEY = "opengrad_user_v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CachedUser = { data: CurrentUserResponse; expiresAt: number };

function readCache(): CurrentUserResponse | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedUser;
    if (Date.now() > cached.expiresAt) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(data: CurrentUserResponse): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL_MS }),
    );
  } catch {
    // sessionStorage full or unavailable — silently skip
  }
}

export function clearUserCache(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CACHE_KEY);
}

// ── In-flight deduplication ───────────────────────────────────────────────────
// Sidebar and DashboardPage both call useCurrentUser(). On a cold start both
// effects fire before either has a result, so without this a second identical
// network request would go out. Storing the promise at module level means the
// second caller simply awaits the request the first caller already started.

let pendingFetch: Promise<CurrentUserResponse> | null = null;

// ── Hook ──────────────────────────────────────────────────────────────────────

type UseCurrentUserState = {
  data: CurrentUserResponse | null;
  error: string | null;
  isLoading: boolean;
};

/**
 * Hook to load the current user's profile from the backend.
 *
 * - Custom mode: reads the local JWT from localStorage/cookie
 * - Clerk mode: uses useAuth().getToken() to get the Clerk session token
 *
 * Both modes call GET /users/me with the token.
 * Results are cached in sessionStorage for 10 minutes to avoid a DB round-trip
 * on every page navigation and reload within the same browser tab.
 */
export function useCurrentUser() {
  const [state, setState] = useState<UseCurrentUserState>({
    data: null,
    error: null,
    isLoading: true,
  });

  const clerkMode = isClerkMode();

  // Clerk hooks must always be called (React rules of hooks), but we only use
  // the value when clerkMode is true.
  const clerkAuth = useAuth();

  useEffect(() => {
    // Cache hit: render immediately from sessionStorage, then revalidate in the
    // background so data stays current without ever showing a loading state.
    const cached = readCache();
    const isRevalidation = cached !== null;

    if (cached) {
      setState({ data: cached, error: null, isLoading: false });
    }

    let isMounted = true;

    async function load() {
      if (USE_MOCK) {
        try {
          const safeUser = await getMe(mockUser.id);
          if (isMounted) {
            const roleCode = safeUser.role;
            const roleName = roleCode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            const mockResponse: CurrentUserResponse = {
              user: {
                id: safeUser.id,
                fullName: safeUser.name,
                email: safeUser.email,
                rollNumber: null,
                phone: safeUser.phone,
                programme: safeUser.programme_type,
                zone: safeUser.zone,
                schoolName: safeUser.school_id,
                status: safeUser.status,
              },
              role: {
                code: roleCode,
                name: roleName,
                dashboardPath: roleDashboardPathByCode[roleCode] ?? "/dashboard",
              },
              permissions: [],
              modules: [],
            };
            setState({ data: mockResponse, error: null, isLoading: false });
          }
        } catch (err) {
          if (isMounted) {
            setState({
              data: null,
              error: err instanceof Error ? err.message : "Failed to load mock user from API.",
              isLoading: false,
            });
          }
        }
        return;
      }

      let token: string | null = null;

      if (clerkMode) {
        // In Clerk mode, get the session token from Clerk.
        try {
          token = await clerkAuth.getToken();
        } catch {
          // getToken can throw if not authenticated
          token = null;
        }
      } else {
        // Custom mode: read from localStorage/cookie
        token = getStoredAuthToken();
      }

      // Store token so all subsequent apiFetch calls include the Authorization header.
      if (token) setApiAuthToken(token);

      if (!token) {
        // On background revalidation a missing token means the session expired
        // mid-session. Don't overwrite the cached data with an error — the user
        // will hit the redirect on their next navigation via middleware.
        if (!isRevalidation && isMounted) {
          setState({
            data: null,
            error: "Please sign in to continue.",
            isLoading: false,
          });
        }
        return;
      }

      try {
        // Deduplicate: if another instance already started a fetch, reuse it.
        if (!pendingFetch) {
          pendingFetch = fetchCurrentUser(token).finally(() => {
            pendingFetch = null;
          });
        }

        const data = await pendingFetch;
        writeCache(data);

        if (isMounted) {
          setState({ data, error: null, isLoading: false });
        }
      } catch (error) {
        // Silently swallow errors during background revalidation — the user
        // already has usable cached data so showing an error would be misleading.
        if (isRevalidation) return;

        if (!clerkMode && error instanceof ApiError && error.status === 401) {
          clearStoredAuthToken();
        }

        if (isMounted) {
          setState({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "We could not load your OpenGradHub user profile.",
            isLoading: false,
          });
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [clerkMode]); // clerkAuth intentionally omitted — new object ref each render would cause infinite loop

  return state;
}
