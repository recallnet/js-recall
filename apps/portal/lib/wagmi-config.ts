import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

import { ChainName, getChain } from "@recallnet/chains";

/**
 * Gets the chain configuration based on the NEXT_PUBLIC_CHAIN_NAME environment variable
 */
const chain = getChain(process.env.NEXT_PUBLIC_CHAIN_NAME as ChainName);

/**
 * Wagmi configuration for the Recall Portal
 *
 * This configuration sets up the RainbowKit wallet connection with the
 * appropriate chain settings based on the environment. It uses the
 * WalletConnect project ID from environment variables for connecting to wallets.
 */
export const config = getDefaultConfig({
  appName: "Recall Portal",
  chains: [chain],
  transports: {
    [chain.id]: http(chain.rpcUrls.default.http[0]),
  },
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  ssr: true,
});
