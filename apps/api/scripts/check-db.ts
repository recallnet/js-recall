import { DatabaseConnection } from '../src/database/connection';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Ensure environment is loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Colors for console output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[36m',
  reset: '\x1b[0m',
};

/**
 * Checks database connection and schema status
 * Does not attempt to create or modify any tables
 */
const checkDatabase = async () => {
  console.log(`${colors.blue}Checking database connection and schema status...${colors.reset}`);

  const db = DatabaseConnection.getInstance();

  try {
    // Test database connection
    console.log('Testing connection to database...');
    await db.query('SELECT NOW()');
    console.log(`${colors.green}✓ Database connection successful${colors.reset}`);

    // Check if essential tables exist
    console.log('\nChecking for required tables:');

    const requiredTables = [
      'teams',
      'balances',
      'trades',
      'competitions',
      'competition_participants',
      'prices',
    ];

    const tableResults = await Promise.all(
      requiredTables.map(async (table) => {
        const result = await db.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `,
          [table],
        );

        return {
          name: table,
          exists: result.rows[0]?.exists,
        };
      }),
    );

    // Display table status
    let missingTables = 0;
    tableResults.forEach((table) => {
      if (table.exists) {
        console.log(`${colors.green}✓ Table ${table.name} exists${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Table ${table.name} is missing${colors.reset}`);
        missingTables++;
      }
    });

    // Summary
    console.log('\nDatabase Status Summary:');

    if (missingTables === 0) {
      console.log(`${colors.green}✓ All required tables are present${colors.reset}`);
      console.log(`${colors.green}✓ Database schema appears to be complete${colors.reset}`);
    } else if (missingTables === requiredTables.length) {
      console.log(
        `${colors.red}✗ No required tables found - database schema is not initialized${colors.reset}`,
      );
      console.log(
        `${colors.yellow}Run 'npm run db:init' to initialize the database schema${colors.reset}`,
      );
    } else {
      console.log(
        `${colors.yellow}⚠ Some tables are missing - database schema is incomplete${colors.reset}`,
      );
      console.log(
        `${colors.yellow}Run 'npm run db:reset' to reset and fully initialize the database${colors.reset}`,
      );
    }

    // Close connection
    await db.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error(`${colors.red}Error connecting to database:${colors.reset}`, error);
    console.log('\nPossible solutions:');
    console.log('1. Check that PostgreSQL server is running');
    console.log('2. Verify database connection details in .env file');
    console.log('3. Ensure the database exists (run npm run db:clean to create it)');
    process.exit(1);
  }
};

// Run the script if called directly
if (require.main === module) {
  checkDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database check failed:', err);
      process.exit(1);
    });
}

export { checkDatabase };
