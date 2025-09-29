// Shared Sentry types for frontend
export interface SentryTransactionContext {
  name?: string;
}

export interface SentrySamplingContext {
  transactionContext?: SentryTransactionContext;
  name?: string;
}
