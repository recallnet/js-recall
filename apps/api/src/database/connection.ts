import { drizzle } from "drizzle-orm/node-postgres";
import fs from "fs";
import { Pool } from "pg";

import * as relations from "@recallnet/comps-db/relations";
import * as schema from "@recallnet/comps-db/schema";

import { config } from "@/config/index.js";

/**
 * Database Connection Manager
 * Handles PostgreSQL connection pool and transactions
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  public db;

  private constructor() {
    // Configure SSL options based on config
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
    if (config.database.url) {
      // Use connection URL which includes all connection parameters
      const pool = new Pool({
        connectionString: config.database.url,
        ...sslConfig,
      });

      this.db = drizzle(pool, { schema: { ...schema, ...relations } });

      console.log(
        "[DatabaseConnection] Connected to PostgreSQL using connection URL",
      );
    } else {
      // Use individual connection parameters
      const pool = new Pool({
        user: config.database.username,
        password: config.database.password,
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        ...sslConfig,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
        connectionTimeoutMillis: 2000, // How long to wait for a connection to become available
      });

      this.db = drizzle(pool, { schema: { ...schema, ...relations } });

      console.log(
        `[DatabaseConnection] Connected to PostgreSQL at ${config.database.host}:${config.database.port}`,
      );
    }

    this.db.$client.on("error", (err: Error) => {
      console.error("Unexpected error on idle client", err);
      process.exit(-1);
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Close the pool
   */
  public async close(): Promise<void> {
    await this.db.$client.end();
  }
}
