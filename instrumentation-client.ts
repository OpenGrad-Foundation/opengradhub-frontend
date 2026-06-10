import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: isDev ? 0 : 0.1,
  debug: false,
  integrations: isDev ? [] : [Sentry.replayIntegration()],
  replaysSessionSampleRate: isDev ? 0 : 0.1,
  replaysOnErrorSampleRate: isDev ? 0 : 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
