import { PoolClient } from 'pg';
import path from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';
import { initializeDatabase } from '../../src/database'; // Import production initialization code
import { DatabaseConnection } from '../../src/database/connection'; // Use the main connection class
import { dropAllTables } from '../../scripts/drop-all-tables';

/**
 * Database Manager for E2E Tests
 *
 * This utility provides a standardized way to manage database state for end-to-end tests.
 * It uses the same DatabaseConnection as the main application for consistency.
 *
 * Features:
 * - Uses the same connection pool as the application
 * - Complete database reset (drops all tables) before initialization
 * - Direct use of production schema initialization code for consistency
 */
export class DbManager {
  private static instance: DbManager;
  private dbConnection: DatabaseConnection;
  private initialized = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Load environment variables if not already loaded
    config({ path: path.resolve(__dirname, '../../.env.test') });

    // Use the main application's database connection
    this.dbConnection = DatabaseConnection.getInstance();
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
   * Get the database connection for direct pool access
   */
  public getPool(): DatabaseConnection {
    return this.dbConnection;
  }

  /**
   * Ensure the test database exists by connecting to postgres and creating it if needed
   */
  private async ensureTestDatabaseExists(): Promise<void> {
    // Get database configuration from environment
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'trading_simulator_test',
    };

    // Connect to postgres database to create our test database
    const client = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'postgres', // Connect to default postgres database
    });

    try {
      await client.connect();
      console.log(`Connected to postgres to check if database ${dbConfig.database} exists`);

      // Check if our test database exists
      const result = await client.query(
        `
        SELECT EXISTS(
          SELECT FROM pg_database WHERE datname = $1
        );
      `,
        [dbConfig.database],
      );

      if (!result.rows[0].exists) {
        console.log(`Test database "${dbConfig.database}" does not exist, creating it...`);
        await client.query(`CREATE DATABASE "${dbConfig.database}";`);
        console.log(`Test database "${dbConfig.database}" created successfully`);
      } else {
        console.log(`Test database "${dbConfig.database}" already exists`);
      }
    } catch (error) {
      console.error('Error ensuring test database exists:', error);
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
      console.log('Database already initialized');
      return;
    }

    console.log('Starting database initialization...');

    try {
      // First ensure the test database exists
      await this.ensureTestDatabaseExists();

      // Check if we can connect to the database
      try {
        await this.dbConnection.query('SELECT 1');
        console.log(`Connected to database successfully`);
      } catch (error) {
        console.error('Error connecting to database:', error);
        throw error;
      }

      // Drop all existing tables (if any) to ensure a clean slate
      console.log('Dropping all existing tables to ensure a clean schema...');
      try {
        // Use the imported dropAllTables function with confirmationRequired=false
        // so it doesn't prompt for confirmation in test environment
        await dropAllTables(false);
        console.log('All existing tables have been dropped successfully');
      } catch (error) {
        console.warn('Error dropping tables:', error);
        console.log('Continuing with initialization...');
      }

      // Use the production database initialization code directly
      // This ensures the schema is consistent with production
      console.log('[Database] Initializing database schema...');
      await initializeDatabase();

      console.log('Database schema initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Execute a query using the pool
   */
  public async query(text: string, params: any[] = []): Promise<any> {
    return await this.dbConnection.query(text, params);
  }

  /**
   * Get a client from the pool for a transaction
   * Make sure to release the client when done
   */
  public async getClient(): Promise<PoolClient> {
    return await this.dbConnection.getClient();
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return await this.dbConnection.transaction(callback);
  }

  /**
   * Reset the database to a clean state
   * - Truncates all tables
   * - Resets sequences
   */
  public async resetDatabase(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    return await this.transaction(async (client) => {
      // Disable foreign key constraints temporarily
      await client.query('SET CONSTRAINTS ALL DEFERRED');

      // Get all tables
      const tablesResult = await client.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `);

      // Truncate all tables
      if (tablesResult.rows.length > 0) {
        const tables = tablesResult.rows.map((row) => `"${row.tablename}"`).join(', ');
        if (tables) {
          console.log(`Truncating tables: ${tables}`);
          await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
        }
      }

      console.log('Database reset complete');
    });
  }

  /**
   * Clean up the test database state but keep tables intact
   * This is usually what you want between test runs
   */
  public async cleanupTestState(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    return await this.transaction(async (client) => {
      // Disable foreign key constraints temporarily
      await client.query('SET session_replication_role = replica');

      // Truncate all tables that contain test data
      await client.query('TRUNCATE teams CASCADE');
      await client.query('TRUNCATE balances CASCADE');
      await client.query('TRUNCATE trades CASCADE');
      await client.query('TRUNCATE competitions CASCADE');
      await client.query('TRUNCATE prices CASCADE');
      await client.query('TRUNCATE portfolio_snapshots CASCADE');
      await client.query('TRUNCATE portfolio_token_values CASCADE');
      await client.query('TRUNCATE competition_teams CASCADE');

      // Re-enable foreign key constraints
      await client.query('SET session_replication_role = DEFAULT');

      console.log('Test state cleaned up');
    });
  }

  /**
   * Close the database connection
   * This does nothing since we're using the shared connection
   * that should stay alive for the application.
   */
  public async close(): Promise<void> {
    // We don't actually close the connection pool since it's shared
    // with the main application. The app should handle closing it.
    this.initialized = false;
    console.log('Database manager reset (connection maintained for app use)');
  }
}

// Export a singleton instance for easy access
export const dbManager = DbManager.getInstance();

// Export helper functions for backward compatibility
export async function initializeDb(): Promise<void> {
  return dbManager.initialize();
}

export function getPool(): any {
  // This is maintained for API compatibility, but now returns
  // the DatabaseConnection instance instead of a raw Pool
  return DatabaseConnection.getInstance();
}

export async function closeDb(): Promise<void> {
  return dbManager.close();
}

export async function resetDb(): Promise<void> {
  return dbManager.resetDatabase();
}

export async function cleanupTestState(): Promise<void> {
  return dbManager.cleanupTestState();
}
