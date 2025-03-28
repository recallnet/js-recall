/**
 * Recall Network Chain Configurations
 *
 * This module provides chain configurations and utility functions for interacting with Recall Network chains.
 * It includes definitions for Testnet, Localnet, and Devnet environments with their respective chain configurations.
 *
 * @packageDocumentation
 */
import { defineChain } from "viem";
import { type Chain, anvil, filecoinCalibration } from "viem/chains";

import {
  DEVNET_CHAIN_ID,
  DEVNET_EVM_RPC_URL,
  DEVNET_EXPLORER_URL,
  DEVNET_OBJECT_API_URL,
  LOCALNET_CHAIN_ID,
  LOCALNET_EVM_RPC_URL,
  LOCALNET_EVM_WS_URL,
  LOCALNET_EXPLORER_URL,
  LOCALNET_OBJECT_API_URL,
  TESTNET_CHAIN_ID,
  TESTNET_EVM_RPC_URL,
  TESTNET_EVM_WS_URL,
  TESTNET_EXPLORER_URL,
  TESTNET_OBJECT_API_URL,
  TESTNET_REGISTRAR_URL,
} from "@recallnet/network-constants";

/**
 * Supported Recall Network chain names.
 */
export type ChainName = "mainnet" | "testnet" | "localnet" | "devnet";

/**
 * Recall Testnet chain configuration.
 *
 * Defines the chain ID, RPC URLs, native currency, and other configuration for the Recall Testnet.
 */
export const testnet: Chain = defineChain({
  id: Number(TESTNET_CHAIN_ID),
  name: "Recall Testnet",
  fees: {
    baseFeeMultiplier: 120,
  },
  nativeCurrency: {
    name: "Recall",
    symbol: "RECALL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [TESTNET_EVM_RPC_URL],
      webSocket: [TESTNET_EVM_WS_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Recall Testnet Explorer",
      url: TESTNET_EXPLORER_URL,
    },
  },
});

/**
 * Recall Localnet chain configuration.
 *
 * Defines the chain ID, RPC URLs, native currency, and other configuration for the Recall Localnet (local development environment).
 */
export const localnet: Chain = defineChain({
  id: Number(LOCALNET_CHAIN_ID),
  name: "Recall Localnet",
  fees: {
    baseFeeMultiplier: 120,
  },
  nativeCurrency: {
    name: "Recall",
    symbol: "RECALL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [LOCALNET_EVM_RPC_URL],
      webSocket: [LOCALNET_EVM_WS_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Recall Localnet Explorer",
      url: LOCALNET_EXPLORER_URL,
    },
  },
});

/**
 * Recall Devnet chain configuration.
 *
 * Defines the chain ID, RPC URLs, native currency, and other configuration for the Recall Devnet (development environment).
 */
export const devnet: Chain = defineChain({
  id: Number(DEVNET_CHAIN_ID),
  name: "Recall Devnet",
  fees: {
    baseFeeMultiplier: 120,
  },
  nativeCurrency: {
    name: "Recall",
    symbol: "RECALL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [DEVNET_EVM_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Recall Devnet Explorer",
      url: DEVNET_EXPLORER_URL,
    },
  },
});

/**
 * Get all supported chains.
 *
 * Returns an array of all supported chains, optionally including local development chains.
 *
 * @example
 * ```typescript
 * // Get production chains only
 * const chains = supportedChains();
 *
 * // Include local development chains
 * const allChains = supportedChains(true);
 * ```
 *
 * @param isLocalDev - Whether to include local development chains (Localnet, Devnet, Anvil)
 * @returns Array of supported chain configurations
 */
export function supportedChains(isLocalDev = false): Chain[] {
  const chains: Chain[] = [testnet, filecoinCalibration];
  if (isLocalDev) {
    chains.push(localnet, devnet, anvil);
  }
  chains.sort((a, b) => (a.name > b.name ? 1 : -1));
  return chains;
}

/**
 * Check if a chain is supported.
 *
 * @example
 * ```typescript
 * const isSupported = checkChainIsSupported(testnet);
 * // Returns: true
 * ```
 *
 * @param chain - The chain to check
 * @returns True if the chain is supported, false otherwise
 */
export function checkChainIsSupported(chain: Chain): boolean {
  return supportedChains(true).some((c) => c.id === chain.id);
}

/**
 * Get a chain by ID or name.
 *
 * @example
 * ```typescript
 * // Get by name
 * const chain = getChain("testnet");
 *
 * // Get by ID
 * const sameChain = getChain(2481632);
 * ```
 *
 * @param chainIdOrName - The chain ID or name to look up
 * @returns The corresponding chain configuration
 * @throws Will throw an error if the chain is not found
 */
