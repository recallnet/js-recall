import { pushSchema as kitPushSchema } from "drizzle-kit/api";

import schema from "../index.js";
import { Database } from "../types.js";

export async function pushSchema(db: Database) {
  return kitPushSchema(schema, db as any);
}
