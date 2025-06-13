import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { isPgSchema } from "drizzle-orm/pg-core";
import { reset, seed } from "drizzle-seed";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { fileURLToPath } from "url";

import { config } from "@/config/index.js";
import schema from "@/database/schema/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sslConfig = (() => {
  // If SSL is disabled in config, don't use SSL
  if (!config.database.ssl) {
    return { ssl: undefined };
  }

  // If a certificate is provided as an environment variable, use it
  const certBase64 = process.env.DB_CA_CERT_BASE64; // Suitable for Vercel deployments
  if (certBase64) {
    return {
      ssl: {
        ca: Buffer.from(certBase64, "base64").toString(),
        rejectUnauthorized: true,
      },
    };
  }

  // If a custom CA certificate path is provided, use it
  // This allows using self-signed certs while maintaining validation
  const caPath = process.env.DB_CA_CERT_PATH;
  if (caPath && fs.existsSync(caPath)) {
    return {
      ssl: {
        ca: fs.readFileSync(caPath).toString(),
        rejectUnauthorized: true,
      },
    };
  }

  // Default secure SSL configuration (for all environments)
  return { ssl: true };
})();

// Check if a connection URL is provided
// Use connection URL which includes all connection parameters
const pool = new Pool({
  connectionString: config.database.url,
  ...sslConfig,
});

export const db = drizzle({
  client: pool,
  schema,
});

console.log(
  "[DatabaseConnection] Connected to PostgreSQL using connection URL",
);

db.$client.on("error", (err: Error) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export async function resetDb() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Wait a bit before each attempt to let any pending transactions complete
      if (retryCount > 0) {
        const delay = Math.pow(2, retryCount) * 100; // Exponential backoff: 200ms, 400ms, 800ms
        console.log(
          `Retrying database reset (attempt ${retryCount + 1}/${maxRetries}) after ${delay}ms delay...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      await reset(db, schema);
      return; // Success, exit the retry loop
    } catch (error: unknown) {
      retryCount++;

      // Check if it's a deadlock error
      const errorMessage = error instanceof Error ? error.message : "";
      const errorCode =
        error && typeof error === "object" && "code" in error ? error.code : "";
      const isDeadlock =
        errorMessage.includes("deadlock") ||
        errorCode === "40P01" ||
        errorCode === "40001";

      if (isDeadlock && retryCount < maxRetries) {
        console.warn(
          `Database deadlock detected on attempt ${retryCount}/${maxRetries}, retrying...`,
        );
        continue;
      }

      // If it's not a deadlock or we've exhausted retries, throw the error
      console.error(
        `Database reset failed after ${retryCount} attempts:`,
        error,
      );
      throw error;
    }
  }
}

export async function dropAll() {
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

export async function migrateDb() {
  // Run normal Drizzle migrations
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "../../drizzle"),
  });
}

export async function seedDb() {
  await seed(db, schema);
}
