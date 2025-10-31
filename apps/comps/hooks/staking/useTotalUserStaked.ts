"use client";

import { useAccount, useReadContract } from "wagmi";

import { StakingAbi } from "@/abi/Staking";

import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Hook to get total staked amount for the current user
 * @returns Read contract result with total user staked amount
 */
export const useTotalUserStaked = () => {
  const { address, isConnected } = useAccount();
  const contractAddress = useStakingContractAddress();

  return useReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "totalUserStaked",
    args: [address!],
    query: { enabled: isConnected && Boolean(contractAddress) },
  });
};
