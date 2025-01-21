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
      http: ["https://evm-ignition-0.hoku.sh"],
      webSocket: ["wss://evm-ignition-0.hoku.sh"],
    },
    default: {
      http: ["https://evm-ignition-0.hoku.sh"],
      webSocket: ["wss://evm-ignition-0.hoku.sh"],
    },
  },
  blockExplorers: {
    default: {
      name: "Recall Testnet Explorer",
      url: "https://explorer.testnet.hoku.sh",
    },
  },
};
