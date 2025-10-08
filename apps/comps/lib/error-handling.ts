import * as Sentry from "@sentry/nextjs";

/**
 * Error types that can occur during staking operations
 */
export type StakingErrorType =
  | "user_rejected"
  | "insufficient_funds"
  | "insufficient_allowance"
  | "network_error"
  | "contract_error"
  | "unknown_error";

/**
 * User-friendly error messages for different error types
 */
const ERROR_MESSAGES: Record<StakingErrorType, string> = {
  user_rejected:
    "Transaction was cancelled. Please try again if you want to proceed.",
  insufficient_funds:
    "Insufficient RECALL tokens. Please check your balance and try again.",
  insufficient_allowance:
    "Token approval required. Please approve RECALL token spending first.",
  network_error:
    "Network error occurred. Please check your connection and try again.",
  contract_error:
    "Smart contract error. Please try again or contact support if the issue persists.",
  unknown_error:
    "An unexpected error occurred. Please try again or contact support if the issue persists.",
};

/**
 * Maps error messages and codes to user-friendly error types
 */
function categorizeError(error: Error): StakingErrorType {
  const message = error.message.toLowerCase();
  const code = (error as Error & { code?: string | number }).code;

  // User rejection (wallet cancellation)
  if (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected") ||
    code === 4001 ||
    code === "ACTION_REJECTED"
  ) {
    return "user_rejected";
  }

  // Insufficient funds
  if (
    message.includes("insufficient funds") ||
    message.includes("insufficient balance") ||
    message.includes("not enough") ||
    code === -32603 // Internal error often used for insufficient funds
  ) {
    return "insufficient_funds";
  }

  // Insufficient allowance
  if (
    message.includes("insufficient allowance") ||
    message.includes("allowance too low") ||
    message.includes("erc20: insufficient allowance")
  ) {
    return "insufficient_allowance";
  }

  // Network errors
  if (
    message.includes("network error") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("fetch")
  ) {
    return "network_error";
  }

  // Contract errors
  if (
    message.includes("execution reverted") ||
    message.includes("contract") ||
    message.includes("revert") ||
    code === -32603
  ) {
    return "contract_error";
  }

  return "unknown_error";
}

/**
 * Context information for error logging
 */
interface ErrorContext {
  operation: string;
  stakeAmount?: number;
  duration?: string;
  userAddress?: string;
  chainId?: number;
  additionalData?: Record<string, unknown>;
}

/**
 * Handles staking-related errors by categorizing them, logging to Sentry, and returning user-friendly messages
 * @param error - The error that occurred
 * @param context - Additional context about the operation that failed
 * @returns User-friendly error message
 */
export function handleStakingError(
  error: Error,
  context: ErrorContext,
): string {
  const errorType = categorizeError(error);
  const userMessage = ERROR_MESSAGES[errorType];

  // Log full error details to Sentry with context
  Sentry.captureException(error, {
    tags: {
      errorType,
      operation: context.operation,
      component: "StakeRecallModal",
    },
    extra: {
      stakeAmount: context.stakeAmount,
      duration: context.duration,
      userAddress: context.userAddress,
      chainId: context.chainId,
      originalMessage: error.message,
      stack: error.stack,
      ...context.additionalData,
    },
    level: "error",
  });

  return userMessage;
}

/**
 * Handles approval-related errors specifically
 * @param error - The approval error that occurred
 * @param context - Additional context about the approval operation
 * @returns User-friendly error message
 */
export function handleApprovalError(
  error: Error,
  context: Omit<ErrorContext, "operation"> & { operation?: string },
): string {
  return handleStakingError(error, {
    ...context,
    operation: context.operation || "token_approval",
  });
}

/**
 * Handles staking transaction errors specifically
 * @param error - The staking error that occurred
 * @param context - Additional context about the staking operation
 * @returns User-friendly error message
 */
export function handleStakeTransactionError(
  error: Error,
  context: Omit<ErrorContext, "operation"> & { operation?: string },
): string {
  return handleStakingError(error, {
    ...context,
    operation: context.operation || "stake_transaction",
  });
}
