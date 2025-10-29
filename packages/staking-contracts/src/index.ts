// Re-export all types and classes from the staking-contracts package

// Core interfaces and types
export type {
  AllocationResult,
  RewardsAllocator,
} from "./rewards-allocator.js";
export type { ClaimResult } from "./rewards-claimer.js";
export type { SafeTransactionProposerConfig } from "./safe-transaction-proposer.js";

// Classes
export { NoopRewardsAllocator } from "./rewards-allocator.js";
export { default as RewardsClaimer } from "./rewards-claimer.js";
export { SafeTransactionProposer } from "./safe-transaction-proposer.js";
export { ExternallyOwnedAccountAllocator } from "./externally-owner-account.js";

// Network types and utilities
export { Network, getChainForNetwork } from "./network.js";

// ABI
export { abi } from "./abi.js";
