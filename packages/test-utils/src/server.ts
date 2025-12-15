import axios from "axios";
import { ChildProcess, spawn } from "child_process";
import kill from "tree-kill";

// Reference to the server process
let serverProcess: ChildProcess | null = null;

// Server configuration
const PORT = process.env.TEST_PORT || "3001";
// Allow configuring the host from environment (0.0.0.0 for Docker)
const HOST = process.env.TEST_HOST || "localhost";

/**
 * Get the base URL for the test server.
 * Constructs URL at runtime to pick up API_PREFIX after env vars are loaded.
 */
function getBaseUrlInternal(): string {
  const apiPrefix = process.env.API_PREFIX;
  return `http://${HOST}:${PORT}${apiPrefix ? `/${apiPrefix}/api` : "/api"}`;
}

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

  // Find the workspace root and API directory
  const currentDir = process.cwd();
  const workspaceRoot = currentDir.includes("/apps/")
    ? currentDir.split("/apps/")[0]
    : currentDir;
  const apiDir = `${workspaceRoot}/apps/api`;

  console.log(
    `Starting API server from: ${apiDir}/src/index.ts (cwd: ${apiDir})`,
  );

  // Start the server script in a sub-process
  // IMPORTANT: Must run from apps/api directory so path aliases (@/) resolve correctly
  serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: PORT,
      HOST: testHost,
      METRICS_PORT: process.env.METRICS_PORT || "3003",
      METRICS_HOST: "127.0.0.1", // Secure binding for tests
      TEST_MODE: "true",
      LOG_LEVEL: "debug",
      // Privy test configuration
      PRIVY_APP_ID: process.env.PRIVY_APP_ID || "test-app-id",
      PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET || "test-app-secret",
      PRIVY_JWKS_PUBLIC_KEY:
        process.env.PRIVY_JWKS_PUBLIC_KEY ||
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2aUdZ7S6KPCBlrB+vNXjmIqbvww7pmx5Ozk81+rAB0vqe3A1WC2I5zUnU8EPqO2+RMsPjhUyqtzdJI9J7Sz3YA==",
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
  const baseUrl = getBaseUrlInternal();
  const healthUrl = `${baseUrl}/health`;
  console.log(`⏳ Waiting for server to be ready at ${healthUrl}...`);

  let retries = 0;
  while (retries < maxRetries) {
    try {
      // Try to reach the health endpoint
      const response = await axios.get(healthUrl);
      if (response.status === 200) {
        console.log("✅ Server is ready");

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
 * Get the base URL for the test server.
 * Constructs URL at runtime to pick up API_PREFIX after env vars are loaded.
 */
export function getBaseUrl(): string {
  return getBaseUrlInternal();
}
