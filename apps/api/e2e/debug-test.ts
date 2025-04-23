#!/usr/bin/env node

/**
 * Debug script to run a single E2E test file
 *
 * This script handles:
 * 1. Setting up the test environment
 * 2. Running a single test
 * 3. Cleaning up afterward
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { config } from 'dotenv';
import { killExistingServers } from './utils/server';
import fs from 'fs';

// Load test environment variables
config({ path: path.resolve(__dirname, '../.env.test') });

console.log('🚀 E2E Test Debugger');
console.log('===================');

// Get the test file to run from command line arguments
const testFile = process.argv[2] || 'tests/admin.test.ts';

// Path to the log file
const logFile = path.resolve(__dirname, 'e2e-server.log');
// Check if we are running as part of the full test suite
const fullSuiteFlag = path.resolve(__dirname, '.full-suite-running');
const isPartOfFullSuite = fs.existsSync(fullSuiteFlag);

// If not part of full suite, clear the log file
if (!isPartOfFullSuite) {
  fs.writeFileSync(logFile, '');
}

// Create a log write stream
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Function to log to both console and file
const log = (message: string) => {
  console.log(message);
  logStream.write(message + '\n');
};

async function runTest() {
  try {
    // Kill any existing server processes first
    log('\n🔍 Checking for existing server processes...');
    await killExistingServers();

    // Ensure test database exists and is set up
    log('\n📦 Setting up test database...');
    const dbSetupResult = spawnSync('npx', ['ts-node', 'e2e/utils/setup-db.ts'], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['inherit', logStream, logStream],
      cwd: path.resolve(__dirname, '..'),
    });

    if (dbSetupResult.status !== 0) {
      throw new Error('Database setup failed');
    }

    // Set up admin account
    log('\n👤 Setting up admin account...');
    const adminSetupResult = spawnSync('npx', ['ts-node', 'e2e/utils/setup-admin.ts'], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['inherit', logStream, logStream],
      cwd: path.resolve(__dirname, '..'),
    });

    if (adminSetupResult.status !== 0) {
      throw new Error('Admin setup failed');
    }

    // Run Jest test for a specific file
    log(`\n🧪 Running test file: ${testFile}...`);
    const jestResult = spawnSync(
      'npx',
      [
        'jest',
        '-c',
        'e2e/jest.config.js',
        `e2e/${testFile}`,
        '--verbose',
        '--detectOpenHandles',
        '--forceExit',
      ],
      {
        stdio: ['inherit', logStream, logStream],
        cwd: path.resolve(__dirname, '..'),
      },
    );

    // Clean up server processes after running tests
    log('\n🧹 Cleaning up server processes...');
    await killExistingServers();

    if (jestResult.status !== 0) {
      process.exit(jestResult.status || 1);
    }

    log('\n✅ Test completed successfully');
  } catch (error) {
    log('\n❌ Test run failed:' + (error instanceof Error ? error.message : String(error)));

    // Try to clean up server processes even if the test failed
    try {
      await killExistingServers();
    } catch (cleanupError) {
      log('Failed to clean up server processes:' + String(cleanupError));
    }

    process.exit(1);
  } finally {
    // Close the log stream
    logStream.end();
  }
}

// Run the test and handle any errors
runTest().catch((error) => {
  console.error('Unhandled error in test runner:', error);
  logStream.write('Unhandled error in test runner: ' + String(error) + '\n');
  logStream.end();
  process.exit(1);
});
