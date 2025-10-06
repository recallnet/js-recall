import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";

import { BASE_SEPOLIA_RPC } from "@/config";
import { baseSepoliaWithRpcUrl } from "@/providers/privy-provider";

/**
 * Wagmi configuration for Privy integration.
 * Uses @privy-io/wagmi createConfig to ensure proper synchronization with Privy.
 *
 * Note: The shimDisconnect behavior is handled automatically by @privy-io/wagmi
 * to ensure proper state synchronization between Privy and wagmi.
 */
export const wagmiConfig = createConfig({
  chains: [baseSepoliaWithRpcUrl], // Match the chains configured in Privy
  transports: {
    // Explicitly use the env-provided RPC for wagmi if available; otherwise fall back
    [baseSepoliaWithRpcUrl.id]: http(BASE_SEPOLIA_RPC || undefined),
  },
});
