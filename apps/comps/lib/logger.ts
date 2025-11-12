import { pino, stdSerializers } from "pino";
import pretty from "pino-pretty";

const pinoOptions = {
  level: process.env.LOG_LEVEL || "info",
  serializers: { error: stdSerializers.err },
};
const logger =
  process.env.NODE_ENV === "development"
    ? pino(pinoOptions, pretty({ colorize: true, ignore: "pid,hostname" }))
    : pino(pinoOptions);

// Create context-specific loggers for different parts of the application
export const createLogger = (context: string) => {
  return logger.child({ context });
};
