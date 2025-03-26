/**
 * JSON stringify with bigint support.
 * @param obj - The object to stringify.
 * @returns The stringified object.
 */
export function jsonStringify(obj: unknown) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

/**
 * The result of a function that succeeds.
 */
export type SuccessResult<T> = {
  success: true;
  result: T;
};

/**
 * The result of a function that fails.
 */
export type ErrorResult = {
  success: false;
  error: string;
};

/**
 * The result of a function.
 */
export type Result<T> = SuccessResult<T> | ErrorResult;
