import type {
  CurrentUserResponse,
  SignInPayload,
  SignInResponse,
  SignUpPayload,
  SignUpResponse,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch the current user's profile from the backend.
 *
 * @param token - The bearer token to send. In custom mode this is the local JWT;
 *                in Clerk mode this is the Clerk session token from useAuth().getToken().
 */
export async function fetchCurrentUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;

  const errorMessage =
      errorBody?.message ??
      (response.status === 401
        ? "Your session is not valid anymore. Please sign in again."
        : "We could not load your local OpenGradHub profile.");

    throw new ApiError(errorMessage, response.status);
  }

  return (await response.json()) as CurrentUserResponse;
}

export async function signIn(payload: SignInPayload) {
  return postJson<SignInResponse>("/auth/sign-in", payload);
}

export async function signUp(payload: SignUpPayload) {
  return postJson<SignUpResponse>("/auth/sign-up", payload);
}

async function postJson<TResponse>(
  path: string,
  payload: SignInPayload | SignUpPayload,
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { message?: string | string[] } | null;

    const message = Array.isArray(errorBody?.message)
      ? errorBody.message[0]
      : errorBody?.message ?? "The request could not be completed.";

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as TResponse;
}
