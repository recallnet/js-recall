import { defineChain } from "viem";
import { anvil, type Chain, filecoinCalibration } from "viem/chains";
import {
  DEVNET_CHAIN_ID,
  DEVNET_EVM_RPC_URL,
  LOCALNET_CHAIN_ID,
  LOCALNET_EVM_RPC_URL,
  LOCALNET_EVM_WS_URL,
  TESTNET_CHAIN_ID,
  TESTNET_EVM_RPC_URL,
  TESTNET_EVM_WS_URL,
} from "./constants.js";

export type ChainName = "mainnet" | "testnet" | "localnet" | "devnet";

export const testnet: Chain = defineChain({
  id: Number(TESTNET_CHAIN_ID),
  name: "Hoku Testnet",
  nativeCurrency: {
    name: "Hoku",
    symbol: "HOKU",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [TESTNET_EVM_RPC_URL],
      webSocket: [TESTNET_EVM_WS_URL],
    },
  },
  // blockExplorers: {
  //   default: { name: "HK Explorer", url: "https://hkexplorer.io" },
  // },
  testnet: false, // TODO: update once mainnet is live
});

export const localnet: Chain = defineChain({
  id: Number(LOCALNET_CHAIN_ID),
  name: "Hoku Localnet",
  nativeCurrency: {
    name: "Hoku",
    symbol: "HOKU",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [LOCALNET_EVM_RPC_URL],
      webSocket: [LOCALNET_EVM_WS_URL],
    },
  },
});

export const devnet: Chain = defineChain({
  id: Number(DEVNET_CHAIN_ID),
  name: "Hoku Devnet",
  nativeCurrency: {
    name: "Hoku",
    symbol: "HOKU",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [DEVNET_EVM_RPC_URL],
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
  // TODO: the `chain.name` is prettified like `Hoku Localnet`, but maybe we can add a custom parameter and filter by that
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
