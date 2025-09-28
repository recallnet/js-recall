/**
 * TypeScript utility functions for type safety and exhaustive checking
 */

/**
 * Asserts that a value is unreachable, used for exhaustive switch statements.
 * This function should never be called at runtime - it's a TypeScript compile-time safety mechanism.
 *
 * @param x The value that should be unreachable (typed as `never`)
 * @throws {Error} Always throws an error if called
 * @example
 * ```typescript
 * switch (status) {
 *   case "pending":
 *     return "waiting";
 *   case "completed":
 *     return "done";
 *   default:
 *     assertUnreachable(status); // TypeScript will error if new status values are added
 * }
 * ```
 */
export function assertUnreachable(x: never): never {
  throw new Error(`Unhandled case: ${x}`);
}
