import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  // Dev tracing off: 100% server tracing in dev is wasteful overhead and is
  // unnecessary for local work (matches the client config). Errors still capture.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 0 : 0.1,
  debug: false,
});
