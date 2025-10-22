import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WriteContractErrorType, simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo } from "react";
import { Hex, encodeFunctionData, encodePacked, keccak256 } from "viem";

import { RewardAllocationAbi } from "@/abi/RewardAllocation";
import { config as publicConfig } from "@/config/public";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { clientConfig } from "@/wagmi-config";

import {
  useSafeAccount,
  useSafeReadContracts,
  useSafeWaitForTransactionReceipt,
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
  claim: (item: ClaimItem | ClaimItem[]) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: WriteContractErrorType | null;
  transactionHash: `0x${string}` | undefined;
};

/**
 * Hook for claiming rewards
 * @returns Claim operation result with transaction hash and state. The `claim` function accepts:
 * - `ClaimItem`: Claims a specific reward
 * - `ClaimItem[]`: Claims multiple rewards in a single multicall transaction
 */
export function useClaim(): ClaimOperationResult {
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
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useSafeWaitForTransactionReceipt({
      hash: transactionHash,
      confirmations: 2,
    });

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

  useEffect(() => {
    if (isConfirmed) {
      queryClient.invalidateQueries({
        queryKey: claimedStatusQueryKey,
      });
    }
  }, [isConfirmed, claimedStatusQueryKey, queryClient]);

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

  // Execute function that simulates before claiming
  const claim = useCallback(
    async (item: ClaimItem | ClaimItem[]) => {
      // Normalize input to array of targets
      const targets = Array.isArray(item) ? item : [item];

      // Reset the write contract hook
      reset();

      // Use multicall for multiple claims
      if (targets.length > 1) {
        const encodedCalls = targets.map((t) =>
          encodeFunctionData({
            abi: RewardAllocationAbi,
            functionName: "claim",
            args: [t.merkleRoot as Hex, BigInt(t.amount), t.proof as Hex[]],
          }),
        );

        // Simulate the multicall transaction
        const simulationResult = await simulateContract(config as any, {
          address: publicConfig.blockchain
            .rewardAllocationContractAddress as Hex,
          abi: RewardAllocationAbi,
          functionName: "multicall",
          args: [encodedCalls],
          account: address,
        });

        // If simulation succeeds, execute the actual transaction
        writeContract(simulationResult.request);

        return;
      }

      // Single claim path
      const target = targets[0];
      if (!target) throw new Error("No claimable rewards");

      const root = target.merkleRoot as Hex;
      const amount = BigInt(target.amount);
      const proof = target.proof as Hex[];

      // First simulate the transaction
      const simulationResult = await simulateContract(config as any, {
        address: publicConfig.blockchain.rewardAllocationContractAddress as Hex,
        abi: RewardAllocationAbi,
        functionName: "claim",
        args: [root, amount, proof],
        account: address,
      });

      // If simulation succeeds, execute the actual transaction
      writeContract(simulationResult.request);
    },
    [writeContract, config, address, reset],
  );

  // @ts-expect-error - error is not typed correctly
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
