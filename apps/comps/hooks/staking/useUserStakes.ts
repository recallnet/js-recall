"use client";

import { StakingAbi } from "@/abi/Staking";

import { useSafeAccount, useSafeReadContract } from "../useSafeWagmi";
import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Hook to get user stakes data
 * @returns Read contract result with user stakes
 */
export const useUserStakes = () => {
  const { address, isConnected } = useSafeAccount();
  const contractAddress = useStakingContractAddress();

  return useSafeReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "getUserStakes",
    args: [address!],
    query: { enabled: isConnected && Boolean(contractAddress) },
  });
};
