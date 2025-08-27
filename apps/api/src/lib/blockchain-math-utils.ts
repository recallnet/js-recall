/**
 * Blockchain math utility functions
 * Shared logic for BigNumber operations, wei conversions, and gas calculations
 */
import { Utils } from "alchemy-sdk";

const { formatUnits, parseUnits, formatEther } = Utils;

// Cache for token decimals to avoid repeated RPC calls
const decimalCache = new Map<string, number>();

/**
 * Convert a raw token amount to human-readable format
 * @param amount Raw token amount as string or bigint
 * @param decimals Number of decimals for the token
 * @returns Formatted string representation
 */
export function formatTokenAmount(
  amount: string | bigint,
  decimals: number,
): string {
  return formatUnits(amount, decimals);
}

/**
 * Convert a human-readable amount to raw token amount
 * @param amount Human-readable amount (e.g., "1.5")
 * @param decimals Number of decimals for the token
 * @returns Raw amount as bigint
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const parsed = parseUnits(amount, decimals);
  // Convert BigNumber to bigint
  return BigInt(parsed.toString());
}

/**
 * Get token decimals from cache or provide default
 * For use when dynamic fetching is not available
 * @param tokenAddress Token contract address
 * @returns Cached decimals or 18 as default
 */
export function getCachedTokenDecimals(tokenAddress: string): number {
  const normalizedAddress = tokenAddress.toLowerCase();
  return decimalCache.get(normalizedAddress) || 18;
}

/**
 * Cache token decimals for future use
 * @param tokenAddress Token contract address
 * @param decimals Number of decimals
 */
export function cacheTokenDecimals(
  tokenAddress: string,
  decimals: number,
): void {
  const normalizedAddress = tokenAddress.toLowerCase();
  decimalCache.set(normalizedAddress, decimals);
}

/**
 * Get known token decimals for common tokens
 * This provides a fallback for well-known tokens when RPC is unavailable
 * @param tokenSymbol Token symbol (e.g., "USDC", "USDT")
 * @returns Known decimals or undefined
 */
export function getKnownTokenDecimals(tokenSymbol: string): number | undefined {
  const knownDecimals: Record<string, number> = {
    USDC: 6,
    USDT: 6,
    DAI: 18,
    WBTC: 8,
    ETH: 18,
    WETH: 18,
  };

  return knownDecimals[tokenSymbol.toUpperCase()];
}

/**
 * Calculate gas cost in USD
 * @param gasUsed Amount of gas used
 * @param gasPrice Gas price in wei
 * @param ethPriceUsd Current ETH price in USD
 * @returns Gas cost in USD
 */
export function calculateGasCostUsd(
  gasUsed: bigint | string | number,
  gasPrice: bigint | string | number,
  ethPriceUsd: number,
): number {
  const gasUsedBig = BigInt(gasUsed);
  const gasPriceBig = BigInt(gasPrice);

  // Calculate total cost in wei
  const totalCostWei = gasUsedBig * gasPriceBig;

  // Convert to ETH
  const totalCostEth = formatEther(totalCostWei);

  // Convert to USD
  return parseFloat(totalCostEth) * ethPriceUsd;
}

/**
 * Convert hex string to decimal string
 * Useful for converting hex balances from RPC responses
 * @param hexString Hex string (with or without 0x prefix)
 * @returns Decimal string representation
 */
export function hexToDecimal(hexString: string): string {
  // Remove 0x prefix if present
  const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;

  // Handle empty or zero values
  if (!cleanHex || cleanHex === "0") return "0";

  return BigInt(`0x${cleanHex}`).toString();
}

/**
 * Safe addition of token amounts with overflow protection
 * @param amounts Array of amounts to sum (as strings or bigints)
 * @returns Sum as bigint
 */
export function sumTokenAmounts(amounts: (string | bigint)[]): bigint {
  return amounts.reduce((sum: bigint, amount) => {
    const amountBig = typeof amount === "string" ? BigInt(amount) : amount;
    return sum + amountBig;
  }, 0n);
}

/**
 * Calculate percentage change between two values
 * @param oldValue Previous value
 * @param newValue Current value
 * @returns Percentage change (e.g., 10.5 for 10.5% increase)
 */
export function calculatePercentageChange(
  oldValue: string | bigint | number,
  newValue: string | bigint | number,
): number {
  const oldBig = BigInt(oldValue);
  const newBig = BigInt(newValue);

  if (oldBig === 0n) return newBig > 0n ? 100 : 0;

  const change = ((newBig - oldBig) * 10000n) / oldBig; // Multiply by 10000 for precision
  return Number(change) / 100; // Divide by 100 to get percentage
}

/**
 * Check if a balance change is within tolerance
 * Used for reconciling cross-chain trades with price fluctuations
 * @param expected Expected value
 * @param actual Actual value
 * @param toleranceUsd Tolerance in USD (default $10)
 * @returns True if within tolerance
 */
export function isWithinTolerance(
  expected: number,
  actual: number,
  toleranceUsd: number = 10,
): boolean {
  return Math.abs(expected - actual) <= toleranceUsd;
}

/**
 * Format a USD value for display
 * @param value USD value
 * @param decimals Number of decimal places (default 2)
 * @returns Formatted string (e.g., "$1,234.56")
 */
export function formatUsdValue(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Convert wei to gwei (commonly used for gas prices)
 * @param weiAmount Amount in wei
 * @returns Amount in gwei
 */
export function weiToGwei(weiAmount: string | bigint): string {
  return formatUnits(weiAmount, 9);
}

/**
 * Convert gwei to wei
 * @param gweiAmount Amount in gwei
 * @returns Amount in wei as bigint
 */
export function gweiToWei(gweiAmount: string | number): bigint {
  const parsed = parseUnits(gweiAmount.toString(), 9);
  // Convert BigNumber to bigint
  return BigInt(parsed.toString());
}
