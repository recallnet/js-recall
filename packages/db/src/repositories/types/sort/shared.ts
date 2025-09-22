import { z } from "zod";

/**
 * Shared paging schema for all endpoints
 */
export const PagingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
