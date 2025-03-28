/**
 * Options for customizing the address display format.
 */
export interface DisplayAddressOptions {
  /**
   * The number of characters to show at the start and end of the address.
   * @default 4
   */
  numChars?: number;

  /**
   * The separator string to use between the start and end portions of the address.
   * @default "…"
   */
  separator?: string;
}

/**
 * Formats an Ethereum address for display by showing only the first and last few characters.
 *
 * This function takes a full Ethereum address and creates a shortened version that's more
 * readable while still being recognizable. It shows a specified number of characters from
 * the start and end of the address, separated by a customizable separator string.
 *
 * @example
 * ```typescript
 * // Basic usage (shows first 4 and last 4 characters)
 * displayAddress("0x1234567890abcdef1234567890abcdef12345678")
 * // Returns: "0x12…5678"
 *
 * // Custom number of characters
 * displayAddress("0x1234567890abcdef1234567890abcdef12345678", { numChars: 6 })
 * // Returns: "0x1234…345678"
 *
 * // Custom separator
 * displayAddress("0x1234567890abcdef1234567890abcdef12345678", { separator: "..." })
 * // Returns: "0x12...5678"
 * ```
 *
 * @param address - The Ethereum address to format
 * @param options - Optional configuration for the display format
 * @returns The formatted address string
 *
 * @throws Will throw an error if the address is shorter than 2 * numChars
 */
export function displayAddress(
  address: string,
  options?: DisplayAddressOptions,
) {
  const numChars = options?.numChars ?? 4;
  const separator = options?.separator ?? "…";

  if (address.length < numChars * 2) {
    throw new Error(
      "Address is too short for the specified number of characters",
    );
  }

  return `${address.slice(0, numChars)}${separator}${address.slice(-numChars)}`;
}
