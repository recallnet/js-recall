import { drizzle } from "drizzle-orm/node-postgres";

import schema from "../../index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const db = drizzle(process.env.DATABASE_URL, { schema });
