"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { StakingAbi } from "@/abi/Staking";

import { useRecall } from "../useRecall";
import {
  useSafeWaitForTransactionReceipt,
  useSafeWriteContract,
} from "../useSafeWagmi";
import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Base hook result type for individual staking operations
 */
export type StakingOperationResult = {
  execute: (
    tokenId: bigint,
    newLockDuration: bigint,
    newLockAmount?: bigint,
  ) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  transactionHash: `0x${string}` | undefined;
};

/**
 * Hook for relocking staked tokens
 * @returns Relock operation result with transaction hash and state
 */
export const useRelock = (): StakingOperationResult => {
  const contractAddress = useStakingContractAddress();
  const { queryKey: recallQueryKey } = useRecall();
  const queryClient = useQueryClient();

  const {
    writeContract,
    isPending,
    error,
    data: transactionHash,
  } = useSafeWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useSafeWaitForTransactionReceipt({
      hash: transactionHash,
    });

  const execute = useCallback(
    async (
      tokenId: bigint,
      newLockDuration: bigint,
      newLockAmount?: bigint,
    ) => {
      if (!contractAddress) {
        throw new Error("Contract address not available");
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
      // Invalidate staking-related queries
      queryClient.invalidateQueries({
        queryKey: ["readContract", contractAddress, "getUserStakes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["readContract", contractAddress, "totalUserStaked"],
      });
      queryClient.invalidateQueries({ queryKey: recallQueryKey });
      lastConfirmedHashRef.current = transactionHash;
    }
  }, [
    isConfirmed,
    transactionHash,
    queryClient,
    contractAddress,
    recallQueryKey,
  ]);

  return useMemo(
    () => ({
      execute,
      isPending,
      isConfirming,
      isConfirmed,
      error,
      transactionHash,
    }),
    [execute, isPending, isConfirming, isConfirmed, error, transactionHash],
  );
};
