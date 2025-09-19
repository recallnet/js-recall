import { drizzle } from "drizzle-orm/node-postgres";

import schema from "../../schema/index.js";

if (!process.env.VITE_DATABASE_URL) {
  throw new Error("VITE_DATABASE_URL is not set in environment variables");
}

export const db = drizzle(process.env.VITE_DATABASE_URL, { schema });
