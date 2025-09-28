import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import schema from "@recallnet/db/schema";

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
};

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: sslConfig(),
});

export const db = drizzle(pool, { schema });
