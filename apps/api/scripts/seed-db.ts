import { pathToFileURL } from "url";

import { seedDb } from "@/database/db.js";

export async function seed() {
  await seedDb();
}

// Run if called directly
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seed();
}
