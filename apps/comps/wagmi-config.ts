import { createConfig } from "@privy-io/wagmi";
import { Config, http } from "wagmi";

import { chainWithRpcUrl } from "@/config/chain";
import { config } from "@/config/public";

/**
 * Wagmi configuration for Privy integration.
 * Uses @privy-io/wagmi createConfig to ensure proper synchronization with Privy.
 *
 * Note: The shimDisconnect behavior is handled automatically by @privy-io/wagmi
 * to ensure proper state synchronization between Privy and wagmi.
 */
export const clientConfig: Config = createConfig({
  chains: [chainWithRpcUrl], // Match the chains configured in Privy
  transports: {
    // Explicitly use the env-provided RPC for wagmi if available; otherwise fall back
    [chainWithRpcUrl.id]: http(config.blockchain.rpcUrl),
  },
});
