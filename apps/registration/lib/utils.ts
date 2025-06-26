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

/**
 * Remove legacy WalletConnect local storage key `@appkit/active_caip_network_id`.
 *
 * The older app used the Recall chain ID `2481632`, and WalletConnect has a bug where a modal
 * always opens if the local storage key is set to a different chain ID value for the variable
 * `@appkit/active_caip_network_id`. Note: the new value is `eip155:85432` and gets set
 * automatically by WalletConnect.
 *
 * @param localStorage - The `localStorage` object to remove the key from
 * @returns void
 */
export function removeLegacyWalletConnectLocalStorage(
  localStorage: Storage,
): void {
  const legacyValue = "eip155:2481632";
  const activeCaipNetworkId = localStorage.getItem(
    "@appkit/active_caip_network_id",
  );
  if (activeCaipNetworkId === legacyValue) {
    localStorage.removeItem("@appkit/active_caip_network_id");
  }
}
