import { useMemo } from "react";
import { type Address, getAddress } from "viem";
import { useAccount, useBalance, useChainId } from "wagmi";

import { RECALL_TOKEN_ADDRESS } from "@/constants";

/**
 * Hook return type for loading state
 */
type UseRecallLoading = {
  value: undefined;
  decimals: undefined;
  isLoading: true;
  token: undefined;
  queryKey: undefined;
};

/**
 * Hook return type for loaded state
 */
type UseRecallLoaded = {
  value: bigint;
  decimals: number;
  isLoading: false;
  token: Address;
  queryKey: readonly unknown[];
};

/**
 * Union type for the useRecall hook return value
 */
type UseRecallReturn = UseRecallLoading | UseRecallLoaded;

/**
 * Hook to get Recall token balance and basic information
 * @returns Object containing token value and decimals
 */
export const useRecall = (): UseRecallReturn => {
  const { address } = useAccount();
  const chainId = useChainId();

  const token: Address | undefined = useMemo(() => {
    if (!chainId) return undefined;
    const tokenHex =
      RECALL_TOKEN_ADDRESS[
        chainId.toString() as keyof typeof RECALL_TOKEN_ADDRESS
      ];
    return tokenHex ? getAddress(tokenHex) : undefined;
  }, [chainId]);

  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    queryKey,
  } = useBalance({
    address,
    token,
    query: { enabled: Boolean(address && token), refetchInterval: 10_000 },
  });

  if (isBalanceLoading || !balanceData) {
    return {
      value: undefined,
      decimals: undefined,
      isLoading: true,
      token: undefined,
      queryKey: undefined,
    };
  }

  return {
    value: balanceData.value,
    decimals: balanceData.decimals,
    isLoading: false,
    token: token!,
    queryKey: queryKey,
  };
};
