import { drizzle } from "drizzle-orm/node-postgres";

import schema from "@recallnet/db/schema";

export const db = drizzle(process.env.POSTGRES_URL || "", { schema });