export function getChain(chainIdOrName: number | ChainName): Chain {
  const chains = supportedChains(true);
  // TODO: the `chain.name` is prettified like `Recall Localnet`, but maybe we can add a custom parameter and filter by that
  const chain = chains.find(
    (c) =>
      c.id === chainIdOrName ||
      c.name.toLowerCase().includes(chainIdOrName.toString().toLowerCase()),
  );
  if (chain) {
    return chain;
  }
  throw new Error(`Chain ${chainIdOrName} not found`);
}

/**
 * Check if a chain has a parent chain.
 *
 * Some Recall chains are connected to parent chains (e.g., Testnet to Filecoin Calibration).
 * This function checks if a given chain has a parent chain.
 *
 * @example
 * ```typescript
 * const hasParent = checkHasParentChain(testnet);
 * // Returns: true
 * ```
 *
 * @param chain - The chain to check
 * @returns True if the chain has a parent chain, false otherwise
 * @throws Will throw an error if the chain is not supported
 */
export function checkHasParentChain(chain: Chain): boolean {
  if (!checkChainIsSupported(chain))
    throw new Error(`Chain ${chain.name} not found`);

  switch (chain.id) {
    case testnet.id:
    case localnet.id:
      return true;
    default:
      return false;
  }
}

/**
 * Get the parent chain for a given chain.
 *
 * @example
 * ```typescript
 * const parentChain = getParentChain(testnet);
 * // Returns: filecoinCalibration
 * ```
 *
 * @param chain - The child chain
 * @returns The parent chain, or undefined if the chain doesn't have a parent
 */
export function getParentChain(chain: Chain): Chain | undefined {
  switch (chain.id) {
    case testnet.id:
      return filecoinCalibration;
    case localnet.id:
      return anvil;
    default:
      return undefined;
  }
}

/**
 * Check if a chain name is valid.
 *
 * @example
 * ```typescript
 * const isValid = checkChainName("testnet");
 * // Returns: true
 *
 * const isInvalid = checkChainName("unknown" as ChainName);
 * // Returns: false
 * ```
 *
 * @param chainName - The chain name to check
 * @returns True if the chain name is valid, false otherwise
 */
export function checkChainName(chainName: ChainName): boolean {
  try {
    getChain(chainName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Object API URL for a chain.
 *
 * @example
 * ```typescript
 * const apiUrl = getObjectApiUrl(testnet);
 * // Returns: "https://objects.testnet.recall.chain.love"
 * ```
 *
 * @param chain - The chain to get the Object API URL for
 * @returns The Object API URL for the specified chain
 * @throws Will throw an error if the Object API URL is not defined for the chain
 */
export function getObjectApiUrl(chain: Chain): string {
  switch (chain.id) {
    case testnet.id:
      return TESTNET_OBJECT_API_URL;
    case localnet.id:
      return LOCALNET_OBJECT_API_URL;
    case devnet.id:
      return DEVNET_OBJECT_API_URL;
    default:
      throw new Error(`Object API URL not found for chain ${chain.name}`);
  }
}

/**
 * Get the Registrar URL for a chain.
 *
 * @example
 * ```typescript
 * const registrarUrl = getRegistrarUrl(testnet);
 * // Returns: "https://faucet.node-0.testnet.recall.network"
 * ```
 *
 * @param chain - The chain to get the Registrar URL for
 * @returns The Registrar URL for the specified chain
 * @throws Will throw an error if the Registrar URL is not defined for the chain
 */
export function getRegistrarUrl(chain: Chain): string {
  switch (chain.id) {
    case testnet.id:
      return TESTNET_REGISTRAR_URL;
    default:
      throw new Error(`Registrar URL not found for chain ${chain.name}`);
  }
}

/**
 * Get the Explorer URL for a chain.
 *
 * @example
 * ```typescript
 * const explorerUrl = getExplorerUrl(testnet);
 * // Returns: "https://explorer.testnet.recall.network"
 * ```
 *
 * @param chain - The chain to get the Explorer URL for
 * @returns The Explorer URL for the specified chain
 * @throws Will throw an error if the Explorer URL is not defined for the chain
 */
export function getExplorerUrl(chain: Chain): string {
  switch (chain.id) {
    case testnet.id:
      return TESTNET_EXPLORER_URL;
    case localnet.id:
      return LOCALNET_EXPLORER_URL;
    case devnet.id:
      return DEVNET_EXPLORER_URL;
    default:
      throw new Error(`Explorer URL not found for chain ${chain.name}`);
  }
}
