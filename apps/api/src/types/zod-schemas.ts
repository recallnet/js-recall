import { z } from "zod/v4";

export const queryParams = z.object({
    sort: z.string(),
    limit: z.number().min(1).max(100),
    offset: z.number().min(0)
});

export type QueryParams = z.infer<typeof queryParams>;
