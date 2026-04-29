import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_TOKEN_COOKIE_NAME } from "./lib/auth-session";

const isClerkEnabled = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "clerk";
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

/**
 * Next.js 16 proxy for route protection.
 *
 * - Clerk mode: Uses clerkMiddleware() to enforce authentication on /dashboard/* routes.
 * - Custom mode: Checks for the opengradhub_token cookie and redirects to / if absent.
 */

function customAuthProxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value;

  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/", request.url);
  return NextResponse.redirect(loginUrl);
}

export default isClerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : customAuthProxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
