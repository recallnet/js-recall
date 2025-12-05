/**
 * Global Setup for E2E Tests
 *
 * Initializes the test environment for the comps app e2e tests.
 */
import { ChildProcess, spawn } from "child_process";
import { config } from "dotenv";
import fs from "fs";
import path from "path";

import { createLogger } from "@/lib/logger.js";

// Path to log file
const logFile = path.resolve(__dirname, "e2e-server.log");

// Create a test-specific logger
const testLogger = createLogger("E2E-Setup");

// Next.js dev server process
let nextServer: ChildProcess | null = null;

// Function to log to both Pino logger and file
const log = (message: string) => {
  testLogger.info(message);
  fs.appendFileSync(logFile, message + "\n");
};

// Helper to wait for server to be ready
async function waitForServer(url: string, timeout = 20000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        log(`✅ Server is ready at ${url}`);
        return;
      }
    } catch {
      // Server not ready yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not start within ${timeout}ms`);
}

async function startServer() {
  // Start Next.js dev server
  log("🌐 Starting Next.js dev server on port 3001...");
  const serverLogFile = path.resolve(__dirname, "next-server.log");
  const serverLog = fs.createWriteStream(serverLogFile, { flags: "w" });

  testLogger.debug({ env: process.env }, "env");
  nextServer = spawn("pnpm", ["start"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: process.env.TEST_PORT,
    },
  });

  // Pipe server output to log file
  nextServer.stdout?.pipe(serverLog);
  nextServer.stderr?.pipe(serverLog);

  nextServer.on("error", (error) => {
    log(`❌ Failed to start Next.js server: ${error.message}`);
  });

  nextServer.on("exit", (code) => {
    log(`Next.js server exited with code ${code}`);
  });

  // Wait for server to be ready
  log("⏳ Waiting for Next.js server to be ready...");
  await waitForServer("http://localhost:3001", 60000);
}

function loadEnvironment(file: string) {
  if (!fs.existsSync(file)) {
    testLogger.info(`ℹ️ ${file} does not exist`);
    return;
  }

  const result = config({
    path: file,
    override: true,
  });

  if (!result.parsed) {
    throw Error(`failed to parse file ${file}`);
    return;
  }

  testLogger.info(
    `✅ Loaded ${Object.keys(result.parsed).length} variables from ${file}`,
  );
}

function setupEnvironment() {
  // Load test environment variables
  loadEnvironment(path.resolve(__dirname, "../.env.local"));
  loadEnvironment(path.resolve(__dirname, "../.env.test"));
  loadEnvironment(path.resolve(__dirname, "../.env.test.local"));

  // Ensure TEST_MODE is set
  process.env.TEST_MODE = "true";
  process.env.TEST_HOST = process.env.TEST_HOST || "localhost";
  process.env.TEST_PORT = process.env.TEST_PORT || "3001";
  process.env.TEST_API_BASE_URL = `http://${process.env.TEST_HOST}:${process.env.TEST_PORT}/api/trading`;
}

// Setup function to run before all tests
export async function setup() {
  try {
    log("🚀 Setting up E2E test environment...");
    setupEnvironment();

    if (!process.env.USE_EXTERNAL_SERVER) {
      await startServer();
    } else {
      log("⏭️ Using an external server");
    }
    log("✅ Test environment ready");
  } catch (error) {
    log(
      "❌ Failed to set up test environment: " +
        (error instanceof Error ? error.message : String(error)),
    );
    // Clean up if setup fails
    if (nextServer) {
      nextServer.kill();
    }
    throw error;
  }
}

async function stopServer() {
  // Stop Next.js server
  if (nextServer) {
    log("🛑 Stopping Next.js dev server...");
    nextServer.kill("SIGTERM");

    // Give it a moment to shut down gracefully
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Force kill if still running
    if (nextServer.exitCode === null) {
      log("⚠️ Forcing Next.js server shutdown...");
      nextServer.kill("SIGKILL");
    }

    nextServer = null;
  }
}

// Teardown function to run after all tests
export async function teardown() {
  log("🧹 Cleaning up test environment...");

  try {
    await stopServer();

    log("✅ Test environment cleaned up");
  } catch (error) {
    log(
      "❌ Failed to clean up test environment: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
