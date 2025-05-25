/**
 * Utility functions for the application
 */

/**
 * Shorten an Ethereum address for display
 *
 * @param address The Ethereum address to shorten
 * @param startLength The number of characters to show at the start
 * @param endLength The number of characters to show at the end
 * @returns The shortened address
 */
export function shortenAddress(
  address: string,
  startLength = 4,
  endLength = 4,
): string {
  if (!address) {
    return "";
  }

  // Ensure startLength and endLength are valid
  const start = Math.min(startLength, address.length);
  const end = Math.min(endLength, address.length - start);

  if (start + end >= address.length) {
    return address;
  }

  return `${address.slice(0, start)}...${address.slice(-end)}`;
}
