import { sql } from "drizzle-orm";
import { isPgSchema } from "drizzle-orm/pg-core";

import schema from "../schema/index.js";
import { Database } from "../types.js";

export async function dropAll(db: Database) {
  const schemas = Object.values(schema)
    .filter(isPgSchema)
    .map((s) => {
      return isPgSchema(s) ? s.schemaName : "";
    });
  await db.transaction(async (tx) => {
    if (schemas.length > 0) {
      await tx.execute(
        sql.raw(`drop schema if exists ${schemas.join(", ")} cascade`),
      );
    }
    await tx.execute(sql.raw(`drop schema if exists public cascade`));
    await tx.execute(sql.raw(`drop schema if exists drizzle cascade`));
    await tx.execute(sql.raw(`create schema public`));
  });
}
