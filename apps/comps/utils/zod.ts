import { z } from "zod";

export function asOptionalStringWithoutEmpty<T extends z.ZodString>(schema: T) {
  return z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    schema.optional(),
  );
}
