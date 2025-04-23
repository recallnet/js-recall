#!/usr/bin/env node

/**
 * Script to run end-to-end tests
 *
 * This script handles:
 * 1. Setting up the test environment
 * 2. Running Jest tests
 * 3. Cleaning up afterward
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { config } from 'dotenv';
import fs from 'fs';

// Load test environment variables
config({ path: path.resolve(__dirname, '../.env.test') });

console.log('🚀 Solana Trading Simulator E2E Test Runner');
console.log('===========================================');

// Create a flag file to indicate full suite is running
const fullSuiteFlag = path.resolve(__dirname, '.full-suite-running');
fs.writeFileSync(fullSuiteFlag, '');

// Clear the log file before starting tests
const logFile = path.resolve(__dirname, 'e2e-server.log');
fs.writeFileSync(logFile, '');

// Create a log write stream
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Function to log to both console and file
const log = (message: string) => {
  console.log(message);
  logStream.write(message + '\n');
};

try {
  log('\n📦 Setting up test database...');
  const dbSetupResult = spawnSync('npx', ['ts-node', 'scripts/setup-db.ts'], {
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['inherit', logStream, logStream],
    cwd: path.resolve(__dirname, '..'),
  });

  if (dbSetupResult.status !== 0) {
    throw new Error('Database setup failed');
  }

  // Run Jest tests
  log('\n🧪 Running E2E tests...');
  const jestResult = spawnSync(
    'npx',
    ['jest', '-c', 'e2e/jest.config.js', ...process.argv.slice(2)],
    {
      stdio: ['inherit', logStream, logStream],
      cwd: path.resolve(__dirname, '..'),
    },
  );

  if (jestResult.status !== 0) {
    process.exit(jestResult.status || 1);
  }

  log('\n✅ E2E tests completed successfully');
} catch (error) {
  log('\n❌ E2E test run failed:' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
} finally {
  // Clean up the flag file
  if (fs.existsSync(fullSuiteFlag)) {
    fs.unlinkSync(fullSuiteFlag);
  }
  // Close the log stream
  logStream.end();
}
