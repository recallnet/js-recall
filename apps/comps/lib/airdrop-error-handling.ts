import * as Sentry from "@sentry/nextjs";

/**
 * Error types that can occur during airdrop claim operations
 */
export type AirdropClaimErrorType =
  | "user_rejected"
  | "already_claimed"
  | "invalid_duration"
  | "invalid_proof"
  | "invalid_signature"
  | "signature_required"
  | "contract_paused"
  | "incorrect_fee"
  | "staking_unavailable"
  | "staking_failed"
  | "insufficient_gas"
  | "network_error"
  | "contract_error"
  | "unknown_error";

/**
 * User-friendly error messages for different airdrop claim error types
 */
const AIRDROP_ERROR_MESSAGES: Record<AirdropClaimErrorType, string> = {
  user_rejected:
    "Transaction was cancelled. Please try again if you want to proceed.",
  already_claimed:
    "You have already claimed this reward. Each reward can only be claimed once.",
  invalid_duration:
    "The selected staking duration is not available. Please select a different duration.",
  invalid_proof:
    "Your claim could not be verified. Please refresh the page and try again.",
  invalid_signature:
    "Signature verification failed. Please refresh the page and try again.",
  signature_required:
    "A signature is required to claim. Please refresh the page and try again.",
  contract_paused: "Claims are temporarily paused. Please try again later.",
  incorrect_fee:
    "The transaction fee amount is incorrect. Please refresh and try again.",
  staking_unavailable:
    "Staking is currently unavailable. Please try claiming without staking or try again later.",
  staking_failed:
    "Staking failed after claiming. Please contact support if your tokens are missing.",
  insufficient_gas:
    "Insufficient funds for gas. Please add more ETH to your wallet.",
  network_error:
    "Network error occurred. Please check your connection and try again.",
  contract_error:
    "Smart contract error. Please try again or contact support if the issue persists.",
  unknown_error:
    "An unexpected error occurred. Please try again or contact support if the issue persists.",
};

/**
 * Contract error names from the Airdrop smart contract mapped to error types
 */
const CONTRACT_ERROR_MAP: Record<string, AirdropClaimErrorType> = {
  // Core claim errors
  AlreadyClaimed: "already_claimed",
  InvalidDuration: "invalid_duration",
  InvalidProof: "invalid_proof",
  InvalidSignature: "invalid_signature",
  SignatureRequired: "signature_required",

  // Fee/value errors
  IncorrectMsgValue: "incorrect_fee",

  // Staking errors
  StakingToZeroAddressNotAllowed: "staking_unavailable",
  StakingAmountMismatch: "staking_failed",
  StakingFailed: "staking_failed",

  // Access control
  Unauthorized: "contract_error",

  // Contract state errors
  EnforcedPause: "contract_paused",
  ExpectedPause: "contract_error",

  // General errors
  ZeroAmount: "contract_error",
  ZeroAddress: "contract_error",
  InsufficientBalance: "contract_error",
  ReentrancyGuardReentrantCall: "contract_error",
  FailedCall: "contract_error",

  // ERC20 errors
  SafeERC20FailedOperation: "contract_error",

  // ECDSA errors
  ECDSAInvalidSignature: "invalid_signature",
  ECDSAInvalidSignatureLength: "invalid_signature",
  ECDSAInvalidSignatureS: "invalid_signature",
};

/**
 * Extracts the contract error name from a viem/wagmi error message
 * @param message - The error message from viem/wagmi
 * @returns The contract error name if found, undefined otherwise
 */
function extractContractErrorName(message: string): string | undefined {
  // Pattern 1: "reverted with the following reason: ErrorName()"
  const revertReasonMatch = message.match(
    /reverted with the following reason:\s*(\w+)/i,
  );
  if (revertReasonMatch?.[1]) {
    return revertReasonMatch[1];
  }

  // Pattern 2: "Error: ErrorName()" or "error: ErrorName"
  const errorNameMatch = message.match(/(?:Error|error):\s*(\w+)/);
  if (errorNameMatch?.[1]) {
    return errorNameMatch[1];
  }

  // Pattern 3: Contract error selector - look for known error names directly
  for (const errorName of Object.keys(CONTRACT_ERROR_MAP)) {
    if (message.includes(errorName)) {
      return errorName;
    }
  }

  return undefined;
}

/**
 * Maps an error to a user-friendly error type
 * @param error - The error from the contract call
 * @returns The categorized error type
 */
function categorizeAirdropError(error: Error): AirdropClaimErrorType {
  const message = error.message.toLowerCase();
  const originalMessage = error.message;
  const code = (error as Error & { code?: string | number }).code;

  // User rejection (wallet cancellation)
  if (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request") ||
    code === 4001 ||
    code === "ACTION_REJECTED"
  ) {
    return "user_rejected";
  }

  // Check for specific contract errors first (case-sensitive in original message)
  const contractErrorName = extractContractErrorName(originalMessage);
  if (contractErrorName && CONTRACT_ERROR_MAP[contractErrorName]) {
    return CONTRACT_ERROR_MAP[contractErrorName];
  }

  // Insufficient gas/funds
  if (
    message.includes("insufficient funds") ||
    message.includes("insufficient balance for gas") ||
    message.includes("not enough funds")
  ) {
    return "insufficient_gas";
  }

  // Network errors
  if (
    message.includes("network error") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch")
  ) {
    return "network_error";
  }

  // Generic contract errors
  if (
    message.includes("execution reverted") ||
    message.includes("revert") ||
    message.includes("call exception")
  ) {
    return "contract_error";
  }

  return "unknown_error";
}

/**
 * Context information for error logging
 */
interface AirdropErrorContext {
  operation: string;
  season?: number;
  amount?: string;
  duration?: string;
  userAddress?: string;
  chainId?: number;
  additionalData?: Record<string, unknown>;
}

/**
 * Handles airdrop claim errors by categorizing them, logging to Sentry, and returning user-friendly messages
 * @param error - The error that occurred
 * @param context - Additional context about the operation that failed
 * @returns User-friendly error message
 */
export function handleAirdropClaimError(
  error: Error,
  context: AirdropErrorContext,
): string {
  const errorType = categorizeAirdropError(error);
  const userMessage = AIRDROP_ERROR_MESSAGES[errorType];

  // Log full error details to Sentry with context
  Sentry.captureException(error, {
    tags: {
      errorType,
      operation: context.operation,
      component: "ConvictionStakeModal",
    },
    extra: {
      season: context.season,
      amount: context.amount,
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
 * Parses an airdrop claim error and returns a user-friendly message without logging to Sentry
 * @param error - The error from the contract call
 * @returns User-friendly error message
 */
export function parseAirdropClaimError(error: Error | null): string | null {
  if (!error) return null;

  const errorType = categorizeAirdropError(error);
  return AIRDROP_ERROR_MESSAGES[errorType];
}

/**
 * Gets the error type for an airdrop claim error
 * @param error - The error from the contract call
 * @returns The categorized error type
 */
export function getAirdropClaimErrorType(
  error: Error | null,
): AirdropClaimErrorType | null {
  if (!error) return null;
  return categorizeAirdropError(error);
}
