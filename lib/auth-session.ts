export const AUTH_TOKEN_COOKIE_NAME = "opengradhub_token";
const AUTH_TOKEN_STORAGE_KEY = "opengradhub_token";
const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Returns the configured authentication provider.
 * Reads from NEXT_PUBLIC_AUTH_PROVIDER env var at build time.
 */
export function getAuthProvider(): "clerk" | "custom" {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === "clerk" ? "clerk" : "custom";
}

/**
 * Returns true when the application is configured to use Clerk for authentication.
 */
export function isClerkMode(): boolean {
  return getAuthProvider() === "clerk";
}

export function getStoredAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  if (storedToken) {
    return storedToken;
  }

  const cookieToken = readCookieValue(AUTH_TOKEN_COOKIE_NAME);

  if (cookieToken) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, cookieToken);
  }

  return cookieToken;
}

export function persistAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = [
    `${AUTH_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${AUTH_TOKEN_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    secureFlag,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearStoredAuthToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}
