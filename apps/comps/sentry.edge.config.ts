import * as Sentry from "@sentry/nextjs";

import {
  createClientBeforeSend,
  createSentryConfig,
  createTracesSampler,
} from "./lib/sentry-config";

const sentryConfig = createSentryConfig();

Sentry.init({
  dsn: sentryConfig.dsn,
  environment: sentryConfig.environment,
  tracesSampler: createTracesSampler(sentryConfig),
  beforeSend: createClientBeforeSend(),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
