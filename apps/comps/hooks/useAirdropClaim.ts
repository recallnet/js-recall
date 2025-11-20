import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { Hex } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { WriteContractErrorType, simulateContract } from "wagmi/actions";

import { AirdropABI } from "@/abi/Airdrop";
import { config as publicConfig } from "@/config/public";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { AvailableClaim } from "@/types/conviction-claims";
import { clientConfig } from "@/wagmi-config";

type AirdropClaimItem = AvailableClaim & {
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
  error: WriteContractErrorType | null;
  transactionHash: `0x${string}` | undefined;
};

/**
 * Hook for claiming airdrop rewards
 * @returns Airdrop claim operation result with transaction hash and state
 */
export function useAirdropClaim(): AirdropClaimOperationResult {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const config = clientConfig;

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
        queryKey: tanstackClient.airdrop.getClaimsData.key({
          input: { address: address ?? "" },
        }),
      });
    }
  }, [isConfirmed, address, queryClient]);

  const claim = useCallback(
    async (target: AirdropClaimItem, duration: bigint) => {
      reset();

      if (!target || target.type !== "available") {
        console.info("No eligible airdrop rewards to claim");
        return;
      }

      if (!publicConfig.blockchain.airdropContractAddress) {
        throw new Error("Airdrop contract address not configured");
      }

      if (!address) {
        throw new Error("Wallet not connected");
      }

      const proof = target.proof as Hex[];
      const amount = target.eligibleAmount;
      const season = target.season as number;
      const signature = (target.signature ?? "0x") as Hex;

      const simulationResult = await simulateContract(config, {
        address: publicConfig.blockchain.airdropContractAddress as Hex,
        abi: AirdropABI,
        functionName: "claim",
        args: [proof, address as Hex, amount, season, duration, signature],
        account: address,
      });

      writeContract(simulationResult.request);
    },
    [writeContract, config, address, reset],
  );

  return useMemo(
    () => ({
      claim,
      isPending,
      isConfirming,
      isConfirmed,
      error,
      transactionHash,
    }),
    [claim, isPending, isConfirming, isConfirmed, error, transactionHash],
  );
}
