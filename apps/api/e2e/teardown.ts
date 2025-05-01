/**
 * Global teardown script for end-to-end tests
 *
 * This file is automatically run by Jest after all tests
 */
import fs from "fs";
import path from "path";

import { DatabaseConnection } from "@/database/connection.js";
import { services } from "@/services/index.js";
import { SchedulerService } from "@/services/scheduler.service.js";

import { dbManager } from "./utils/db-manager.js";
import { killExistingServers } from "./utils/server.js";

// Path to log file
const logFile = path.resolve(__dirname, "e2e-server.log");

// Function to log to both console and file
const log = (message: string) => {
  console.log(message);
  fs.appendFileSync(logFile, message + "\n");
};

// Teardown function to run after all tests
export default async function () {
  log("🔄 Global Teardown - Cleaning up all resources...");

  try {
    // First, stop the scheduler service if running
    if (services.scheduler) {
      log("🛑 Global Teardown - Stopping scheduler service...");
      services.scheduler.stopSnapshotScheduler();
    }

    // Clear all scheduler timers as a safety measure
    log("🕒 Global Teardown - Clearing all scheduler timers...");
    SchedulerService.clearAllTimers();

    // Kill any remaining server processes
    log("🛑 Global Teardown - Killing server processes...");
    await killExistingServers();

    // Close database connection
    try {
      log("🔌 Global Teardown - Closing database connection...");

      // Close using the DbManager
      await dbManager.close();

      // Also close using the app's DatabaseConnection for safety
      const dbConnection = DatabaseConnection.getInstance();
      await dbConnection.close();
    } catch (dbError) {
      log("❌ Global Teardown - Database connection error: " + String(dbError));
    }

    // Add a small delay to allow any pending operations to complete
    log("⏱️ Global Teardown - Waiting for pending operations...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    log("✅ Global Teardown - Test environment cleaned up");

    // For absolute certainty all async operations are done,
    // attempt to close all active timers
    try {
      // NodeJS internals: this is safe but not officially supported
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeHandles = (process as any)._getActiveHandles
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (process as any)._getActiveHandles()
        : [];

      if (activeHandles && activeHandles.length > 0) {
        log(
          `🧹 Global Teardown - Found ${activeHandles.length} active handles, attempting to clear...`,
        );

        // Try to close database handles and sockets
        for (const handle of activeHandles) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (handle && typeof (handle as any).close === "function") {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (handle as any).close();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (err) {
              // Ignore errors during cleanup
            }
          }
        }
      }
    } catch (handleError) {
      // Ignore errors when trying to access internal Node.js APIs
      log(
        "Note: Unable to access Node.js internal handles: " +
          (handleError instanceof Error
            ? handleError.message
            : String(handleError)),
      );
    }
  } catch (error) {
    log(
      "❌ Global Teardown - Failed to clean up test environment: " +
        (error instanceof Error ? error.message : String(error)),
    );

    // As a last resort, try to kill any server processes
    try {
      await killExistingServers();
    } catch (secondError) {
      log(
        "❌ Global Teardown - Failed to kill server processes: " +
          String(secondError),
      );
    }
  }
}
