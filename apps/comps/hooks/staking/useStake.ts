"use client";

import { useQueryClient } from "@tanstack/react-query";
import { simulateContract, waitForTransactionReceipt } from "@wagmi/core";
import { useCallback, useMemo, useState } from "react";

import { StakingAbi } from "@/abi/Staking";
import { clientConfig } from "@/wagmi-config";

import { useRecall } from "../useRecall";
import { useSafeAccount, useSafeWriteContract } from "../useSafeWagmi";
import { useStakingContractAddress } from "./useStakingContractAddress";
import { useTotalUserStaked } from "./useTotalUserStaked";
import { useUserStakes } from "./useUserStakes";

/**
 * Base hook result type for individual staking operations
 */
export type StakingOperationResult = {
  execute: (amount: bigint, duration: bigint) => Promise<void>;
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
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const contractAddress = useStakingContractAddress();
  const { address } = useSafeAccount();
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
  } = useSafeWriteContract();

  const refetchQueries = useCallback(
    async (txHash: `0x${string}`) => {
      const transactionReceipt = await waitForTransactionReceipt(clientConfig, {
        hash: txHash,
        pollingInterval: 1000,
        confirmations: 2,
      });

      if (transactionReceipt.status === "success") {
        setIsConfirmed(true);
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
    },
    [
      queryClient,
      recallQueryKey,
      getUserStakesQueryKey,
      getTotalUserStakedQueryKey,
    ],
  );

  // Enhanced execute function that simulates before executing
  const execute = useCallback(
    async (amount: bigint, duration: bigint) => {
      try {
        if (!contractAddress) {
          throw new Error("Contract address not available");
        }
        // Resets the write contract hook
        reset();

        // First simulate the transaction using the core action
        const simulationResult = await simulateContract(config, {
          address: contractAddress,
          abi: StakingAbi,
          functionName: "stake",
          args: [amount, duration],
          account: address,
        });

        // If simulation succeeds, use the request data for the actual transaction
        writeContract(simulationResult.request, {
          onSuccess: (txHash) => {
            refetchQueries(txHash);
          },
        });
        setIsConfirming(true);
      } catch (simulationError) {
        // Re-throw simulation errors with a clear message
        throw new Error(
          `Transaction simulation failed: ${simulationError instanceof Error ? simulationError.message : "Unknown error"}`,
        );
      }
    },
    [writeContract, config, contractAddress, address, reset, refetchQueries],
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
