import { DatabaseConnection } from '../src/database/connection';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Split the SQL initialization file into sections by comments
 * @param sql The full SQL string
 */
function splitSqlIntoSections(sql: string): string[] {
  // Split into major sections: tables, indexes, functions

  // Find the function definition part
  const functionsStartIndex = sql.indexOf('-- Function to update updated_at timestamp');
  const tablesPart = functionsStartIndex !== -1 ? sql.substring(0, functionsStartIndex) : sql;
  const functionsPart = functionsStartIndex !== -1 ? sql.substring(functionsStartIndex) : '';

  // Split tables by CREATE TABLE
  const tables = tablesPart.split(/-- [A-Za-z]+ table/);

  const result: string[] = [];

  // Add each table section
  for (let i = 1; i < tables.length; i++) {
    const tableSection = tables[i].trim();
    if (tableSection) {
      result.push(`-- Table section ${i}\n${tableSection}`);
    }
  }

  // Add the functions and triggers section last
  if (functionsPart) {
    result.push(functionsPart);
  }

  return result;
}

/**
 * Initialize the database
 * Creates tables and indices if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  // Get the database connection
  const db = DatabaseConnection.getInstance();

  try {
    console.log('[Database] Checking database connection and schema...');

    // Now check if the database schema is already initialized
    const tableCheckResult = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'teams'
      );
    `);

    const tablesExist = tableCheckResult.rows[0]?.exists;

    if (tablesExist) {
      console.log('[Database] Database schema already initialized, skipping initialization');
      return;
    }

    console.log('[Database] Tables not found, initializing database schema...');

    // Read SQL file
    const sqlFile = path.join(__dirname, '../src/database/init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split the SQL into sections for easier error isolation
    const sqlSections = splitSqlIntoSections(sql);

    // Execute each section separately to better isolate errors
    for (let i = 0; i < sqlSections.length; i++) {
      try {
        console.log(`[Database] Executing SQL section ${i + 1} of ${sqlSections.length}...`);
        await db.query(sqlSections[i]);
      } catch (error) {
        console.error(`[Database] Error executing SQL section ${i + 1}:`, error);
        console.error('SQL section content:', sqlSections[i].substring(0, 200) + '...');
        throw error;
      }
    }

    console.log('[Database] Database schema initialized successfully');
  } catch (error) {
    // If there's a database connection error, we should log but not fail server startup
    console.error('[Database] Error during database schema check/initialization:', error);
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[Database] Continuing server startup despite database error in production mode',
      );
    } else {
      throw error; // In development, we want to fail fast
    }
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}
