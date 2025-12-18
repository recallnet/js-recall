import { config } from "dotenv";
import { sql } from "drizzle-orm";
import path from "path";
import { Client } from "pg";
import { fileURLToPath } from "url";

// Import test database utilities
import { closeDb, db, dropAll, migrateDb, resetDb } from "./database.js";
import { createLogger } from "./logger.js";

/**
 * Database Manager for E2E Tests
 *
 * This utility provides a standardized way to manage database state for end-to-end tests.
 *
 * Features:
 * - Uses the same connection pool as the application
 * - Complete database reset (drops all tables) before initialization
 * - Direct use of production schema initialization code for consistency
 */
export class DbManager {
  private static instance: DbManager;
  private initialized = false;
  private logger = createLogger("DbManager");
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    config({ path: path.resolve(currentDir, "../../.env.test") });
  }

  /**
   * Get the singleton instance of the database manager
   */
  public static getInstance(): DbManager {
    if (!DbManager.instance) {
      DbManager.instance = new DbManager();
    }
    return DbManager.instance;
  }

  /**
   * Ensure the test database exists by connecting to postgres and creating it if needed
   */
  private async ensureTestDatabaseExists(): Promise<void> {
    // Get database configuration from environment
    const url = new URL(
      process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/postgres",
    );

    const dbName = url.pathname.slice(1);

    // Connect to postgres database to create our test database
    const client = new Client({
      host: url.hostname || "localhost",
      port: parseInt(url.port || "5432"),
      user: url.username || "postgres",
      password: url.password || "postgres",
      database: "postgres", // Connect to default postgres database
    });

    try {
      await client.connect();
      this.logger.debug(
        `Connected to postgres to check if database ${dbName} exists`,
      );

      // Check if our test database exists
      const result = await client.query(
        `
        SELECT EXISTS(
          SELECT FROM pg_database WHERE datname = $1
        );
      `,
        [dbName],
      );

      if (!result.rows[0].exists) {
        this.logger.debug(
          `Test database "${dbName}" does not exist, creating it...`,
        );
        await client.query(`CREATE DATABASE "${dbName}";`);
        this.logger.debug(`Test database "${dbName}" created successfully`);
      } else {
        this.logger.debug(`Test database "${dbName}" already exists`);
      }
    } catch (error) {
      this.logger.error({ error }, "Error ensuring test database exists:");
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Initialize the database for testing
   * - Creates a fresh database if it doesn't exist
   * - Drops all existing tables (if any)
   * - Runs the initialization script using production code
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug("Database already initialized");
      return;
    }

    this.logger.debug("Starting database initialization...");

    try {
      // First ensure the test database exists
      await this.ensureTestDatabaseExists();

      // Check if we can connect to the database
      try {
        await db.execute(sql.raw("SELECT 1"));
        this.logger.debug(`Connected to database successfully`);
      } catch (error) {
        this.logger.error({ error }, "Error connecting to database:");
        throw error;
      }

      // Drop all existing tables (if any) to ensure a clean slate
      this.logger.debug(
        "Dropping all existing tables to ensure a clean schema...",
      );
      try {
        await dropAll();
        this.logger.debug("All existing tables have been dropped successfully");
      } catch (error) {
        this.logger.warn({ error }, "Error dropping tables:");
        this.logger.debug("Continuing with initialization...");
      }

      // Use the production database initialization code directly
      // This ensures the schema is consistent with production
      this.logger.debug("[Database] Migrating database schema...");
      await migrateDb();

      this.logger.debug("Database schema initialized successfully");
      this.initialized = true;
    } catch (error) {
      this.logger.error({ error }, "Failed to initialize database:");
      throw error;
    }
  }

  /**
   * Reset the database to a clean state
   * - Truncates all tables
   * - Resets sequences
   */
  public async resetDatabase(): Promise<void> {
    if (!this.initialized) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    await resetDb();
  }

  /**
   * Connect to the database
   * @returns The database connection
   */
  public async connect() {
    return db;
  }

  /**
   * Close the database connection
   * Properly closes database connection pools to prevent connection leaks
   */
  public async close(): Promise<void> {
    try {
      this.logger.debug("Closing database connections...");

      // Close the database connection pools
      await closeDb();

      this.initialized = false;
      this.logger.debug("Database connections closed successfully");
    } catch (error) {
      this.logger.error({ error }, "Error closing database connections:");
      // Don't throw the error to avoid masking test failures
      this.initialized = false;
    }
  }
}

// Export a singleton instance for easy access
export const dbManager = DbManager.getInstance();

// Export helper functions for backward compatibility
export async function initializeDb(): Promise<void> {
  return dbManager.initialize();
}

export async function closeManagerDb(): Promise<void> {
  return dbManager.close();
}

export async function resetDatabase(): Promise<void> {
  return dbManager.resetDatabase();
}

export async function connectToDb(): Promise<typeof db> {
  return dbManager.connect();
}
