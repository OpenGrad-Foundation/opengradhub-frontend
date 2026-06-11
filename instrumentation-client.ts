import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

// Feedback widget is registered in dev too (so it can be exercised locally),
// but renders nothing on its own (autoInject: false) — it only opens via
// ReportBugButton. Identity comes from Sentry.setUser (see SentryUserSync),
// so the typed name/email fields are hidden.
const feedback = Sentry.feedbackIntegration({
  autoInject: false,
  showName: false,
  showEmail: false,
  enableScreenshot: true,
  colorScheme: "light",
  formTitle: "Report a bug",
  messagePlaceholder: "What went wrong? What did you expect to happen?",
  submitButtonLabel: "Send report",
});

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: isDev ? 0 : 0.1,
  debug: false,
  integrations: isDev ? [feedback] : [Sentry.replayIntegration(), feedback],
  replaysSessionSampleRate: isDev ? 0 : 0.1,
  replaysOnErrorSampleRate: isDev ? 0 : 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
