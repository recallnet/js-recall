import { SpecificChain } from "../types/index.js";

/**
 * Protocol configuration for a specific DEX on a specific chain
 */
export interface DexProtocolConfig {
  /** DEX router contract address (lowercase) */
  routerAddress: string;
  /** Keccak-256 hash of the Swap event signature */
  swapEventSignature: string;
  /** Factory contract address (lowercase, optional) */
  factoryAddress: string | null;
}

/**
 * Known DEX protocol configurations by protocol name and chain
 * Used for admin competition creation and protocol filtering
 *
 * Structure: { protocolName: { chain: config } }
 *
 * Sources verified via:
 * - BaseScan (https://basescan.org)
 * - Official protocol documentation
 * - On-chain contract verification
 */
export const KNOWN_DEX_PROTOCOLS: Record<
  string,
  Partial<Record<SpecificChain, DexProtocolConfig>>
> = {
  /**
   * Aerodrome Finance - Base mainnet
   * Velodrome V2 fork optimized for Base
   *
   * Verified addresses:
   * - Router: https://basescan.org/address/0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43
   * - Factory: https://basescan.org/address/0x420dd381b31aef6683db6b902084cb0ffece40da
   * - Event: Swap(address,uint256,uint256,uint256,uint256,address)
   */
  aerodrome: {
    base: {
      routerAddress: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
      swapEventSignature:
        "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
      factoryAddress: "0x420dd381b31aef6683db6b902084cb0ffece40da",
    },
  },
} as const;

/**
 * Get protocol configuration for a specific protocol and chain
 * @param protocol Protocol name (e.g., "aerodrome")
 * @param chain Specific chain (e.g., "base")
 * @returns Protocol configuration or null if not found
 */
export function getDexProtocolConfig(
  protocol: string,
  chain: SpecificChain,
): DexProtocolConfig | null {
  const protocolConfigs = KNOWN_DEX_PROTOCOLS[protocol.toLowerCase()];
  if (!protocolConfigs) {
    return null;
  }

  const chainConfig = protocolConfigs[chain];
  if (!chainConfig) {
    return null;
  }

  return chainConfig;
}

/**
 * Check if a protocol is supported on a specific chain
 * @param protocol Protocol name
 * @param chain Specific chain
 * @returns True if protocol is known and supported on that chain
 */
export function isDexProtocolSupported(
  protocol: string,
  chain: SpecificChain,
): boolean {
  return getDexProtocolConfig(protocol, chain) !== null;
}

/**
 * Get all supported chains for a protocol
 * @param protocol Protocol name
 * @returns Array of chains where protocol is supported
 */
export function getSupportedChainsForProtocol(
  protocol: string,
): SpecificChain[] {
  const protocolConfigs = KNOWN_DEX_PROTOCOLS[protocol.toLowerCase()];
  if (!protocolConfigs) {
    return [];
  }

  return Object.keys(protocolConfigs) as SpecificChain[];
}
