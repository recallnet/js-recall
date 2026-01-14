/**
 * Types for conviction airdrop claims data
 * These types mirror the ClaimData types from packages/services/src/airdrop.service.ts
 */

export type BaseClaim = {
  airdrop: number;
  airdropName: string;
};

export type AvailableClaim = BaseClaim & {
  type: "available";
  eligibleAmount: bigint;
  expiresAt: Date | string;
  proof: string[];
};

export type ClaimedAndStakedClaim = BaseClaim & {
  type: "claimed-and-staked";
  eligibleAmount: bigint;
  claimedAmount: bigint;
  stakeDuration: number;
  claimedAt: Date | string;
  unlocksAt: Date | string;
};

export type ClaimedAndNotStakedClaim = BaseClaim & {
  type: "claimed-and-not-staked";
  eligibleAmount: bigint;
  claimedAmount: bigint;
  claimedAt: Date | string;
};

export type ExpiredClaim = BaseClaim & {
  type: "expired";
  eligibleAmount: bigint;
  expiredAt: Date | string;
};

export type IneligibleClaim = BaseClaim & {
  type: "ineligible";
  ineligibleReason: string;
};

export type ConvictionClaimData =
  | AvailableClaim
  | ClaimedAndStakedClaim
  | ClaimedAndNotStakedClaim
  | ExpiredClaim
  | IneligibleClaim;
