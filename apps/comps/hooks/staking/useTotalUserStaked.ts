"use client";

import { StakingAbi } from "@/abi/Staking";

import { useSafeAccount, useSafeReadContract } from "../useSafeWagmi";
import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Hook to get total staked amount for the current user
 * @returns Read contract result with total user staked amount
 */
export const useTotalUserStaked = () => {
  const { address, isConnected } = useSafeAccount();
  const contractAddress = useStakingContractAddress();

  return useSafeReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "totalUserStaked",
    args: [address!],
    query: { enabled: isConnected && Boolean(contractAddress) },
  });
};
