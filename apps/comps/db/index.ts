import { sql } from "@vercel/postgres";
import { drizzle as nDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as vDrizzle } from "drizzle-orm/vercel-postgres";

import schema from "@recallnet/db/schema";

export const db =
  process.env.NODE_ENV === "production"
    ? vDrizzle({ client: sql, schema })
    : nDrizzle(process.env.POSTGRES_URL!, { schema });
