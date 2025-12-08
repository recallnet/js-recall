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
 */
export function formatTokenAmount(
  amount: string | bigint,
  decimals: number,
): string {
  return formatUnits(amount, decimals);
}

/**
 * Convert a human-readable amount to raw token amount
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const parsed = parseUnits(amount, decimals);
  return BigInt(parsed.toString());
}

/**
 * Get token decimals from cache or provide default
 */
export function getCachedTokenDecimals(tokenAddress: string): number {
  const normalizedAddress = tokenAddress.toLowerCase();
  return decimalCache.get(normalizedAddress) || 18;
}

/**
 * Cache token decimals for future use
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
 */
export function hexToDecimal(hexString: string): string {
  const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;

  if (!cleanHex || cleanHex === "0") return "0";

  return BigInt(`0x${cleanHex}`).toString();
}

/**
 * Safe addition of token amounts with overflow protection
 */
export function sumTokenAmounts(amounts: (string | bigint)[]): bigint {
  return amounts.reduce((sum: bigint, amount) => {
    const amountBig = typeof amount === "string" ? BigInt(amount) : amount;
    return sum + amountBig;
  }, 0n);
}

/**
 * Safely convert value to BigInt with validation
 */
export function safeToBigInt(value: string | bigint | number): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Cannot convert decimal number ${value} to BigInt`);
    }
    return BigInt(value);
  }

  // Handle string input
  const trimmed = value.trim();
  if (trimmed === "") {
    return 0n;
  }

  // Validate string is a valid integer (allows negative)
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(
      `Cannot convert "${value}" to BigInt: must be a valid integer`,
    );
  }

  return BigInt(trimmed);
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
  oldValue: string | bigint | number,
  newValue: string | bigint | number,
): number {
  const oldBig = safeToBigInt(oldValue);
  const newBig = safeToBigInt(newValue);

  if (oldBig === 0n) return newBig > 0n ? 100 : newBig < 0n ? -100 : 0;

  const change = ((newBig - oldBig) * 10000n) / oldBig;

  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

  if (change > MAX_SAFE || change < MIN_SAFE) {
    return change > 0n ? Infinity : -Infinity;
  }

  return Number(change) / 100;
}

/**
 * Check if a balance change is within tolerance
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
 */
export function weiToGwei(weiAmount: string | bigint): string {
  return formatUnits(weiAmount, 9);
}

/**
 * Convert gwei to wei
 */
export function gweiToWei(gweiAmount: string | number): bigint {
  const parsed = parseUnits(gweiAmount.toString(), 9);
  return BigInt(parsed.toString());
}
