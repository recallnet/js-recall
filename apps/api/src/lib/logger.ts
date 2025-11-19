import { pino, stdSerializers } from "pino";

import { config } from "../config/index.js";

// Create logger instance with appropriate configuration
const logger = pino({
  level: config.logging.level,
  serializers: { error: stdSerializers.err },

  // In development, use pretty printing for better readability
  ...(config.server.nodeEnv === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        messageFormat: "[{context}] {msg}",
      },
    },
  }),

  // In production, use structured JSON logging
  ...(config.server.nodeEnv === "production" && {
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),

  // Base fields that will be included in all log entries
  base: {
    pid: process.pid,
    hostname: process.env.NODE_ENV === "test" ? "test" : undefined,
  },
});

// Create context-specific loggers for different parts of the application
export const createLogger = (context: string) => {
  return logger.child({ context });
};

// Export the main logger instance
export { logger };

// Create commonly used loggers
export const dbLogger = createLogger("Database");
export const authLogger = createLogger("Auth");
export const apiLogger = createLogger("API");
export const tradeLogger = createLogger("Trade");
export const competitionLogger = createLogger("Competition");
export const competitionRewardsLogger = createLogger("CompetitionRewards");
export const adminLogger = createLogger("Admin");
export const userLogger = createLogger("User");
export const agentLogger = createLogger("Agent");
export const priceLogger = createLogger("Price");
export const balanceLogger = createLogger("Balance");
export const repositoryLogger = createLogger("Repository");
export const middlewareLogger = createLogger("Middleware");
export const serviceLogger = createLogger("Service");
export const configLogger = createLogger("Config");
export const indexingLogger = createLogger("Indexing");
