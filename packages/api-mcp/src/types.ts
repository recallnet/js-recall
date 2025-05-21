import { ConsoleLogger } from "@recallnet/api-sdk/mcp-server/console-logger.js";

/**
 * Transport type supported by the MCP server
 */
export type TransportType = "stdio" | "sse";

/**
 * Options for starting the MCP server
 */
export interface ServerOptions {
  bearerAuth?: string;
  serverURL?: string;
  serverIdx?: number;
  logger: ConsoleLogger;
}
