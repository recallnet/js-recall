import { z } from "zod/v4";

import { ApiError } from "@/middleware/errorHandler.js";

export { flatParse };

/**
 * Validates input against a Zod schema and throws a single ApiError on failure.
 *
 * This utility function takes a Zod schema and input data, validates the input against
 * the schema, and returns the validated data if successful. If validation fails,
 * it throws an ApiError with a concatenated error message for all validation issues.
 *
 * @template TSchema - The Zod schema type
 * @param schema - The Zod schema to validate against
 * @param input - The input data to validate
 * @param requestPart - Optional string to specify which part of the request is being validated (for error messages)
 * @returns The validated data, fully typed as z.TypeOf<TSchema>
 * @throws {ApiError} If validation fails, throws with a concatenated error message
 */
function flatParse<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  requestPart?: string,
): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  } else {
    const message = result.error.issues
      .map((i: { message: string }) => i.message)
      .join(", ");
    if (requestPart) {
      throw new ApiError(400, `Invalid request ${requestPart}: ${message}`);
    } else {
      throw new ApiError(400, `Invalid request: ${message}`);
    }
  }
}
