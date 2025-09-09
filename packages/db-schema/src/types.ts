import { drizzle } from "drizzle-orm/node-postgres";

import schema from "./index.js";

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

// Extract the transaction type from the Drizzle client
export type Transaction = Parameters<
  Parameters<DrizzleClient["transaction"]>[0]
>[0];
