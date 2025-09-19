import { createRequire } from "node:module";

import schema from "../schema/index.js";
import { Database } from "../types.js";

const require = createRequire(import.meta.url);
const { pushSchema: kitPushSchema } =
  require("drizzle-kit/api") as typeof import("drizzle-kit/api");

export async function pushSchema(db: Database) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return kitPushSchema(schema, db as any);
}
