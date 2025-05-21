import minimist from "minimist";

import { createConsoleLogger } from "@recallnet/api-sdk/mcp-server/console-logger.js";

import { config, validateEnv } from "./env.js";
import { startServer } from "./server.js";

/**
 * Parse command line arguments and run the server
 */
export async function run(): Promise<void> {
  // Validate environment
  const missingVars = validateEnv();
  if (missingVars.length > 0) {
    console.error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
    process.exit(1);
  }

  const argv = minimist(process.argv.slice(2), {
    string: ["server-url", "log-level", "bearer-auth"],
    default: {
      "log-level": config.LOG_LEVEL,
    },
    alias: {
      u: "server-url",
      l: "log-level",
      t: "bearer-auth",
    },
  });

  const logger = createConsoleLogger(argv["log-level"]);

  // Command line arguments take precedence over environment variables
  const options = {
    bearerAuth: argv["bearer-auth"] || config.API_KEY,
    serverURL: argv["server-url"] || config.API_SERVER_URL,
    logger,
  };

  try {
    await startServer(options);
    logger.info("API MCP server started");
  } catch (error) {
    logger.error("Failed to start server:", { error: String(error) });
    process.exit(1);
  }
}
