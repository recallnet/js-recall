import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Hex } from "viem";
import {
  useAccount,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  WriteContractErrorType,
  readContract,
  simulateContract,
} from "wagmi/actions";

import { AirdropABI } from "@/abi/Airdrop";
import { config as publicConfig } from "@/config/public";
import {
  AirdropClaimErrorType,
  getAirdropClaimErrorType,
  parseAirdropClaimError,
} from "@/lib/airdrop-error-handling";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { AvailableAllocation } from "@/types/conviction-claims";
import { clientConfig } from "@/wagmi-config";

type AirdropClaimItem = AvailableAllocation & {
  signature?: Hex;
};

/**
 * Airdrop claim operation result type
 */
export type AirdropClaimOperationResult = {
  claim: (item: AirdropClaimItem, duration: bigint) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: WriteContractErrorType | Error | null;
  errorMessage: string | null;
  errorType: AirdropClaimErrorType | null;
  transactionHash: `0x${string}` | undefined;
  nativeFeeAmount: bigint;
};

/**
 * Hook for claiming airdrop rewards
 * @returns Airdrop claim operation result with transaction hash and state
 */
export function useAirdropClaim(): AirdropClaimOperationResult {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const config = clientConfig;
  const airdropContractAddress = publicConfig.blockchain.airdropContractAddress;

  // Read native fee and staking contract address
  const { data: airdropData } = useReadContracts({
    contracts: [
      {
        address: airdropContractAddress as Hex,
        abi: AirdropABI,
        functionName: "nativeFeeAmount",
      },
      {
        address: airdropContractAddress as Hex,
        abi: AirdropABI,
        functionName: "minimumTokenAmountForFee",
      },
    ],
    query: {
      enabled: !!airdropContractAddress,
    },
  });

  const nativeFeeAmount = airdropData?.[0].result ?? 0n;
  const minimumTokenAmountForFee = airdropData?.[1].result ?? 0n;

  // Track simulation errors separately since they happen before writeContract
  const [simulationError, setSimulationError] = useState<Error | null>(null);

  const {
    writeContract,
    isPending,
    error: writeContractError,
    data: transactionHash,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: transactionHash,
      confirmations: 2,
    });

  // Combined error from simulation or write contract
  const error: WriteContractErrorType | Error | null =
    simulationError ?? writeContractError;

  useEffect(() => {
    if (isConfirmed) {
      queryClient.invalidateQueries({
        queryKey: tanstackClient.airdrop.getClaimsData.key({
          input: { address: address ?? "" },
        }),
      });
    }
  }, [isConfirmed, address, queryClient]);

  const claim = useCallback(
    async (target: AirdropClaimItem, duration: bigint) => {
      reset();
      setSimulationError(null);

      if (!target || target.type !== "available") {
        console.info("No eligible airdrop rewards to claim");
        return;
      }

      if (!airdropContractAddress) {
        const err = new Error("Airdrop contract address not configured");
        setSimulationError(err);
        throw err;
      }

      if (!address) {
        const err = new Error("Wallet not connected");
        setSimulationError(err);
        throw err;
      }

      const proof = target.proof as Hex[];
      const amount = target.eligibleAmount;
      const season = target.airdrop; // Note that we use our app's airdrop number as the "season" in the contract.

      if (season < 0 || season > 255) {
        const err = new Error(
          `Invalid season value: ${season}. Must be between 0 and 255.`,
        );
        setSimulationError(err);
        throw err;
      }
      const signature = (target.signature ?? "0x") as Hex;

      try {
        // Check if fee is required
        const usersClaimedAmount = await readContract(config, {
          address: airdropContractAddress as Hex,
          abi: AirdropABI,
          functionName: "usersClaimedAmount",
          args: [address as Hex],
        });

        let valueToSend = 0n;
        if (usersClaimedAmount + amount >= minimumTokenAmountForFee) {
          valueToSend = nativeFeeAmount;
        }

        const simulationResult = await simulateContract(config, {
          address: airdropContractAddress as Hex,
          abi: AirdropABI,
          functionName: "claim",
          args: [proof, address as Hex, amount, season, duration, signature],
          account: address,
          value: valueToSend,
        });

        writeContract(simulationResult.request);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setSimulationError(error);
        throw error;
      }
    },
    [
      writeContract,
      config,
      address,
      reset,
      airdropContractAddress,
      nativeFeeAmount,
      minimumTokenAmountForFee,
    ],
  );

  const errorMessage = useMemo(() => parseAirdropClaimError(error), [error]);

  const errorType = useMemo(() => getAirdropClaimErrorType(error), [error]);

  return useMemo(
    () => ({
      claim,
      isPending,
      isConfirming,
      isConfirmed,
      error,
      errorMessage,
      errorType,
      transactionHash,
      nativeFeeAmount,
    }),
    [
      claim,
      isPending,
      isConfirming,
      isConfirmed,
      error,
      errorMessage,
      errorType,
      transactionHash,
      nativeFeeAmount,
    ],
  );
}
