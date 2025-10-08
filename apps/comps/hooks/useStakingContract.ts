"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { type Address, getAddress } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { StakingAbi } from "@/abi/Staking";
import { RECALL_STAKING_CONTRACT_ADDRESS } from "@/constants";

import { useRecall } from "./useRecall";

/**
 * Hook to get the staking contract address for the current chain
 * @returns The contract address for the current chain, or undefined if unsupported
 */
export const useStakingContractAddress = (): Address => {
  const chainId = useChainId();

  return useMemo(() => {
    if (!chainId) {
      throw new Error("Chain ID not found");
    }
    const addressHex = RECALL_STAKING_CONTRACT_ADDRESS[chainId];

    if (!addressHex) {
      throw new Error("Staking contract address not found");
    }

    return getAddress(addressHex);
  }, [chainId]);
};

/**
 * Hook return type for useStakingContract (write operations only)
 */
type UseStakingContractReturn = {
  stake: (amount: bigint, duration: bigint) => Promise<void>;
  withdraw: (tokenId: bigint) => Promise<void>;
  unstake: (tokenId: bigint, amountToUnstake?: bigint) => Promise<void>;
  relock: (
    tokenId: bigint,
    newLockDuration: bigint,
    newLockAmount?: bigint,
  ) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  writeError: Error | null;
  transactionHash: `0x${string}` | undefined;
};

export const useStakingContract = (): UseStakingContractReturn => {
  const contractAddress = useStakingContractAddress();
  const { queryKey: userStakesQueryKey } = useUserStakes();
  const { queryKey: totalUserStakedQueryKey } = useTotalUserStaked();
  const { queryKey: recallQueryKey } = useRecall();
  const queryClient = useQueryClient();

  const {
    writeContract,
    isPending,
    error: writeError,
    data: transactionHash,
  } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: transactionHash,
    });

  useEffect(() => {
    if (isConfirmed) {
      queryClient.invalidateQueries({ queryKey: userStakesQueryKey });
      queryClient.invalidateQueries({ queryKey: totalUserStakedQueryKey });
      queryClient.invalidateQueries({ queryKey: recallQueryKey });
    }
  }, [
    isConfirmed,
    queryClient,
    userStakesQueryKey,
    totalUserStakedQueryKey,
    recallQueryKey,
  ]);

  const stake = async (amount: bigint, duration: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: StakingAbi,
      functionName: "stake",
      args: [amount, duration],
    });
  };

  const withdraw = async (tokenId: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: StakingAbi,
      functionName: "withdraw",
      args: [tokenId],
    });
  };

  const unstake = async (tokenId: bigint, amountToUnstake?: bigint) => {
    if (amountToUnstake !== undefined) {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "unstake",
        args: [tokenId, amountToUnstake],
      });
    } else {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "unstake",
        args: [tokenId],
      });
    }
  };

  const relock = async (
    tokenId: bigint,
    newLockDuration: bigint,
    newLockAmount?: bigint,
  ) => {
    if (newLockAmount !== undefined) {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "relock",
        args: [tokenId, newLockDuration, newLockAmount],
      });
    } else {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "relock",
        args: [tokenId, newLockDuration],
      });
    }
  };

  return {
    stake,
    withdraw,
    unstake,
    relock,
    isPending,
    isConfirming,
    isConfirmed,
    writeError,
    transactionHash,
  };
};

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
