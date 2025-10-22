import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

/**
 * Validates input against a Zod schema and throws a single ApiError on failure.
 *
 * This utility function takes a Zod schema and input data, validates the input against
 * the schema, and returns the validated data if successful. If validation fails,
 * it throws an ApiError with a concatenated error message for all validation issues.
 * Example error messages:
 * - Single invalid field (with request part): "Invalid request body: name (expected string, received number)"
 * - Multiple invalid fields (without request part): "Invalid request: name (expected string, received number); age (expected number, received string)"
 * - Pure schema validation error: "Invalid request: passwords do not match"
 *
 * @template TSchema - The Zod schema type
 * @param schema - The Zod schema to validate against
 * @param input - The input data to validate
 * @param requestPart - Optional string to specify which part of the request is being validated (for error messages)
 * @returns The validated data, fully typed as z.TypeOf<TSchema>
 * @throws {ApiError} If validation fails, throws with a concatenated error message
 */
export function flatParse<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  requestPart?: string,
): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  } else {
    const message = result.error.issues
      .map((issue) => {
        // Clean up the error message by removing redundant "Invalid input: " prefix, include the
        // invalid field (if applicable), and improve casing for mid-sentence words.
        const cleanMessage = issue.message
          .replace(/^Invalid input: /, "")
          .replace(/^./, (char) => char.toLowerCase());
        const message = (fieldPath?: string) =>
          `${fieldPath ? `${fieldPath} (${cleanMessage})` : cleanMessage}`;
        return issue.path.length > 0
          ? message(issue.path.join("."))
          : message();
      })
      .join("; ");
    if (requestPart) {
      throw new ApiError(400, `Invalid request ${requestPart}: ${message}`);
    } else {
      throw new ApiError(400, `Invalid request: ${message}`);
    }
  }
}
