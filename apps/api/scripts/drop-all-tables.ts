import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection } from '../src/database/connection';
import { config } from '../src/config';

/**
 * Script to completely drop all tables from the database
 * This should be used with caution, as it will permanently delete all data
 *
 * @param confirmationRequired If true, will prompt for confirmation. If false, executes without prompt (for testing).
 * @returns Promise that resolves when all tables are dropped
 */
export async function dropAllTables(confirmationRequired: boolean = true): Promise<void> {
  try {
    if (confirmationRequired) {
      console.log(
        '\x1b[31m%s\x1b[0m',
        '⚠️  WARNING: This will DELETE ALL TABLES from your database!',
      );
      console.log(
        '\x1b[31m%s\x1b[0m',
        `Database: ${config.database.host}:${config.database.port}/${config.database.database}`,
      );
      console.log('\x1b[31m%s\x1b[0m', 'ALL DATA WILL BE PERMANENTLY LOST!');

      // Wait for confirmation
      await new Promise<void>((resolve) => {
        console.log("Type 'DROP ALL TABLES' to confirm:");
        process.stdin.once('data', (data) => {
          const input = data.toString().trim();
          if (input === 'DROP ALL TABLES') {
            resolve();
          } else {
            console.log('Operation cancelled.');
            process.exit(0);
          }
        });
      });
    }

    console.log('Connecting to database...');
    const db = DatabaseConnection.getInstance();

    // Read SQL file
    const sqlFile = path.join(__dirname, '../src/database/drop-all-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Dropping all tables...');
    await db.query(sql);

    console.log('\x1b[32m%s\x1b[0m', '✅ All tables have been successfully dropped!');
    console.log("You can now run 'npm run db:init' to re-initialize the database schema.");

    if (confirmationRequired) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error dropping tables:', error);
    if (confirmationRequired) {
      process.exit(1);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  dropAllTables().catch(console.error);
}
