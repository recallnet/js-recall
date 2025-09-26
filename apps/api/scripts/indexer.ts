import { indexingLogger } from "@/lib/logger.js";
import ServiceRegistry from "@/services/index.js";

const services = new ServiceRegistry();

// Start blockchain indexing, if enabled
const indexingService = services.indexingService;

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

  await indexingService.close();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart

function main() {
  indexingService.start();
}

main();
