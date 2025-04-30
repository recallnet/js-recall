import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";

import * as relations from "./relations.js";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  config({ path: [".env.local", ".env"] });
}

export const db = drizzle(process.env.DATABASE_URL || "", {
  schema: { ...schema, ...relations },
});
