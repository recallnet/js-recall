import { useMemo } from "react";
import { getAddress } from "viem";
import { useAccount, useBalance, useChainId } from "wagmi";

import { RECALL_TOKEN_ADDRESS } from "@/constants";

/**
 * Hook return type for loading state
 */
type UseRecallLoading = {
  value: undefined;
  decimals: undefined;
  isLoading: true;
};

/**
 * Hook return type for loaded state
 */
type UseRecallLoaded = {
  value: bigint;
  decimals: number;
  isLoading: false;
};

/**
 * Union type for the useRecall hook return value
 */
type UseRecallReturn = UseRecallLoading | UseRecallLoaded;

/**
 * Hook to get Recall token balance and information
 * @returns Object containing token value, decimals, and loading state
 */
export const useRecall = (): UseRecallReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const token = useMemo(() => {
    if (!chainId) return undefined;
    const tokenHex =
      RECALL_TOKEN_ADDRESS[
        chainId.toString() as keyof typeof RECALL_TOKEN_ADDRESS
      ];
    return tokenHex ? getAddress(tokenHex) : undefined;
  }, [chainId]);

  const { data, isLoading } = useBalance({
    address,
    token,
    query: { enabled: Boolean(address && token) },
  });

  if (isLoading || !data) {
    return {
      value: undefined,
      decimals: undefined,
      isLoading: true,
    };
  }

  return {
    value: data.value,
    decimals: data.decimals,
    isLoading: false,
  };
};
