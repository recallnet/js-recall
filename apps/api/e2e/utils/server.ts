import axios from "axios";
import { ChildProcess, spawn } from "child_process";
import kill from "tree-kill";

// Reference to the server process
let serverProcess: ChildProcess | null = null;

// Server configuration
const PORT = process.env.TEST_PORT || "3001";
// Allow configuring the host from environment (0.0.0.0 for Docker)
const HOST = process.env.TEST_HOST || "localhost";
// Include API prefix in base URL if set
const API_PREFIX = process.env.API_PREFIX;
const BASE_URL = `http://${HOST}:${PORT}${API_PREFIX ? `/${API_PREFIX}` : ""}`;

/**
 * Start the server for testing
 *
 * @returns A promise that resolves to the HTTP server instance
 */
export async function startServer(): Promise<void> {
  if (serverProcess) {
    throw new Error("Cannot start test server twice");
  }

  const testHost = process.env.TEST_HOST || "0.0.0.0"; // Bind to all interfaces in Docker

  console.log(`Starting test server on ${testHost}:${PORT}...`);

  // Start the server script in a sub-process
  serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: PORT,
      HOST: testHost,
      METRICS_PORT: process.env.METRICS_PORT || "3003",
      METRICS_HOST: "127.0.0.1", // Secure binding for tests
      TEST_MODE: "true",
      LOG_LEVEL: "debug",
    },
    stdio: "inherit",
    shell: true,
  });

  try {
    // Wait for the server to be ready
    await waitForServerReady(30, 500); // 30 retries, 500ms interval = 15 seconds max
  } catch (error) {
    console.error("Cannot start server:", error);
    stopServer();
  }
}

export function stopServer() {
  // Kill the server process if it exists
  if (serverProcess && serverProcess.pid) {
    try {
      console.log(`Killing server process with PID: ${serverProcess.pid}`);
      // Negative PID to kill process group, i.e all child processes
      kill(serverProcess.pid);
      serverProcess = null;
    } catch (error: unknown) {
      // If there is not a process with the expected PID we don't have to do
      // anything since it's already been killed. This allows calling this
      // function repeatedly.
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ESRCH"
        )
      ) {
        // If there is some other error, we can log it and throw.
        console.error("Error killing server process:", error);
        throw error;
      }
    }
  }
}

/**
 * Wait for the server to be ready by polling the health endpoint
 */
async function waitForServerReady(
  maxRetries = 30,
  interval = 500,
): Promise<void> {
  console.log(`⏳ Waiting for server to be ready at ${BASE_URL}/health...`);

  let retries = 0;
  while (retries < maxRetries) {
    try {
      // Try to reach the health endpoint
      const response = await axios.get(`${BASE_URL}/health`);
      if (response.status === 200) {
        console.log("✅ Server is ready");

        // Verify admin setup endpoint is available
        const adminSetupResponse = await axios.get(`${BASE_URL}/api/health`);
        console.log(
          `Admin API health check: ${adminSetupResponse.status === 200 ? "OK" : "Failed"}`,
        );

        // Verify metrics server is available (always on localhost for security)
        const metricsPort = process.env.METRICS_PORT || "3003";
        const metricsUrl = `http://127.0.0.1:${metricsPort}`;
        const metricsHealthResponse = await axios.get(`${metricsUrl}/health`);
        console.log(
          `Metrics server health check: ${metricsHealthResponse.status === 200 ? "OK" : "Failed"}`,
        );

        return;
      }
    } catch (error) {
      // @ts-expect-error - error is unknown type from catch block
      if (error?.code !== "ECONNREFUSED") {
        console.log("Test Server start failure:");
        throw error;
      }
      // Server not ready yet, retry after interval
      retries++;
      if (retries % 5 === 0) {
        console.log(`Still waiting for server... (${retries}/${maxRetries})`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Server failed to start after ${maxRetries} retries`);
}

/**
 * Get the base URL for the test server
 */
export function getBaseUrl(): string {
  return BASE_URL;
}
