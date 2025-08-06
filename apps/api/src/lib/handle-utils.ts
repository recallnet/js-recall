import {
  AgentHandleSchema,
  MAX_HANDLE_LENGTH,
  MIN_HANDLE_LENGTH,
} from "@/types/index.js";

/**
 * Utility functions for agent handle generation and validation
 */

/**
 * Converts a name to a valid handle format
 * @param name The display name to convert
 * @returns A valid handle string
 * @example
 * generateHandleFromName("John Doe") // returns "john_doe"
 * generateHandleFromName("Agent@123!") // returns "agent_123_"
 * generateHandleFromName("My Cool Agent") // returns "my_cool_agent"
 * generateHandleFromName("_underscore") // returns "_underscore"
 */
export function generateHandleFromName(name: string): string {
  const handle = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_") // Replace non-alphanumeric chars with underscore
    .replace(/_+/g, "_") // Replace two or more underscores in a row with a single underscore
    .substring(0, MAX_HANDLE_LENGTH); // Enforce max length

  // Ensure minimum length of 3 characters
  if (handle.length < MIN_HANDLE_LENGTH) {
    return (
      handle +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 5 - handle.length)
    );
  }

  return handle;
}

/**
 * Validates if a string is a valid handle format
 * @param handle The handle to validate
 * @returns True if valid, false otherwise
 */
export function isValidHandle(handle: string): boolean {
  return AgentHandleSchema.safeParse(handle).success;
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
