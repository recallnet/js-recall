import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import fs from 'fs';

/**
 * Database Connection Manager
 * Handles PostgreSQL connection pool and transactions
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;

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
            ca: Buffer.from(certBase64, 'base64').toString(),
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
      this.pool = new Pool({
        connectionString: config.database.url,
        ...sslConfig,
      });

      console.log('[DatabaseConnection] Connected to PostgreSQL using connection URL');
    } else {
      // Use individual connection parameters
      this.pool = new Pool({
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

      console.log(
        `[DatabaseConnection] Connected to PostgreSQL at ${config.database.host}:${config.database.port}`,
      );
    }

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
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
   * Get a client from the pool
   */
  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute a query using the pool
   * @param text Query text
   * @param params Query parameters
   */
  public async query<T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    try {
      const res = await this.pool.query<T>(text, params);
      return res;
    } catch (err) {
      console.error(`[DatabaseConnection] Error executing query: ${text}`, err);
      throw err;
    }
  }

  /**
   * Execute a transaction
   * @param callback Function to execute within the transaction
   */
  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Close the pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}
