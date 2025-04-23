import { initializeDatabase } from '../src/database';

/**
 * Database Setup Script
 * Initializes the PostgreSQL database for the trading simulator
 */
const setupDatabase = async () => {
  try {
    console.log('Starting database initialization...');

    // Initialize base database schema
    await initializeDatabase();

    console.log('\nDatabase initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

// Run the setup
setupDatabase();
