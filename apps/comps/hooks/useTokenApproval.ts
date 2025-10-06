import { type Address, erc20Abi } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

/**
 * Hook return type for loading state
 */
type UseTokenApprovalLoading = {
  allowance: undefined;
  isLoading: true;
};

/**
 * Hook return type for loaded state
 */
type UseTokenApprovalLoaded = {
  isLoading: false;
  allowance: bigint;
  isApprovalLoading: boolean;
  isApprovalConfirming: boolean;
  isApprovalConfirmed: boolean;
  approvalError: Error | null;
  approvalTransactionHash: `0x${string}` | undefined;
  approve: (amount: bigint) => Promise<void>;
  needsApproval: (amount: bigint) => boolean;
  refetchAllowance: () => void;
};

/**
 * Union type for the useTokenApproval hook return value
 */
type UseTokenApprovalReturn = UseTokenApprovalLoading | UseTokenApprovalLoaded;

/**
 * Hook to get token allowance and approval functionality for a specific spender
 * @param tokenAddress - The token contract address
 * @param spenderAddress - The address that needs approval to spend tokens
 * @returns Object containing allowance and approval functions
 */
export const useTokenApproval = (
  tokenAddress: Address | undefined,
  spenderAddress: Address | undefined,
): UseTokenApprovalReturn => {
  const { address } = useAccount();

  // All hooks must be called in the same order every time
  const {
    data: allowance,
    isLoading: isAllowanceLoading,
    refetch: refetchAllowance,
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
    writeContract: writeApprove,
    isPending: isApprovalLoading,
    error: approvalError,
    data: approvalTransactionHash,
  } = useWriteContract();

  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } =
    useWaitForTransactionReceipt({
      hash: approvalTransactionHash,
    });

  const approve = async (amount: bigint): Promise<void> => {
    if (!tokenAddress || !spenderAddress) {
      throw new Error(
        "Token address and spender address are required for approval",
      );
    }
    return writeApprove({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress, amount],
    });
  };

  const needsApproval = (amount: bigint): boolean => {
    if (!allowance) return true;
    // Check if we have sufficient allowance for the requested amount
    return allowance < amount;
  };

  // Handle loading and missing parameters after all hooks are called
  if (isAllowanceLoading || !tokenAddress || !spenderAddress || !address) {
    return {
      allowance: undefined,
      isLoading: true,
    };
  }

  return {
    allowance: allowance ?? 0n,
    isLoading: false,
    isApprovalLoading,
    isApprovalConfirming,
    isApprovalConfirmed,
    approvalError,
    approvalTransactionHash,
    approve,
    needsApproval,
    refetchAllowance,
  };
};
