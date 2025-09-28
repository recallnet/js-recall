// Shared Sentry types
export interface SentryTransactionContext {
  name?: string;
}

export interface SentrySamplingContext {
  transactionContext?: SentryTransactionContext;
  name?: string;
}
