/**
 * Removes a specified prefix from a string
 *
 * @param key - The input string from which to remove the prefix
 * @param prefix - The prefix to remove
 * @returns The input string with the prefix removed
 * @example
 * ```ts
 * const result = removePrefix("prefixValue", "prefix");
 * // Result: "Value"
 * ```
 */
export function removePrefix(key: string, prefix: string) {
  return key.replace(new RegExp(`^${prefix ?? ""}`), "");
}
