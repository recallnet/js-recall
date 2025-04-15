import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

import { ChainName, getChain, getParentChain } from "@recallnet/chains";

/**
 * Gets the chain configuration based on the NEXT_PUBLIC_CHAIN_NAME environment variable
 * and its parent chain if it exists
 */
const chain = getChain(process.env.NEXT_PUBLIC_CHAIN_NAME as ChainName);
const parentChain = getParentChain(chain);
const chains = [chain, ...(parentChain ? [parentChain] : [])] as const;

/**
 * Wagmi configuration for the Recall Portal
 *
 * This configuration sets up the RainbowKit wallet connection with the
 * appropriate chain settings based on the environment. It uses the
 * WalletConnect project ID from environment variables for connecting to wallets.
 */
export const config = getDefaultConfig({
  appName: "Recall Portal",
  chains,
  transports: Object.fromEntries(
    chains.map((c) => [c.id, http(c.rpcUrls.default.http[0])]),
  ),
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  ssr: true,
});
