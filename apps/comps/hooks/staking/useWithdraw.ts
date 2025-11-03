"use client";

import { useQueryClient } from "@tanstack/react-query";
import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { StakingAbi } from "@/abi/Staking";
import { clientConfig } from "@/wagmi-config";

import { useRecall } from "../useRecall";
import { useStakingContractAddress } from "./useStakingContractAddress";
import { useTotalUserStaked } from "./useTotalUserStaked";
import { useUserStakes } from "./useUserStakes";

/**
 * Base hook result type for individual staking operations
 */
export type StakingOperationResult = {
  execute: (tokenId: bigint) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  transactionHash: `0x${string}` | undefined;
};

/**
 * Hook for withdrawing staked tokens
 * @returns Withdraw operation result with transaction hash and state
 */
export const useWithdraw = (): StakingOperationResult => {
  const contractAddress = useStakingContractAddress();
  const { address } = useAccount();
  const config = clientConfig;
  const { queryKey: getUserStakesQueryKey } = useUserStakes();
  const { queryKey: getTotalUserStakedQueryKey } = useTotalUserStaked();
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
      confirmations: 2,
    });

  useEffect(() => {
    if (isConfirmed) {
      queryClient.invalidateQueries({
        queryKey: recallQueryKey,
      });
      queryClient.invalidateQueries({
        queryKey: getUserStakesQueryKey,
      });
      queryClient.invalidateQueries({
        queryKey: getTotalUserStakedQueryKey,
      });
    }
  }, [
    isConfirmed,
    queryClient,
    recallQueryKey,
    getUserStakesQueryKey,
    getTotalUserStakedQueryKey,
  ]);

  const execute = useCallback(
    async (tokenId: bigint) => {
      try {
        if (!contractAddress) {
          throw new Error("Contract address not available");
        }
        // Resets the write contract hook
        reset();

        // First simulate the transaction using the core action
        const simulationResult = await simulateContract(config as any, {
          address: contractAddress,
          abi: StakingAbi,
          functionName: "withdraw",
          args: [tokenId],
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
