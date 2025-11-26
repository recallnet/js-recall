/**
 * Database error utility functions
 * Shared utilities for handling database errors across controller and service layers
 */

/**
 * Check if the error is a unique constraint violation
 * @param error The error to check
 * @returns The constraint if it is a unique constraint violation, undefined otherwise
 */
export function checkUniqueConstraintViolation(
  error: unknown,
): string | undefined {
  const e = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  if (e?.code === "23505") {
    return e.constraint;
  }
  return undefined;
}

/**
 * Check if the error is a unique constraint violation for a user
 * @param error The error to check
 * @returns The constraint field if it is a unique constraint violation, undefined otherwise
 */
export function checkUserUniqueConstraintViolation(
  error: unknown,
): string | undefined {
  const constraint = checkUniqueConstraintViolation(error);
  if (constraint) {
    return constraint.includes("wallet")
      ? "walletAddress"
      : constraint.includes("email")
        ? "email"
        : constraint.includes("privy")
          ? "privyId"
          : "unique value";
  }
  return undefined;
}

/**
 * Check if the error is a foreign key constraint violation
 * @param error The error to check
 * @returns The constraint if it is a foreign key violation, undefined otherwise
 */
export function checkForeignKeyViolation(error: unknown): string | undefined {
  const e = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  if (e?.code === "23503") {
    return e.constraint;
  }
  return undefined;
}
