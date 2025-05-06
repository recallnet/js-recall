import fs from "fs";
import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(
    (info) =>
      `${info.timestamp} [${info.level}] ${info.message}${info.stack ? `\n${info.stack}` : ""}`,
  ),
);

// Define log format for file output (more detailed)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    (info) =>
      `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}${info.stack ? `\n${info.stack}` : ""}`,
  ),
);

// Create file transport with rotation - main application logs
const fileTransport = new DailyRotateFile({
  filename: path.join(logsDir, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d", // Keep logs for 14 days
  maxSize: "20m", // Rotate when log reaches 20MB
  zippedArchive: true,
  format: fileFormat,
});

// Create a separate transport for errors
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
  maxSize: "20m",
  level: "error",
  zippedArchive: true,
  format: fileFormat,
});

// Create the logger
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transports: [
    // Always write to console regardless of environment
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Write all logs to files
    fileTransport,
    errorFileTransport,
  ],
});

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

// Helper function to format arguments for logging
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Using direct reference to avoid potential recursion
          return `[Object: Stringify Error - ${e instanceof Error ? e.message : String(e)}]`;
        }
      }
      return String(arg);
    })
    .join(" ");
}

// Setup console interceptor
export function interceptConsole(): void {
  // Replace console methods with Winston logger
  console.log = (...args: unknown[]): void => {
    const message = formatArgs(args);
    logger.info(message);

    // Always use original console in production too
    // This ensures logs are visible in the VM console/terminal
    originalConsole.log(...args);
  };

  console.info = (...args: unknown[]): void => {
    const message = formatArgs(args);
    logger.info(message);
    originalConsole.info(...args);
  };

  console.warn = (...args: unknown[]): void => {
    const message = formatArgs(args);
    logger.warn(message);
    originalConsole.warn(...args);
  };

  console.error = (...args: unknown[]): void => {
    const message = formatArgs(args);
    logger.error(message);
    originalConsole.error(...args);
  };

  console.debug = (...args: unknown[]): void => {
    const message = formatArgs(args);
    logger.debug(message);
    originalConsole.debug(...args);
  };
}

// Restore original console behavior (useful for testing)
export function restoreConsole(): void {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}

export default { logger, interceptConsole, restoreConsole };
