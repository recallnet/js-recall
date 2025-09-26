import * as Sentry from "@sentry/nextjs";

import {
  createSentryConfig,
  createServerBeforeSend,
  createTracesSampler,
} from "./lib/sentry-config";

const sentryConfig = createSentryConfig();

Sentry.init({
  dsn: sentryConfig.dsn,
  environment: sentryConfig.environment,
  tracesSampler: createTracesSampler(sentryConfig),
  beforeSend: createServerBeforeSend(),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',
});
