import { config } from "dotenv";
import { sql } from "drizzle-orm";
import path from "path";
import { Client } from "pg";

// Import test database utilities
import { closeDb, db, dropAll, migrateDb, resetDb } from "./database.js";

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

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Load environment variables if not already loaded
    config({ path: path.resolve(__dirname, "../../.env.test") });
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
      console.log(
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
        console.log(`Test database "${dbName}" does not exist, creating it...`);
        await client.query(`CREATE DATABASE "${dbName}";`);
        console.log(`Test database "${dbName}" created successfully`);
      } else {
        console.log(`Test database "${dbName}" already exists`);
      }
    } catch (error) {
      console.error("Error ensuring test database exists:", error);
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
      console.log("Database already initialized");
      return;
    }

    console.log("Starting database initialization...");

    try {
      // First ensure the test database exists
      await this.ensureTestDatabaseExists();

      // Check if we can connect to the database
      try {
        await db.execute(sql.raw("SELECT 1"));
        console.log(`Connected to database successfully`);
      } catch (error) {
        console.error("Error connecting to database:", error);
        throw error;
      }

      // Drop all existing tables (if any) to ensure a clean slate
      console.log("Dropping all existing tables to ensure a clean schema...");
      try {
        await dropAll();
        console.log("All existing tables have been dropped successfully");
      } catch (error) {
        console.warn("Error dropping tables:", error);
        console.log("Continuing with initialization...");
      }

      // Use the production database initialization code directly
      // This ensures the schema is consistent with production
      console.log("[Database] Migrating database schema...");
      await migrateDb();

      console.log("Database schema initialized successfully");
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
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
      console.log("Closing database connections...");

      // Close the database connection pools
      await closeDb();

      this.initialized = false;
      console.log("Database connections closed successfully");
    } catch (error) {
      console.error("Error closing database connections:", error);
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
