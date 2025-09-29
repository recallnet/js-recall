import pino from "pino";

// Create logger instance with appropriate configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

// Create context-specific loggers for different parts of the application
export const createLogger = (context: string) => {
  return logger.child({ context });
};
