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

export type ChainName = "mainnet" | "testnet" | "localnet" | "devnet";

export const testnet: Chain = defineChain({
  id: Number(TESTNET_CHAIN_ID),
  name: "Recall Testnet",
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

export const localnet: Chain = defineChain({
  id: Number(LOCALNET_CHAIN_ID),
  name: "Recall Localnet",
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

export const devnet: Chain = defineChain({
  id: Number(DEVNET_CHAIN_ID),
  name: "Recall Devnet",
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

export function supportedChains(isLocalDev = false): Chain[] {
  const chains: Chain[] = [testnet, filecoinCalibration];
  if (isLocalDev) {
    chains.push(localnet, devnet, anvil);
  }
  chains.sort((a, b) => (a.name > b.name ? 1 : -1));
  return chains;
}

export function checkChainIsSupported(chain: Chain): boolean {
  return supportedChains(true).some((c) => c.id === chain.id);
}

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

export function checkChainName(chainName: ChainName): boolean {
  try {
    getChain(chainName);
    return true;
  } catch {
    return false;
  }
}

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

export function getRegistrarUrl(chain: Chain): string {
  switch (chain.id) {
    case testnet.id:
      return TESTNET_REGISTRAR_URL;
    default:
      throw new Error(`Registrar URL not found for chain ${chain.name}`);
  }
}

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
