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
      http: ["https://evm-ignition-0.recall.network"],
      webSocket: ["wss://evm-ignition-0.recall.network"],
    },
    default: {
      http: ["https://evm-ignition-0.recall.network"],
      webSocket: ["wss://evm-ignition-0.recall.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Recall Testnet Explorer",
      url: "https://explorer.testnet.recall.network",
    },
  },
};
