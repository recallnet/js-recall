import { useQuery } from "@tanstack/react-query";
import { toDate } from "date-fns";
import { useMemo } from "react";
import { useAccount } from "wagmi";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { ConvictionClaimData } from "@/types/conviction-claims";
import { formatAmount } from "@/utils/format";

/**
 * Helper function to calculate days remaining until a date
 */
function getDaysRemaining(targetDate: Date | string, now: Date): number {
  const date = toDate(targetDate);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Format status text based on claim type
 */
function getStatusText(claim: ConvictionClaimData, now: Date): string {
  switch (claim.type) {
    case "available": {
      const daysRemaining = getDaysRemaining(claim.expiresAt, now);
      if (daysRemaining === 0) {
        return "Expires today";
      }
      if (daysRemaining === 1) {
        return "1 day to claim";
      }
      return `${daysRemaining} days to claim`;
    }
    case "claimed-and-staked": {
      const daysRemaining = getDaysRemaining(claim.unlocksAt, now);
      if (daysRemaining === 0) {
        return "Unlocked";
      }
      return `Unlocks in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`;
    }
    case "claimed-and-not-staked":
      return "Claimed";
    case "expired":
      return "Expired";
    case "ineligible":
      return claim.ineligibleReason;
    default:
      return "Unknown";
  }
}

/**
 * Format tooltip text based on claim type
 */
function getTooltipText(claim: ConvictionClaimData): string {
  switch (claim.type) {
    case "available": {
      const date = toDate(claim.expiresAt);
      return `Claim before ${date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    case "claimed-and-staked": {
      const date = toDate(claim.unlocksAt);
      return `Unlocks on ${date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    case "claimed-and-not-staked": {
      const date = toDate(claim.claimedAt);
      return `Claimed on ${date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    case "expired": {
      const date = toDate(claim.expiredAt);
      return `Expired on ${date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    case "ineligible":
      return claim.ineligibleReason;
    default:
      return "";
  }
}

/**
 * Get action text based on claim type
 */
function getActionText(claim: ConvictionClaimData): string {
  switch (claim.type) {
    case "available":
      return "Claim";
    case "claimed-and-staked":
      return "Staked";
    case "claimed-and-not-staked":
      return "Claimed";
    case "expired":
      return "Expired";
    case "ineligible":
      return "Ineligible";
    default:
      return "Unknown";
  }
}

export type FormattedConvictionClaim = ConvictionClaimData & {
  formattedAmount: string;
  statusText: string;
  tooltipText: string;
  actionText: string;
  isClaimable: boolean;
};

export type ConvictionClaimsResult = {
  claims: FormattedConvictionClaim[];
  availableClaims: FormattedConvictionClaim[];
  totalClaimable: bigint;
  totalFormatted: string;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook for fetching and formatting conviction claims data
 */
export function useConvictionClaims(): ConvictionClaimsResult {
  const { address } = useAccount();

  const {
    data: claimsData,
    isLoading,
    error,
  } = useQuery<ConvictionClaimData[], Error>(
    tanstackClient.airdrop.getClaimsData.queryOptions({
      input: { address: address ?? "" },
      enabled: Boolean(address),
    }),
  );

  const formattedClaims = useMemo<FormattedConvictionClaim[]>(() => {
    if (!claimsData || claimsData.length === 0) {
      return [];
    }

    const now = new Date();

    return claimsData.map((claim) => {
      let amount: bigint;
      if (claim.type === "available" || claim.type === "expired") {
        amount = claim.eligibleAmount;
      } else if (
        claim.type === "claimed-and-staked" ||
        claim.type === "claimed-and-not-staked"
      ) {
        amount = claim.claimedAmount;
      } else {
        amount = 0n;
      }

      const amountNumber = attoValueToNumberValue(amount);
      const formattedAmount = amountNumber
        ? formatAmount(amountNumber, 2, true)
        : "0.00";

      return {
        ...claim,
        formattedAmount,
        statusText: getStatusText(claim, now),
        tooltipText: getTooltipText(claim),
        actionText: getActionText(claim),
        isClaimable: claim.type === "available",
      };
    });
  }, [claimsData]);

  const availableClaims = useMemo(() => {
    return formattedClaims.filter((claim) => claim.isClaimable);
  }, [formattedClaims]);

  const totalClaimable = useMemo(() => {
    return availableClaims.reduce((acc, claim) => {
      if (claim.type === "available") {
        return acc + claim.eligibleAmount;
      }
      return acc;
    }, 0n);
  }, [availableClaims]);

  const totalFormatted = useMemo(() => {
    if (totalClaimable === 0n) {
      return "0.00";
    }

    const totalNumber = attoValueToNumberValue(totalClaimable);
    return totalNumber ? formatAmount(totalNumber, 2, true) : "0.00";
  }, [totalClaimable]);

  return {
    claims: formattedClaims ?? [],
    availableClaims: availableClaims ?? [],
    totalClaimable,
    totalFormatted,
    isLoading,
    error: error ?? null,
  };
}
