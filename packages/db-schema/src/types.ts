import { drizzle } from "drizzle-orm/node-postgres";

import schema from "./index.js";

const db = drizzle("", { schema });

export type Database = typeof db;

// Extract the transaction type from the Drizzle client
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
