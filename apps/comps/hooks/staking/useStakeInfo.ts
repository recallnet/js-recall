"use client";

import { StakingAbi } from "@/abi/Staking";

import { useSafeReadContract } from "../useSafeWagmi";
import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Hook to get stake info for a specific token ID
 * @param tokenId - The token ID to get stake info for
 * @returns Read contract result with stake info
 */
export const useStakeInfo = (tokenId: bigint) => {
  const contractAddress = useStakingContractAddress();

  return useSafeReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "stakeInfo",
    args: [tokenId],
    query: { enabled: Boolean(contractAddress) },
  });
};
