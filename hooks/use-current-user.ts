"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ApiError, fetchCurrentUser } from "@/lib/api";
import { clearStoredAuthToken, getStoredAuthToken, isClerkMode } from "@/lib/auth-session";
import type { CurrentUserResponse } from "@/lib/types";

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
    let isMounted = true;

    async function load() {
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

      if (!token) {
        if (isMounted) {
          setState({
            data: null,
            error: "Please sign in to continue.",
            isLoading: false,
          });
        }
        return;
      }

      try {
        const data = await fetchCurrentUser(token);

        if (isMounted) {
          setState({
            data,
            error: null,
            isLoading: false,
          });
        }
      } catch (error) {
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
