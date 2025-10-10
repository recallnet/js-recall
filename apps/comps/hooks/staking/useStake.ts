"use client";

import { useQueryClient } from "@tanstack/react-query";
import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useConfig,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { StakingAbi } from "@/abi/Staking";

import { useRecall } from "../useRecall";
import { useStakingContractAddress } from "./useStakingContractAddress";

/**
 * Base hook result type for individual staking operations
 */
export type StakingOperationResult = {
  execute: (...args: any[]) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  transactionHash: `0x${string}` | undefined;
};

/**
 * Hook for staking tokens
 * @returns Staking operation result with transaction hash and state
 */
export const useStake = (): StakingOperationResult => {
  const contractAddress = useStakingContractAddress();
  const { address } = useAccount();
  const config = useConfig();
  const { queryKey: recallQueryKey } = useRecall();
  const queryClient = useQueryClient();

  const {
    writeContract,
    isPending,
    error,
    data: transactionHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: transactionHash,
    });

  // Enhanced execute function that simulates before executing
  const execute = useCallback(
    async (amount: bigint, duration: bigint) => {
      try {
        // Resets the write contract hook
        reset();

        // First simulate the transaction using the core action
        const simulationResult = await simulateContract(config as any, {
          address: contractAddress,
          abi: StakingAbi,
          functionName: "stake",
          args: [amount, duration],
          account: address,
        });

        // If simulation succeeds, use the request data for the actual transaction
        writeContract(simulationResult.request);
      } catch (simulationError) {
        // Re-throw simulation errors with a clear message
        throw new Error(
          `Transaction simulation failed: ${simulationError instanceof Error ? simulationError.message : "Unknown error"}`,
        );
      }
    },
    [writeContract, config, contractAddress, address, reset],
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
