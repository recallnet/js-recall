"use client";

import { useMemo } from "react";
import { type Address, getAddress } from "viem";
import { useChainId } from "wagmi";

import { config } from "@/config/public";

/**
 * Hook to get the staking contract address for the current chain
 * @returns The contract address for the current chain, or undefined if unsupported
 */
export const useStakingContractAddress = (): Address | undefined => {
  const chainId = useChainId();

  return useMemo(() => {
    if (!chainId) {
      return undefined;
    }
    const addressHex = config.blockchain.stakingContractAddress;

    if (!addressHex) {
      throw new Error("Staking contract address not found");
    }

    return getAddress(addressHex);
  }, [chainId]);
};
