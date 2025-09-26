import pino from "pino";

// Create logger instance with appropriate configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  // In development, use pretty printing for better readability
  ...(process.env.NODE_ENV === "development" && {
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
  ...(process.env.NODE_ENV === "production" && {
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
