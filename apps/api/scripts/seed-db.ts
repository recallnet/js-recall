import { seed } from "drizzle-seed";
import { pathToFileURL } from "url";

import * as schema from "@recallnet/comps-db/schema";

import { DatabaseConnection } from "@/database/connection.js";

const conn = DatabaseConnection.getInstance();

export async function seedDb() {
  await seed(conn.db, schema);
}

// Run if called directly
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seedDb();
}
