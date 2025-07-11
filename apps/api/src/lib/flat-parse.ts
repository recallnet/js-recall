import { z } from "zod/v4";

export type { FlatParseResult };
export { flatParse };

/**
 * Result type for flat parsing operations.
 *
 * This type represents the result of a Zod schema validation operation,
 * providing a simplified interface compared to Zod's default error structure.
 *
 * @template T - The inferred type from the Zod schema
 *
 * @example
 * ```typescript
 * const result: FlatParseResult<User> = flatParse(UserSchema, input);
 * if (result.success) {
 *   // result.data is of type User
 *   console.log(result.data.name);
 * } else {
 *   // result.error is a string with all validation errors concatenated
 *   console.error(result.error);
 * }
 * ```
 */
type FlatParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Flattens Zod's validation result into a simpler structure with a single error message.
 *
 * This utility function takes a Zod schema and input data, validates the input against
 * the schema, and returns a simplified result object. Unlike Zod's default `safeParse`,
 * which returns an `error` object with detailed issue information, this function
 * concatenates all validation error messages into a single string.
 *
 * **Use cases:**
 * - When you need a simple success/error boolean check
 * - When you want to display all validation errors as a single message
 * - When integrating with APIs that expect simple error strings
 * - When you don't need the detailed error structure that Zod provides
 *
 * **Trade-offs:**
 * - ✅ Simpler error handling
 * - ✅ Single error message for all validation failures
 * - ❌ Loss of detailed error information (field names, error codes, etc.)
 * - ❌ Less granular error handling capabilities
 *
 * @template TSchema - The Zod schema type
 * @param schema - The Zod schema to validate against
 * @param input - The input data to validate
 * @returns A FlatParseResult with either success data or a concatenated error message
 *
 * @example
 * ```typescript
 * // Basic usage
 * const userSchema = z.object({
 *   name: z.string().min(1, "Name is required"),
 *   email: z.string().email("Invalid email"),
 *   age: z.number().min(18, "Must be 18 or older")
 * });
 *
 * const result = flatParse(userSchema, { name: "", email: "invalid", age: 16 });
 * if (!result.success) {
 *   console.log(result.error);
 *   // Output: "Name is required, Invalid email, Must be 18 or older"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In an Express route handler
 * app.post('/users', (req, res) => {
 *   const result = flatParse(UserSchema, req.body);
 *   if (!result.success) {
 *     return res.status(400).json({ error: result.error });
 *   }
 *
 *   // result.data is fully typed and validated
 *   const user = result.data;
 *   // ... process user
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Comparison with Zod's safeParse
 * // Zod's approach:
 * const zodResult = userSchema.safeParse(input);
 * if (!zodResult.success) {
 *   // zodResult.error.issues is an array of detailed error objects
 *   const errors = zodResult.error.issues.map(issue =>
 *     `${issue.path.join('.')}: ${issue.message}`
 *   );
 *   console.log(errors);
 * }
 *
 * // This utility's approach:
 * const flatResult = flatParse(userSchema, input);
 * if (!flatResult.success) {
 *   // flatResult.error is a single string with all messages
 *   console.log(flatResult.error);
 * }
 * ```
 */
function flatParse<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): FlatParseResult<z.TypeOf<TSchema>> {
  const { success, error, data } = z.safeParse(schema, input);
  if (success) {
    return { success: true, data: data };
  } else {
    const message = error?.issues.map((i) => i.message).join(", ");
    return { success: false, error: message };
  }
}
