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
  useSafeBlock,
  useSafeReadContracts,
  useSafeWaitForTransactionReceipt,
  useSafeWriteContract,
} from "./useSafeWagmi";

type ClaimItem = {
  merkleRoot: string;
  amount: string; // wei string
  proof: string[];
};

type AllocationInfo = {
  token: string;
  allocatedAmount: bigint;
  claimedAmount: bigint;
  startTimestamp: bigint;
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

  // Check if there are any unclaimed allocations
  const hasUnclaimed = useMemo(() => {
    if (!allClaims || !claimedStatus) return false;
    return allClaims.some((_, index) => {
      const result = claimedStatus[index];
      return result?.status === "success" && result.result === false;
    });
  }, [allClaims, claimedStatus]);

  // Fetch latest block (only when there are unclaimed allocations)
  const { data: block } = useSafeBlock({
    chainId: publicConfig.blockchain.chain.id,
    query: {
      enabled: Boolean(address) && hasUnclaimed,
      refetchInterval: 10_000,
    },
  });

  const blockTimestamp = block?.timestamp;

  // Create contract calls to fetch allocation info for each merkle root
  const allocInfoContracts = useMemo(() => {
    if (!allClaims) return [];

    return allClaims.map((claim) => ({
      address: publicConfig.blockchain.rewardAllocationContractAddress as Hex,
      abi: RewardAllocationAbi,
      functionName: "allocInfo" as const,
      args: [claim.merkleRoot as Hex] as const,
      chainId: publicConfig.blockchain.chain.id,
    }));
  }, [allClaims]);

  const { data: allocInfoResults } = useSafeReadContracts({
    contracts: allocInfoContracts,
    query: {
      enabled: allocInfoContracts.length > 0,
    },
  });

  useEffect(() => {
    if (isConfirmed) {
      queryClient.invalidateQueries({
        queryKey: claimedStatusQueryKey,
      });
    }
  }, [isConfirmed, claimedStatusQueryKey, queryClient]);

  // Filter claims based on claimed status and startTimestamp
  const { claims, notYetActiveClaims } = useMemo(() => {
    if (!allClaims || !claimedStatus || !allocInfoResults || !blockTimestamp) {
      return { claims: [], notYetActiveClaims: [] };
    }

    const eligible: ClaimItem[] = [];
    const notActive: ClaimItem[] = [];

    allClaims.forEach((claim, index) => {
      const claimedResult = claimedStatus[index];
      const allocInfoResult = allocInfoResults[index];

      // Check if claim has not been claimed yet
      const isNotClaimed =
        claimedResult?.status === "success" && claimedResult.result === false;

      if (!isNotClaimed) return;

      // Check if allocation info exists
      if (allocInfoResult?.status !== "success") return;

      const allocInfo = allocInfoResult.result as AllocationInfo;
      const isActive = blockTimestamp >= allocInfo.startTimestamp;

      if (isActive) {
        eligible.push(claim);
      } else {
        notActive.push(claim);
      }
    });

    return { claims: eligible, notYetActiveClaims: notActive };
  }, [allClaims, claimedStatus, allocInfoResults, blockTimestamp]);

  const totalClaimable = useMemo(() => {
    if (!claims || claims.length === 0) return 0n;
    return claims.reduce((acc, c) => acc + BigInt(c.amount), 0n);
  }, [claims]);

  // Execute function that simulates before claiming
  const claim = useCallback(
    async (item: ClaimItem | ClaimItem[]) => {
      // Normalize input to array of targets
      const requestedTargets = Array.isArray(item) ? item : [item];

      // Reset the write contract hook
      reset();

      // Filter to only eligible claims (claims that are in the eligible list)
      const eligibleTargets = requestedTargets.filter((target) =>
        claims.some((c) => c.merkleRoot === target.merkleRoot),
      );

      // Check if any targets are eligible
      if (eligibleTargets.length === 0) {
        const hasInactiveClaims = requestedTargets.some((target) =>
          notYetActiveClaims.some((c) => c.merkleRoot === target.merkleRoot),
        );

        if (hasInactiveClaims) {
          console.info(
            "Cannot claim rewards: claim period has not started yet",
          );
          return;
        }

        console.info("No eligible rewards to claim");
        return;
      }

      // Use multicall for multiple claims
      if (eligibleTargets.length > 1) {
        const encodedCalls = eligibleTargets.map((t) =>
          encodeFunctionData({
            abi: RewardAllocationAbi,
            functionName: "claim",
            args: [t.merkleRoot as Hex, BigInt(t.amount), t.proof as Hex[]],
          }),
        );

        // Simulate the multicall transaction
        const simulationResult = await simulateContract(config, {
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
      const target = eligibleTargets[0];
      if (!target) {
        console.info("No eligible rewards to claim");
        return;
      }

      const root = target.merkleRoot as Hex;
      const amount = BigInt(target.amount);
      const proof = target.proof as Hex[];

      // First simulate the transaction
      const simulationResult = await simulateContract(config, {
        address: publicConfig.blockchain.rewardAllocationContractAddress as Hex,
        abi: RewardAllocationAbi,
        functionName: "claim",
        args: [root, amount, proof],
        account: address,
      });

      // If simulation succeeds, execute the actual transaction
      writeContract(simulationResult.request);
    },
    [writeContract, config, address, reset, claims, notYetActiveClaims],
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
      notYetActiveClaims: notYetActiveClaims ?? [],
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
      notYetActiveClaims,
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
