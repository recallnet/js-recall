import { useQuery, useQueryClient } from "@tanstack/react-query";
import { simulateContract, waitForTransactionReceipt } from "@wagmi/core";
import { useCallback, useMemo, useState } from "react";
import { Hex, encodePacked, keccak256 } from "viem";

import { RewardAllocationAbi } from "@/abi/RewardAllocation";
import { config as publicConfig } from "@/config/public";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { clientConfig } from "@/wagmi-config";

import {
  useSafeAccount,
  useSafeReadContracts,
  useSafeWriteContract,
} from "./useSafeWagmi";

type ClaimItem = {
  merkleRoot: string;
  amount: string; // wei string
  proof: string[];
};

/**
 * Claim operation result type
 */
export type ClaimOperationResult = {
  claims: ClaimItem[];
  totalClaimable: bigint;
  claim: (item?: ClaimItem) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  transactionHash: `0x${string}` | undefined;
};

/**
 * Hook for claiming rewards
 * @returns Claim operation result with transaction hash and state
 */
export function useClaim(): ClaimOperationResult {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { address } = useSafeAccount();
  const queryClient = useQueryClient();
  const config = clientConfig;

  const {
    writeContract,
    isPending,
    error,
    data: transactionHash,
    reset,
  } = useSafeWriteContract();

  const { data: allClaims } = useQuery<ClaimItem[]>(
    tanstackClient.rewards.getClaimData.queryOptions({
      enabled: Boolean(address),
    }),
  );

  // Create contract calls to check if each claim has been claimed
  const contracts = useMemo(() => {
    if (!allClaims || !address) return [];

    return allClaims.map((claim) => {
      const leaf = createLeafNode(address as Hex, BigInt(claim.amount));
      return {
        address: publicConfig.blockchain.rewardAllocationContractAddress as Hex,
        abi: RewardAllocationAbi,
        functionName: "hasClaimedLeaf" as const,
        args: [claim.merkleRoot as Hex, leaf] as const,
        chainId: publicConfig.blockchain.chain.id,
      };
    });
  }, [allClaims, address]);

  const { data: claimedStatus, queryKey: claimedStatusQueryKey } =
    useSafeReadContracts({
      contracts,
      query: {
        enabled: contracts.length > 0,
      },
    });

  // Filter out claims that have already been claimed
  const claims = useMemo(() => {
    if (!allClaims || !claimedStatus) return [];

    return allClaims.filter((_, index) => {
      const result = claimedStatus[index];
      // If the result is successful and the value is false, the claim hasn't been claimed yet
      return result?.status === "success" && result.result === false;
    });
  }, [allClaims, claimedStatus]);

  const totalClaimable = useMemo(() => {
    if (!claims || claims.length === 0) return 0n;
    return claims.reduce((acc, c) => acc + BigInt(c.amount), 0n);
  }, [claims]);

  const refetchQueries = async (txHash: `0x${string}`) => {
    const transactionReceipt = await waitForTransactionReceipt(
      clientConfig as any,
      {
        hash: txHash,
        pollingInterval: 1000,
      },
    );

    if (transactionReceipt.status === "success") {
      setIsConfirmed(true);
      setIsConfirming(false);
      queryClient.invalidateQueries({
        queryKey: tanstackClient.rewards.getClaimData.key(),
      });
      queryClient.invalidateQueries({
        queryKey: claimedStatusQueryKey,
      });
    }
  };

  // Execute function that simulates before claiming
  const claim = useCallback(
    async (item?: ClaimItem) => {
      try {
        const target = item ?? claims?.[0];
        if (!target) throw new Error("No claimable rewards");

        // Reset the write contract hook
        reset();

        const root = target.merkleRoot as Hex;
        const amount = BigInt(target.amount);
        const proof = target.proof as Hex[];

        // First simulate the transaction
        const simulationResult = await simulateContract(config as any, {
          address: publicConfig.blockchain
            .rewardAllocationContractAddress as Hex,
          abi: RewardAllocationAbi,
          functionName: "claim",
          args: [root, amount, proof],
          account: address,
        });

        // If simulation succeeds, execute the actual transaction
        writeContract(simulationResult.request, {
          onSuccess: (txHash) => {
            refetchQueries(txHash);
          },
          onError: (error) => {
            setIsConfirming(false);
            throw new Error(error.message);
          },
        });
        setIsConfirming(true);
      } catch (simulationError) {
        setIsConfirming(false);
        // Re-throw simulation errors with a clear message
        throw new Error(
          `Transaction simulation failed: ${simulationError instanceof Error ? simulationError.message : "Unknown error"}`,
        );
      }
    },
    [claims, writeContract, config, address, reset, refetchQueries],
  );

  return useMemo(
    () => ({
      claims: claims ?? [],
      totalClaimable,
      claim,
      isPending,
      isConfirming,
      isConfirmed,
      error,
      transactionHash,
    }),
    [
      claims,
      totalClaimable,
      claim,
      isPending,
      isConfirming,
      isConfirmed,
      error,
      transactionHash,
    ],
  );
}

/**
 * Creates a Merkle leaf node by hashing reward data
 * @param address The recipient's Ethereum address
 * @param amount The reward amount as a bigint
 * @returns Buffer containing the keccak256 hash of the encoded parameters
 */
export function createLeafNode(address: Hex, amount: bigint): Hex {
  return keccak256(
    encodePacked(["string", "address", "uint256"], ["rl", address, amount]),
  );
}
