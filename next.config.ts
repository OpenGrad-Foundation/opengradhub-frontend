import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // `@sentry/node` fans out into ~20 OpenTelemetry instrumentation packages,
  // each of which loads its platform module through a computed `require()`.
  // Webpack can't resolve that statically and logs "Critical dependency: the
  // request of a dependency is an expression" for every one of them on every
  // dev compile. The require works fine at runtime, so drop the noise. Only
  // the `--webpack` dev server hits this; `next build` runs Turbopack.
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@opentelemetry[\\/]instrumentation/ },
    ];
    return config;
  },
  experimental: {
    // Next 16 ships a persistent Turbopack dev cache (default-on). On this app
    // it ballooned to a 3.7GB `.next` for ~1.4MB of source and drove the dev
    // server to OOM/freeze the machine, corrupting the cache on each crash.
    // Disable it so the `dev:turbo` path keeps Turbopack's speed without the leak.
    turbopackFileSystemCacheForDev: false,
  },
};

// Sentry's build plugin (source-map upload, code injection, `/sentry-tunnel`
// rewrite) is only needed for production builds. Applying it in dev adds build
// memory/CPU overhead for no benefit. The runtime Sentry SDK (instrumentation*.ts)
// is untouched, so dev error capture still works — events just go direct to the
// DSN instead of through the tunnel (fine locally; the console shows errors too).
const isProd = process.env.NODE_ENV === "production";

export default isProd
  ? withSentryConfig(nextConfig, {
      org: "opengrad",
      project: "opengrad-hub-fe",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      tunnelRoute: "/sentry-tunnel",
      silent: !process.env.CI,
      disableLogger: true,
    })
  : nextConfig;
