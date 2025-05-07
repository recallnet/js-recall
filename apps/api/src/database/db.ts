import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { isPgSchema } from "drizzle-orm/pg-core";
import { reset, seed } from "drizzle-seed";
import fs from "fs";
import path from "path";
import { Client, Pool } from "pg";
import { fileURLToPath } from "url";

import * as relations from "@recallnet/comps-db/relations";
import * as schema from "@recallnet/comps-db/schema";

import { config } from "@/config/index.js";

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
  schema: { ...schema, ...relations },
});

console.log(
  "[DatabaseConnection] Connected to PostgreSQL using connection URL",
);

db.$client.on("error", (err: Error) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export async function resetDb() {
  await reset(db, schema);
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
  await ensureDatabaseExists();
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "../../drizzle"),
  });
}

export async function seedDb() {
  await seed(db, schema);
}

/**
 * Ensures the target database (from DATABASE_URL) exists. If it does not, creates it.
 * Connects to the 'postgres' database to perform the check and creation.
 *
 * @throws Error if DATABASE_URL is not set or database name cannot be determined.
 * @example
 * await ensureDatabaseExists();
 */
export async function ensureDatabaseExists(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const url = new URL(process.env.DATABASE_URL);

  const dbName = url.pathname.slice(1);

  // Connect to postgres database to create our production database
  const client = new Client({
    host: url.hostname || "localhost",
    port: parseInt(url.port || "5432"),
    user: url.username || "postgres",
    password: url.password || "postgres",
    database: "postgres", // Connect to default postgres database
  });

  try {
    await client.connect();
    console.log(`Connected to postgres to check if database ${dbName} exists`);

    // Check if our production database exists
    const result = await client.query(
      `
      SELECT EXISTS(
        SELECT FROM pg_database WHERE datname = $1
      );
    `,
      [dbName],
    );

    if (!result.rows[0].exists) {
      console.log(`Database "${dbName}" does not exist, creating it...`);
      await client.query(`CREATE DATABASE "${dbName}";`);
      console.log(`Database "${dbName}" created successfully`);
    } else {
      console.log(`Database "${dbName}" already exists`);
    }
  } catch (error) {
    console.error("Error ensuring production database:", error);
    throw error;
  } finally {
    await client.end();
  }
}
