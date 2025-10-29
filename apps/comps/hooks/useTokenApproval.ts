import { useCallback, useMemo } from "react";
import { type Address, erc20Abi } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { clientConfig } from "@/wagmi-config";

export type UseTokenApprovalResult = {
  isLoading: boolean;
  allowance: bigint | undefined;
  isApprovalLoading: boolean;
  isApprovalConfirming: boolean;
  isApprovalConfirmed: boolean;
  approvalError: Error | null;
  approvalTransactionHash: `0x${string}` | undefined;
  approve: (amount: bigint) => Promise<void>;
  needsApproval: (amount: bigint) => boolean;
};

/**
 * Hook to get token allowance and approval functionality for a specific spender
 * @param tokenAddress - The token contract address
 * @param spenderAddress - The address that needs approval to spend tokens
 * @returns Object containing allowance and approval functions
 */
export const useTokenApproval = (
  tokenAddress: Address | undefined,
  spenderAddress: Address | undefined,
): UseTokenApprovalResult => {
  const { address } = useAccount();

  const {
    data: allowance,
    isLoading: isAllowanceLoading,
    refetch,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    query: {
      enabled: Boolean(address && tokenAddress && spenderAddress),
    },
  });

  const {
    writeContract,
    isPending: isApprovalLoading,
    error: approvalError,
    data: approvalTransactionHash,
  } = useWriteContract();

  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } =
    useWaitForTransactionReceipt({
      hash: approvalTransactionHash,
      confirmations: 2,
    });

  const refetchAllowance = useCallback(
    async (txHash: `0x${string}`) => {
      const transactionReceipt = await waitForTransactionReceipt(clientConfig, {
        hash: txHash,
        pollingInterval: 1000,
        confirmations: 2,
      });

      if (transactionReceipt.status === "success") {
        refetch();
      }
    },
    [refetch],
  );

  const approve = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!tokenAddress || !spenderAddress) {
        throw new Error(
          "Token address and spender address are required for approval",
        );
      }
      return writeContract(
        {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [spenderAddress, amount],
        },
        {
          onSuccess: (txHash) => refetchAllowance(txHash),
        },
      );
    },
    [tokenAddress, spenderAddress, writeContract, refetchAllowance],
  );

  const needsApproval = useCallback(
    (amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    },
    [allowance],
  );

  const isParamsMissing = !address || !tokenAddress || !spenderAddress;

  return useMemo(
    () => ({
      isLoading: isAllowanceLoading || isParamsMissing,
      allowance,
      isApprovalLoading,
      isApprovalConfirming,
      isApprovalConfirmed,
      approvalError: approvalError ?? null,
      approvalTransactionHash,
      approve,
      needsApproval,
    }),
    [
      isAllowanceLoading,
      isParamsMissing,
      allowance,
      isApprovalLoading,
      isApprovalConfirming,
      isApprovalConfirmed,
      approvalError,
      approvalTransactionHash,
      approve,
      needsApproval,
    ],
  );
};
