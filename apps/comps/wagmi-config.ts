import { createConfig } from "@privy-io/wagmi";
import { baseSepolia } from "viem/chains";
import { http } from "wagmi";

/**
 * Wagmi configuration for Privy integration.
 * Uses @privy-io/wagmi createConfig to ensure proper synchronization with Privy.
 *
 * Note: The shimDisconnect behavior is handled automatically by @privy-io/wagmi
 * to ensure proper state synchronization between Privy and wagmi.
 */
export const wagmiConfig = createConfig({
  chains: [baseSepolia], // Match the chains configured in Privy
  transports: {
    [baseSepolia.id]: http(),
  },
});
