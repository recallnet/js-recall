"use client";

import { useCallback, useMemo } from "react";
import { type Address } from "viem";
import {
  UseBalanceParameters,
  UseBalanceReturnType,
  UseBlockParameters,
  UseBlockReturnType,
  UseReadContractParameters,
  UseReadContractReturnType,
  UseReadContractsReturnType,
  UseWaitForTransactionReceiptReturnType,
  useAccount as useWagmiAccount,
  useBalance as useWagmiBalance,
  useBlock as useWagmiBlock,
  useChainId as useWagmiChainId,
  useDisconnect as useWagmiDisconnect,
  useReadContract as useWagmiReadContract,
  useReadContracts as useWagmiReadContracts,
  useWaitForTransactionReceipt as useWagmiWaitForTransactionReceipt,
  useWriteContract as useWagmiWriteContract,
} from "wagmi";
import { useConfig } from "wagmi";

/**
 * Check if WagmiProvider is available by attempting to use the config
 */
function isWagmiAvailable(): boolean {
  try {
    // This will throw if WagmiProvider is not available
    useConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe wrapper for useAccount that handles missing WagmiProvider
 */
export function useSafeAccount() {
  if (!isWagmiAvailable()) {
    return {
      address: undefined as Address | undefined,
      addresses: undefined,
      chain: undefined,
      chainId: undefined,
      connector: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: "disconnected" as const,
    };
  }
  return useWagmiAccount();
}

/**
 * Safe wrapper for useChainId that handles missing WagmiProvider
 */
export function useSafeChainId(): number | undefined {
  if (!isWagmiAvailable()) {
    return undefined;
  }
  return useWagmiChainId();
}

/**
 * Safe wrapper for useReadContract that handles missing WagmiProvider
 */
export function useSafeReadContract(
  params?: UseReadContractParameters,
): UseReadContractReturnType {
  const wagmiAvailable = isWagmiAvailable();

  // Create a stable default result
  const defaultResult = useMemo(
    () => ({
      data: undefined,
      error: null,
      isError: false,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isLoadingError: false,
      isRefetchError: false,
      isRefetching: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: false,
      isPlaceholderData: false,
      isStale: false,
      dataUpdatedAt: 0,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle" as const,
      refetch: async () => ({}) as UseReadContractReturnType,
      remove: () => {},
      status: "pending" as const,
      queryKey: [] as readonly unknown[],
    }),
    [],
  );

  if (!wagmiAvailable || !params) {
    return defaultResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWagmiReadContract(params);
}

/**
 * Safe wrapper for useReadContracts that handles missing WagmiProvider
 */
export function useSafeReadContracts(
  params?: Parameters<typeof useWagmiReadContracts>[0],
): UseReadContractsReturnType {
  const wagmiAvailable = isWagmiAvailable();

  // Create a stable default result
  const defaultResult = useMemo(
    () => ({
      data: undefined,
      error: null,
      isError: false,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isLoadingError: false,
      isRefetchError: false,
      isRefetching: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: false,
      isPlaceholderData: false,
      isStale: false,
      dataUpdatedAt: 0,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle" as const,
      refetch: async () => ({}) as UseReadContractsReturnType,
      remove: () => {},
      status: "pending" as const,
      queryKey: [] as readonly unknown[],
    }),
    [],
  );

  if (!wagmiAvailable || !params) {
    return defaultResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWagmiReadContracts(params);
}

/**
 * Safe wrapper for useWriteContract that handles missing WagmiProvider
 */
export function useSafeWriteContract() {
  const wagmiAvailable = isWagmiAvailable();

  // Create stable default functions and values
  const noOpWriteContract = useCallback(async () => {
    console.warn("Cannot write contract: WagmiProvider not available");
    return undefined;
  }, []);

  const defaultResult = useMemo(
    () => ({
      data: undefined,
      error: null,
      isError: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
      writeContract: noOpWriteContract,
      writeContractAsync: noOpWriteContract,
      variables: undefined,
      status: "idle" as const,
      reset: () => {},
    }),
    [noOpWriteContract],
  );

  if (!wagmiAvailable) {
    return defaultResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWagmiWriteContract();
}

/**
 * Safe wrapper for useWaitForTransactionReceipt that handles missing WagmiProvider
 */
export function useSafeWaitForTransactionReceipt(
  params?: Parameters<typeof useWagmiWaitForTransactionReceipt>[0],
): UseWaitForTransactionReceiptReturnType {
  const wagmiAvailable = isWagmiAvailable();

  const defaultResult = useMemo(
    () => ({
      data: undefined,
      error: null,
      isError: false,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isLoadingError: false,
      isRefetchError: false,
      isRefetching: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: false,
      isPlaceholderData: false,
      isStale: false,
      dataUpdatedAt: 0,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle" as const,
      refetch: async () => ({}) as UseWaitForTransactionReceiptReturnType,
      remove: () => {},
      status: "pending" as const,
      queryKey: [] as readonly unknown[],
    }),
    [],
  );

  if (!wagmiAvailable) {
    return defaultResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWagmiWaitForTransactionReceipt(params);
}

/**
 * Safe wrapper for useDisconnect that handles missing WagmiProvider
 */
export function useSafeDisconnect() {
  const wagmiAvailable = isWagmiAvailable();

  const noOpDisconnect = useCallback(() => {
    console.warn("Cannot disconnect: WagmiProvider not available");
  }, []);

  const noOpDisconnectAsync = useCallback(async () => {
    console.warn("Cannot disconnect: WagmiProvider not available");
  }, []);

  const defaultResult = useMemo(
    () => ({
      connectors: [],
      disconnect: noOpDisconnect,
      disconnectAsync: noOpDisconnectAsync,
      error: null,
      isError: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
      variables: undefined,
      status: "idle" as const,
      reset: () => {},
    }),
    [noOpDisconnect, noOpDisconnectAsync],
  );

  if (!wagmiAvailable) {
    return defaultResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWagmiDisconnect();
}

/**
 * Safe wrapper for useBalance that handles missing WagmiProvider
 */
export function useSafeBalance(
  params?: UseBalanceParameters,
): UseBalanceReturnType {
  const wagmiAvailable = isWagmiAvailable();

  const defaultResult = useMemo(
    () => ({
      data: undefined,
      error: null,
      isError: false,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isLoadingError: false,
      isRefetchError: false,
      isRefetching: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: false,
      isPlaceholderData: false,
      isStale: false,
      dataUpdatedAt: 0,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle" as const,
      refetch: async () => ({}) as UseBalanceReturnType,
      remove: () => {},
      status: "pending" as const,
      queryKey: [] as readonly unknown[],
    }),
    [],
  );

  if (!wagmiAvailable) {
    return defaultResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWagmiBalance(params);
}

/**
 * Safe wrapper for useBlock that handles missing WagmiProvider
 */
export function useSafeBlock(params?: UseBlockParameters): UseBlockReturnType {
  const wagmiAvailable = isWagmiAvailable();

  const defaultResult = useMemo(
    () => ({
      data: undefined,
      error: null,
      isError: false,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isLoadingError: false,
      isRefetchError: false,
      isRefetching: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: false,
      isPlaceholderData: false,
      isStale: false,
      dataUpdatedAt: 0,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle" as const,
      refetch: async () => ({}) as UseBlockReturnType,
      remove: () => {},
      status: "pending" as const,
      queryKey: [] as readonly unknown[],
    }),
    [],
  );

  if (!wagmiAvailable || !params) {
    return defaultResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWagmiBlock(params);
}
