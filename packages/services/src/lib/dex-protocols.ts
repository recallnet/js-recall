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
  /** Router type identifier (e.g., "v2", "slipstream") for disambiguation */
  routerType?: string;
}

/**
 * Known DEX protocol configurations by protocol name and chain
 * Used for admin competition creation and protocol filtering
 *
 * Structure: { protocolName: { chain: config | config[] } }
 * When a protocol has multiple routers (e.g., V2 + Slipstream), an array is used.
 *
 * Sources verified via:
 * - BaseScan (https://basescan.org)
 * - Official protocol documentation
 * - On-chain contract verification
 */
export const KNOWN_DEX_PROTOCOLS: Record<
  string,
  Partial<Record<SpecificChain, DexProtocolConfig | DexProtocolConfig[]>>
> = {
  /**
   * Aerodrome Finance - Base mainnet
   * Supports both V2 (classic AMM) and Slipstream (concentrated liquidity) routers
   *
   * V2 Router (Velodrome V2 fork, Uniswap V2 architecture):
   * - Router: https://basescan.org/address/0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43
   * - Factory: https://basescan.org/address/0x420dd381b31aef6683db6b902084cb0ffece40da
   * - Event: Swap(address indexed sender, address indexed to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)
   *
   * Slipstream Router (concentrated liquidity, Uniswap V3 architecture):
   * - Router: https://basescan.org/address/0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5
   * - Factory: https://basescan.org/address/0x827922686190790b37229fd06084350e74485b72
   * - Event: Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
   */
  aerodrome: {
    base: [
      // V2 Router - Classic AMM pools (e.g., AERO/USDC volatile/stable pairs)
      {
        routerAddress: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
        swapEventSignature:
          "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b",
        factoryAddress: "0x420dd381b31aef6683db6b902084cb0ffece40da",
        routerType: "v2",
      },
      // Slipstream Router - Concentrated Liquidity pools (e.g., ETH/USDC, BTC/USDC)
      {
        routerAddress: "0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5",
        swapEventSignature:
          "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
        factoryAddress: "0x827922686190790b37229fd06084350e74485b72",
        routerType: "slipstream",
      },
    ],
  },
} as const;

/**
 * Get protocol configurations for a specific protocol and chain
 * Returns an array to support protocols with multiple routers (e.g., V2 + Slipstream)
 *
 * @param protocol Protocol name (e.g., "aerodrome")
 * @param chain Specific chain (e.g., "base")
 * @returns Array of protocol configurations, or null if protocol/chain not found
 */
export function getDexProtocolConfig(
  protocol: string,
  chain: SpecificChain,
): DexProtocolConfig[] | null {
  const protocolConfigs = KNOWN_DEX_PROTOCOLS[protocol.toLowerCase()];
  if (!protocolConfigs) {
    return null;
  }

  const chainConfig = protocolConfigs[chain];
  if (!chainConfig) {
    return null;
  }

  // Normalize to array (supports both single config and array of configs)
  return Array.isArray(chainConfig) ? chainConfig : [chainConfig];
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
