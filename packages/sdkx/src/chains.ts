import { Chain } from "viem";

export const ignition: Chain = {
  id: 2481632,
  name: "Ignition",
  nativeCurrency: {
    name: "Recall",
    symbol: "RECALL",
    decimals: 18,
  },
  testnet: true,
  rpcUrls: {
    [2481632]: {
      http: ["https://evm.node-0.testnet.recall.network"],
      webSocket: ["wss://evm.node-0.testnet.recall.network"],
    },
    default: {
      http: ["https://evm.node-0.testnet.recall.network"],
      webSocket: ["wss://evm.node-0.testnet.recall.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Recall Testnet Explorer",
      url: "https://explorer.testnet.recall.network",
    },
  },
};
