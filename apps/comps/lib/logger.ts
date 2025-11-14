import { pino, stdSerializers } from "pino";

// Create logger instance with appropriate configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  serializers: { error: stdSerializers.err },
});

// Create context-specific loggers for different parts of the application
export const createLogger = (context: string) => {
  return logger.child({ context });
};
