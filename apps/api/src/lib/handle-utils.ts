/**
 * Utility functions for agent handle generation and validation
 */

const MAX_HANDLE_LENGTH = 15;

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
    .replace(/[^a-z0-9_]+/g, "_") // Replace non-alphanumeric chars with underscore
    .replace(/^_+/g, "") // Remove leading underscores
    .replace(/_+/g, "_") // Replace two or more underscores in a row with a single underscore
    .substring(0, MAX_HANDLE_LENGTH); // Enforce max length
}

/**
 * Validates if a string is a valid handle format
 * @param handle The handle to validate
 * @returns True if valid, false otherwise
 */
export function isValidHandle(handle: string): boolean {
  // Handle must be:
  // - 1-15 characters long
  // - Lowercase alphanumeric and underscores only
  // - Cannot start with underscore
  const handleRegex = new RegExp(
    `^[a-z0-9][a-z0-9_]{0,${MAX_HANDLE_LENGTH - 1}}$`,
  );
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
  const maxBaseLength = MAX_HANDLE_LENGTH - suffixStr.length;
  const truncatedBase = baseHandle.substring(0, maxBaseLength);
  return `${truncatedBase}${suffixStr}`;
}
