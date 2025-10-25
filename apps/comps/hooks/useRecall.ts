import { type Address, getAddress } from "viem";

import { config } from "@/config/public";

import { useSafeAccount, useSafeBalance } from "./useSafeWagmi";

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
  const { address, chainId } = useSafeAccount();

  const token = getAddress(config.blockchain.tokenContractAddress);

  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    queryKey,
  } = useSafeBalance({
    address,
    token,
    chainId,
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
