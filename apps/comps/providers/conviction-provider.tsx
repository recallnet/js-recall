"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAccount } from "wagmi";

import { AirdropExpiredModal } from "@/components/modals/airdrop-expired";
import { AirdropExpiringModal } from "@/components/modals/airdrop-expiring";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { ConvictionClaimData } from "@/types/conviction-claims";

/**
 * Number of days before expiration to trigger the "expiring soon" modal
 */
const EXPIRING_SOON_THRESHOLD_DAYS = 7;

/**
 * Number of days after expiration to show the "recently expired" modal
 */
const RECENTLY_EXPIRED_THRESHOLD_DAYS = 7;

/**
 * LocalStorage key prefix for tracking dismissed modals
 */
const DISMISSED_EXPIRED_KEY_PREFIX = "conviction-expired-dismissed-";
const DISMISSED_EXPIRING_KEY_PREFIX = "conviction-expiring-dismissed-";

type ConvictionContextValue = {
  /** True if the user has any conviction claims data (non-empty response) */
  isConvictionEligible: boolean;
  /** True if claims data is loading */
  isLoading: boolean;
  /** Error from claims data fetch */
  error: Error | null;
  /** Raw claims data */
  claims: ConvictionClaimData[];
};

const ConvictionContext = createContext<ConvictionContextValue | null>(null);

/**
 * Hook to access conviction context
 */
export function useConviction(): ConvictionContextValue {
  const context = useContext(ConvictionContext);
  if (!context) {
    throw new Error("useConviction must be used within a ConvictionProvider");
  }
  return context;
}

/**
 * Safe localStorage access for SSR compatibility
 */
function getLocalStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safe localStorage write for SSR compatibility
 */
function setLocalStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if a modal for a given airdrop has been dismissed
 */
function isModalDismissed(prefix: string, airdrop: number): boolean {
  return getLocalStorageItem(`${prefix}${airdrop}`) === "true";
}

/**
 * Mark a modal for a given airdrop as dismissed
 */
function dismissModal(prefix: string, airdrop: number): void {
  setLocalStorageItem(`${prefix}${airdrop}`, "true");
}

type ConvictionProviderProps = {
  children: React.ReactNode;
};

/**
 * Provider for conviction claims data and expiration modals
 */
export function ConvictionProvider({
  children,
}: ConvictionProviderProps): React.ReactElement {
  const { address, isConnected } = useAccount();

  // Modal state
  const [expiredModalClaim, setExpiredModalClaim] =
    useState<ConvictionClaimData | null>(null);
  const [expiringModalClaim, setExpiringModalClaim] =
    useState<ConvictionClaimData | null>(null);

  // Fetch claims data
  const {
    data: claimsData,
    isLoading,
    error,
  } = useQuery<ConvictionClaimData[], Error>(
    tanstackClient.airdrop.getClaimsData.queryOptions({
      input: { address: address ?? "" },
      enabled: Boolean(address) && isConnected,
    }),
  );

  // Determine eligibility: non-empty response means eligible
  const isConvictionEligible = useMemo(() => {
    return Boolean(claimsData && claimsData.length > 0);
  }, [claimsData]);

  // Find claims that trigger modals
  useEffect(() => {
    if (!claimsData || claimsData.length === 0) return;

    const now = new Date();

    // Find recently expired claims (expired within threshold days)
    const recentlyExpiredClaim = claimsData.find((claim) => {
      if (claim.type !== "expired") return false;
      if (isModalDismissed(DISMISSED_EXPIRED_KEY_PREFIX, claim.airdrop))
        return false;

      const expiredAt = new Date(claim.expiredAt);
      const daysSinceExpired = Math.floor(
        (now.getTime() - expiredAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      return daysSinceExpired <= RECENTLY_EXPIRED_THRESHOLD_DAYS;
    });

    // Find claims expiring soon
    const expiringSoonClaim = claimsData.find((claim) => {
      if (claim.type !== "available") return false;
      if (isModalDismissed(DISMISSED_EXPIRING_KEY_PREFIX, claim.airdrop))
        return false;

      const expiresAt = new Date(claim.expiresAt);
      const daysUntilExpiration = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      return (
        daysUntilExpiration > 0 &&
        daysUntilExpiration <= EXPIRING_SOON_THRESHOLD_DAYS
      );
    });

    // Show expired modal first (higher priority), then expiring modal
    if (recentlyExpiredClaim && !expiredModalClaim) {
      setExpiredModalClaim(recentlyExpiredClaim);
    } else if (expiringSoonClaim && !expiringModalClaim && !expiredModalClaim) {
      setExpiringModalClaim(expiringSoonClaim);
    }
  }, [claimsData, expiredModalClaim, expiringModalClaim]);

  // Handle closing expired modal
  const handleCloseExpiredModal = useCallback(() => {
    if (expiredModalClaim) {
      dismissModal(DISMISSED_EXPIRED_KEY_PREFIX, expiredModalClaim.airdrop);
    }
    setExpiredModalClaim(null);
  }, [expiredModalClaim]);

  // Handle closing expiring modal
  const handleCloseExpiringModal = useCallback(() => {
    if (expiringModalClaim) {
      dismissModal(DISMISSED_EXPIRING_KEY_PREFIX, expiringModalClaim.airdrop);
    }
    setExpiringModalClaim(null);
  }, [expiringModalClaim]);

  const contextValue: ConvictionContextValue = useMemo(
    () => ({
      isConvictionEligible,
      isLoading,
      error: error ?? null,
      claims: claimsData ?? [],
    }),
    [isConvictionEligible, isLoading, error, claimsData],
  );

  return (
    <ConvictionContext.Provider value={contextValue}>
      {children}

      {/* Expired Modal */}
      {expiredModalClaim && expiredModalClaim.type === "expired" && (
        <AirdropExpiredModal
          isOpen
          onClose={handleCloseExpiredModal}
          expiredAt={new Date(expiredModalClaim.expiredAt)}
          eligibleAmount={expiredModalClaim.eligibleAmount}
        />
      )}

      {/* Expiring Soon Modal */}
      {expiringModalClaim && expiringModalClaim.type === "available" && (
        <AirdropExpiringModal
          isOpen
          onClose={handleCloseExpiringModal}
          expiresAt={new Date(expiringModalClaim.expiresAt)}
          eligibleAmount={expiringModalClaim.eligibleAmount}
        />
      )}
    </ConvictionContext.Provider>
  );
}
