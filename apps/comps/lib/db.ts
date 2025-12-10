import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import schema from "@recallnet/db/schema";

import { config } from "@/config/private";

const ca = process.env.DATABASE_CA_CERT
  ? Buffer.from(process.env.DATABASE_CA_CERT, "base64").toString("utf8")
  : undefined;

const sslConfig = () => {
  if (ca) {
    return {
      ca,
      rejectUnauthorized: true,
    };
  }
  return false;
};

const pool = new Pool({
  connectionString: config.database.mainUrl,
  ssl: sslConfig(),
});

export const db = drizzle(pool, { schema });

const poolReadReplica = new Pool({
  connectionString: config.database.readReplicaUrl,
  ssl: sslConfig(),
});

export const dbReadReplica = drizzle(poolReadReplica, { schema });
