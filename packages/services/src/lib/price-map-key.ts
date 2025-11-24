/**
 * Utility for generating consistent price map keys
 */

/**
 * Generate a consistent map key for token price lookups
 * Combines token address and chain to create a unique identifier
 *
 * @param tokenAddress The token contract address
 * @param specificChain The specific blockchain where the token exists
 * @returns Map key in format "${address}:${chain}"
 *
 * @example
 * ```typescript
 * const key = getPriceMapKey("0x1234...", "arbitrum");
 * // Returns: "0x1234...:arbitrum"
 * ```
 */
export function getPriceMapKey(
  tokenAddress: string,
  specificChain: string,
): string {
  return `${tokenAddress.toLowerCase()}:${specificChain}`;
}
