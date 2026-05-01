import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_TOKEN_COOKIE_NAME, isClerkMode } from "./lib/auth-session";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

function getCustomLoginState(request: NextRequest) {
  if (USE_MOCK) {
    return true;
  }

  return Boolean(request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value);
}

function handleRouteRedirects(request: NextRequest, isLoggedIn: boolean) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return null;
}

export default isClerkMode()
  ? clerkMiddleware(async (auth, req) => {
      const { userId } = await auth();
      const isLoggedIn = USE_MOCK || Boolean(userId);
      const redirectResponse = handleRouteRedirects(req, isLoggedIn);

      if (redirectResponse) {
        return redirectResponse;
      }

      if (!USE_MOCK && isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : (request: NextRequest) =>
      handleRouteRedirects(request, getCustomLoginState(request)) ?? NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
