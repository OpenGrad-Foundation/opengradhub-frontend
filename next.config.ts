import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "opengrad",
  project: "opengrad-hub-fe",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/sentry-tunnel",
  silent: !process.env.CI,
});
