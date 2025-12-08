"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type Address, getAddress } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { StakingAbi } from "@/abi/Staking";
import { config } from "@/config/public";

import { useRecall } from "./useRecall";

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

/**
 * Hook return type for useStakingContract (write operations only)
 */
export type UseStakingContractResult = {
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

export const useStakingContract = (): UseStakingContractResult => {
  const contractAddress = useStakingContractAddress();
  const userStakesResult = useUserStakes();
  const totalUserStakedResult = useTotalUserStaked();
  const recallResult = useRecall();
  const userStakesQueryKey = userStakesResult.queryKey;
  const totalUserStakedQueryKey = totalUserStakedResult.queryKey;
  const recallQueryKey = recallResult.queryKey;
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

  const stake = useCallback(
    async (amount: bigint, duration: bigint) => {
      if (!contractAddress) {
        console.warn("Cannot stake: contract address not available");
        return;
      }
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "stake",
        args: [amount, duration],
      });
    },
    [writeContract, contractAddress],
  );

  const withdraw = useCallback(
    async (tokenId: bigint) => {
      if (!contractAddress) {
        console.warn("Cannot withdraw: contract address not available");
        return;
      }
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "withdraw",
        args: [tokenId],
      });
    },
    [writeContract, contractAddress],
  );

  const unstake = useCallback(
    async (tokenId: bigint, amountToUnstake?: bigint) => {
      if (!contractAddress) {
        console.warn("Cannot unstake: contract address not available");
        return;
      }
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
    },
    [writeContract, contractAddress],
  );

  const relock = useCallback(
    async (
      tokenId: bigint,
      newLockDuration: bigint,
      newLockAmount?: bigint,
    ) => {
      if (!contractAddress) {
        console.warn("Cannot relock: contract address not available");
        return;
      }
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
    },
    [writeContract, contractAddress],
  );

  // Invalidate queries once per confirmed transaction
  const lastConfirmedHashRef = useRef<`0x${string}` | undefined>(undefined);
  useEffect(() => {
    if (
      isConfirmed &&
      transactionHash &&
      lastConfirmedHashRef.current !== transactionHash
    ) {
      queryClient.invalidateQueries({ queryKey: userStakesQueryKey });
      queryClient.invalidateQueries({ queryKey: totalUserStakedQueryKey });
      queryClient.invalidateQueries({ queryKey: recallQueryKey });
      lastConfirmedHashRef.current = transactionHash;
    }
  }, [
    isConfirmed,
    transactionHash,
    queryClient,
    userStakesQueryKey,
    totalUserStakedQueryKey,
    recallQueryKey,
  ]);

  return useMemo(
    () => ({
      stake,
      withdraw,
      unstake,
      relock,
      isPending,
      isConfirming,
      isConfirmed,
      writeError,
      transactionHash,
    }),
    [
      stake,
      withdraw,
      unstake,
      relock,
      isPending,
      isConfirming,
      isConfirmed,
      writeError,
      transactionHash,
    ],
  );
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
    query: { enabled: Boolean(contractAddress) && tokenId !== undefined },
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
