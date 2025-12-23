/**
 * Types for conviction airdrop allocations data
 * These types mirror the AllocationData types from packages/services/src/airdrop.service.ts
 */

export type BaseAllocation = {
  airdrop: number;
  airdropName: string;
};

export type AvailableAllocation = BaseAllocation & {
  type: "available";
  eligibleAmount: bigint;
  expiresAt: Date;
  proof: string[];
};

export type ClaimedAndStakedAllocation = BaseAllocation & {
  type: "claimed-and-staked";
  eligibleAmount: bigint;
  claimedAmount: bigint;
  stakeDuration: number;
  claimedAt: Date;
  unlocksAt: Date;
};

export type ClaimedAndNotStakedAllocation = BaseAllocation & {
  type: "claimed-and-not-staked";
  eligibleAmount: bigint;
  claimedAmount: bigint;
  claimedAt: Date;
};

export type ExpiredAllocation = BaseAllocation & {
  type: "expired";
  eligibleAmount: bigint;
  expiredAt: Date;
};

export type IneligibleAllocation = BaseAllocation & {
  type: "ineligible";
  ineligibleReason: string;
  ineligibleAmount: bigint;
};

export type AllocationData =
  | AvailableAllocation
  | ClaimedAndStakedAllocation
  | ClaimedAndNotStakedAllocation
  | ExpiredAllocation
  | IneligibleAllocation;
