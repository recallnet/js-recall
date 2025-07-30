/**
 * Utility functions for agent handle generation and validation
 */

/**
 * Converts a name to a valid handle format
 * @param name The display name to convert
 * @returns A valid handle string
 * @example
 * generateHandleFromName("John Doe") // returns "john_doe"
 * generateHandleFromName("Agent@123!") // returns "agent123"
 * generateHandleFromName("My Cool Agent") // returns "my_cool_agent"
 */
export function generateHandleFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // Replace non-alphanumeric chars with underscore
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .substring(0, 50); // Enforce max length
}

/**
 * Validates if a string is a valid handle format
 * @param handle The handle to validate
 * @returns True if valid, false otherwise
 */
export function isValidHandle(handle: string): boolean {
  // Handle must be:
  // - 1-50 characters long
  // - Lowercase alphanumeric and underscores only
  // - Cannot start or end with underscore
  const handleRegex = /^[a-z0-9]([a-z0-9_]{0,48}[a-z0-9])?$/;
  return handleRegex.test(handle);
}

/**
 * Appends a number suffix to make a handle unique
 * @param baseHandle The base handle to make unique
 * @param suffix The number to append
 * @returns The handle with suffix
 * @example
 * appendHandleSuffix("john_doe", 1) // returns "john_doe1"
 */
export function appendHandleSuffix(baseHandle: string, suffix: number): string {
  const suffixStr = suffix.toString();
  const maxBaseLength = 50 - suffixStr.length;
  const truncatedBase = baseHandle.substring(0, maxBaseLength);
  return `${truncatedBase}${suffixStr}`;
}
