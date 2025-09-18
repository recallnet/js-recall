import { drizzle } from "drizzle-orm/node-postgres";

import schema from "./index.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _db = drizzle("", { schema });

export type Database = typeof _db;

// Extract the transaction type from the Drizzle client
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
