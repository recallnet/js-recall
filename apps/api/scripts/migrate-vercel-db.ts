import { parse } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";
import { z } from "zod";

import schema from "@recallnet/db/schema";
import { migrateDb } from "@recallnet/db/utils";

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      "DATABASE_URL must be a PostgreSQL URL",
    ),
  DATABASE_CA_CERT: z.string().optional(),
});

/**
 * Apply the API migrations using a downloaded Vercel environment file.
 *
 * @param environmentFile - Path to the file produced by `vercel pull`.
 * @returns Resolves after migrations complete and the connection closes.
 */
export async function migrateVercelDatabase(
  environmentFile: string,
): Promise<void> {
  const environment = environmentSchema.parse(
    parse(await readFile(environmentFile)),
  );
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    // Keep the session-level migration lock and migration queries on one connection.
    max: 1,
    idleTimeoutMillis: 0,
    ssl: environment.DATABASE_CA_CERT
      ? {
          ca: Buffer.from(environment.DATABASE_CA_CERT, "base64").toString(
            "utf8",
          ),
          rejectUnauthorized: true,
        }
      : false,
  });
  try {
    await migrateDb(
      drizzle(pool, { schema }),
      pool,
      fileURLToPath(new URL("../drizzle", import.meta.url)),
      {
        info: (message) => {
          if (typeof message === "string") console.log(message);
        },
        error: (message) => console.error(message),
      },
    );
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const environmentFile = process.argv[2];
  if (!environmentFile) {
    console.error(
      "Usage: pnpm --filter api db:migrate:vercel <environment-file>",
    );
    process.exitCode = 1;
  } else {
    migrateVercelDatabase(environmentFile).catch((error: unknown) => {
      console.error(
        "Database migration failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exitCode = 1;
    });
  }
}
