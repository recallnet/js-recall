"use client";

import { useReadContract } from "wagmi";

import { StakingAbi } from "@/abi/Staking";

import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Hook to get stake info for a specific token ID
 * @param tokenId - The token ID to get stake info for
 * @returns Read contract result with stake info
 */
export const useStakeInfo = (tokenId: bigint) => {
  const contractAddress = useStakingContractAddress();

  return useReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "stakeInfo",
    args: [tokenId],
    query: { enabled: Boolean(contractAddress) },
  });
};
