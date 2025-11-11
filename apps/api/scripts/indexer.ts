import { indexingLogger } from "@/lib/logger.js";
import ServiceRegistry from "@/services/index.js";

const services = new ServiceRegistry();

// Start blockchain indexing, if enabled
const eventIndexingService = services.eventIndexingService;
const transationIndexingService = services.transactionIndexingService;

let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) {
    indexingLogger.info(`\n[${signal}] Already shutting down, ignoring...`);
    return;
  }
  shuttingDown = true;

  indexingLogger.info(
    `\n[${signal}] Received shutdown signal, closing servers gracefully...`,
  );

  await eventIndexingService?.close();
  await transationIndexingService?.close();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart

function main() {
  eventIndexingService?.start();
  transationIndexingService?.start();
}

main();
