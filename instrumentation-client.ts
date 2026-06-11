import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: 0.1, // Reduced to save quota
  debug: false,
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.0, // Disabled by default to save quota
  replaysOnErrorSampleRate: 1.0, // Only record a replay if an error actually happens
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
