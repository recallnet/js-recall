"use client";

import { useAccount, useReadContract } from "wagmi";

import { StakingAbi } from "@/abi/Staking";

import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Hook to get user stakes data
 * @returns Read contract result with user stakes
 */
export const useUserStakes = () => {
  const { address, isConnected } = useAccount();
  const contractAddress = useStakingContractAddress();

  return useReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "getUserStakes",
    args: [address!],
    query: { enabled: isConnected && Boolean(contractAddress) },
  });
};
