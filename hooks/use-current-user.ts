"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ApiError, fetchCurrentUser } from "@/lib/api";
import { clearStoredAuthToken, getStoredAuthToken, isClerkMode } from "@/lib/auth-session";
import type { CurrentUserResponse } from "@/lib/types";
import { mockUser } from "@/lib/mockUser";
import { roleDashboardPathByCode } from "@/lib/role-dashboard";

const USE_MOCK = true;

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
      if (USE_MOCK) {
        if (isMounted) {
          const roleCode = mockUser.role;
          const mockResponse: CurrentUserResponse = {
            user: {
              id: mockUser.id,
              fullName: mockUser.name,
              email: null,
              rollNumber: null,
              phone: null,
              programme: mockUser.programme_type,
              zone: null,
              schoolName: null,
              status: "ACTIVE",
            },
            role: {
              code: roleCode,
              name: roleCode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              dashboardPath: roleDashboardPathByCode[roleCode] ?? "/dashboard",
            },
            permissions: [],
            modules: [],
          };
          setState({ data: mockResponse, error: null, isLoading: false });
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
