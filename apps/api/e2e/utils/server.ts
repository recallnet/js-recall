import axios from "axios";
import { ChildProcess, spawn } from "child_process";
import { Server } from "http";

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
export async function startServer(): Promise<Server> {
  // First try to kill any existing servers on the test port
  await killExistingServers();

  return new Promise((resolve, reject) => {
    try {
      const testPort = process.env.TEST_PORT || "3001";
      const testHost = process.env.TEST_HOST || "0.0.0.0"; // Bind to all interfaces in Docker

      console.log(`Starting test server on ${testHost}:${testPort}...`);

      // Start the server script in a separate process
      // Use the index.ts file which is the main entry point
      serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: testPort,
          HOST: testHost,
          METRICS_PORT: process.env.METRICS_PORT || "3003",
          METRICS_HOST: "127.0.0.1", // Secure binding for tests
          TEST_MODE: "true",
        },
        stdio: "inherit",
        detached: true,
      });

      // Create a mock server object that we can use to track and shut down the server
      const mockServer = {
        close: (callback: () => void) => {
          try {
            // Kill the server process
            if (serverProcess && serverProcess.pid) {
              process.kill(-serverProcess.pid);
            }
            callback();
          } catch (error) {
            console.error("Error shutting down server:", error);
            callback();
          }
        },
      } as unknown as Server;

      // Handle server process errors
      serverProcess.on("error", (error) => {
        console.error("Server process error:", error);
        reject(error);
      });

      // Wait for the server to be ready
      waitForServerReady(30, 500) // 30 retries, 500ms interval = 15 seconds max
        .then(() => {
          console.log(`Server started and ready on ${testHost}:${testPort}`);
          resolve(mockServer);
        })
        .catch((error) => {
          console.error("Server failed to start:", error);
          // Try to kill the process if it's hanging
          if (serverProcess && serverProcess.pid) {
            try {
              process.kill(-serverProcess.pid);
            } catch (err) {
              console.error(
                "Error killing server process during startup failure:",
                err,
              );
            }
          }
          reject(error);
        });
    } catch (error) {
      console.error("Failed to start server:", error);
      reject(error);
    }
  });
}

/**
 * Stop the server
 *
 * @param server The HTTP server instance to stop
 */
export async function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    try {
      console.log("Stopping server...");

      // Kill the server process if it exists
      if (serverProcess && serverProcess.pid) {
        try {
          console.log(`Killing server process with PID: ${serverProcess.pid}`);
          // Use negative PID to kill the entire process group since we used detached: true
          process.kill(-serverProcess.pid, "SIGTERM");
          serverProcess = null;
        } catch (error) {
          console.error("Error killing server process:", error);
        }
      }

      // Close the server
      server.close(() => {
        console.log("Server stopped");
        resolve();
      });
    } catch (error) {
      console.error("Error in stopServer:", error);
      resolve(); // Resolve anyway to avoid hanging promises
    }
  });
}

/**
 * Kill any existing server processes running on the test ports
 * This includes both the main API server and the metrics server
 */
export async function killExistingServers(): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const testPort = process.env.TEST_PORT || "3001";
      const metricsPort = process.env.METRICS_PORT || "3003";
      console.log(
        `Checking for existing servers on ports ${testPort} and ${metricsPort}...`,
      );

      // Platform-specific command to find and kill processes using both ports
      let command: string;
      let args: string[];

      if (process.platform === "win32") {
        // Windows - kill processes on both ports
        command = "cmd.exe";
        args = [
          "/c",
          `(for /f "tokens=5" %a in ('netstat -ano ^| findstr :${testPort}') do taskkill /F /PID %a) & (for /f "tokens=5" %a in ('netstat -ano ^| findstr :${metricsPort}') do taskkill /F /PID %a)`,
        ];
      } else {
        // Unix-like (macOS, Linux) - kill processes on both ports
        command = "bash";
        args = [
          "-c",
          `(lsof -i:${testPort} -t | xargs -r kill -9) && (lsof -i:${metricsPort} -t | xargs -r kill -9)`,
        ];
      }

      const killProcess = spawn(command, args, { stdio: "pipe" });

      killProcess.on("close", (code) => {
        if (code !== 0) {
          console.log(
            "No existing server processes found or unable to kill them.",
          );
        } else {
          console.log("Successfully killed existing server processes.");
        }
        resolve();
      });
    } catch (error) {
      console.error("Error killing existing servers:", error);
      resolve(); // Resolve anyway to avoid hanging
    }
  });
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

        // Additional verification of API endpoints and metrics server
        try {
          // Wait a bit more to ensure all routes are registered
          await new Promise((resolve) => setTimeout(resolve, 1000));

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
        } catch (err) {
          console.warn(
            "Additional API/metrics verification failed, but continuing:",
            err,
          );
        }

        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
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
