#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RecallAgentToolkit } from "../src/mcp/index.js";
import { Configuration, Resource } from "../src/shared/configuration.js";

/**
 * Options for the Recall MCP server
 * @param tools - The tools to enable
 * @param privateKey - The private key to use
 * @param network - The Recall network to use: `testnet` or `localnet` (defaults to `testnet`)
 */
type Options = {
  tools?: string[];
  privateKey?: string;
  network?: string;
};

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the project root (depending on build location)
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../../.env"),
];
for (const path of envPaths) {
  if (existsSync(path)) {
    config({ path });
    break;
  }
}

const { RECALL_PRIVATE_KEY, RECALL_NETWORK } = process.env;

// The server will accept flags for a `--private-key` (hex string), `--tools` (comma separated list), and `--network` (e.g., `testnet` or `localnet`)
const ACCEPTED_ARGS = ["private-key", "tools", "network"];

// Note: since we require a private key, we only expose both read and write tools
const ACCEPTED_TOOLS = [
  "account.read",
  "account.write",
  "bucket.read",
  "bucket.write",
  // "documentation.read", // TODO: add documentation search resource
];

/**
 * Parse the command line arguments
 * @param args - The command line arguments—one or more of:
 *  `--tools=all` (or `--tools=resource.action`, like `--tools=account.read`),
 *  `--private-key=$KEY`, or `--network=$NETWORK`
 * @returns The parsed options
 */
export function parseArgs(args: string[]): Options {
  const options: Options = {};

  args.forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");

      if (key == "tools") {
        options.tools = value?.split(",");
      } else if (key == "private-key") {
        options.privateKey = value;
      } else if (key == "network") {
        options.network = value;
      } else {
        throw new Error(
          `Invalid argument: ${key}. Accepted arguments are: ${ACCEPTED_ARGS.join(
            ", ",
          )}`,
        );
      }
    }
  });

  // Check if the tools argument is present, else, use all tools
  if (!options.tools) {
    options.tools = ACCEPTED_TOOLS;
  }

  // Validate tools against accepted enum values
  options.tools.forEach((tool: string) => {
    if (tool == "all") {
      return;
    }
    if (!ACCEPTED_TOOLS.includes(tool.trim())) {
      throw new Error(
        `Invalid tool: ${tool}. Accepted tools are: ${ACCEPTED_TOOLS.join(
          ", ",
        )}`,
      );
    }
  });

  // Check if API key is either provided in args or set in environment variables
  const privateKey = options.privateKey || RECALL_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "Recall private key not provided. Please either pass it as an argument --private-key=$KEY or set the RECALL_PRIVATE_KEY environment variable.",
    );
  }
  options.privateKey = privateKey;

  // If not set, the `RecallAgentToolkit` will default to `testnet`
  const network = options.network || RECALL_NETWORK;
  options.network = network;

  return options;
}

function handleError(error: any) {
  console.error("\n🚨  Error initializing Recall MCP server:\n");
  console.error(`   ${error.message}\n`);
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));

  // Create the `RecallAgentToolkit` instance
  const selectedTools = options.tools!;
  const configuration: Configuration = { actions: {}, context: {} };

  if (selectedTools.includes("all")) {
    ACCEPTED_TOOLS.forEach((tool) => {
      const [resource, action] = tool.split(".");
      if (!resource || !action) {
        throw new Error(
          `Invalid tool: ${tool}. Tool must be in the format of "resource.action".`,
        );
      }
      configuration.actions[resource as Resource] = {
        ...configuration.actions[resource as Resource],
        [action]: true,
      };
    });
  } else {
    selectedTools.forEach((tool) => {
      const [resource, action] = tool.split(".");
      if (!resource || !action) {
        throw new Error(
          `Invalid tool: ${tool}. Tool must be in the format of "resource.action".`,
        );
      }
      if (!configuration.actions) {
        configuration.actions = {};
      }
      configuration.actions[resource as Resource] = {
        ...configuration.actions[resource as Resource],
        [action]: true,
      };
    });
  }

  // Append custom Recall network to configuration if provided
  if (options.network) {
    configuration.context = { network: options.network };
  }

  const server = new RecallAgentToolkit({
    privateKey: options.privateKey!,
    configuration: configuration,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // We use console.error instead of console.log since console.log will output to stdio, which will confuse the MCP server
  console.error("✅ Recall MCP Server running on stdio");
}

main().catch((error) => {
  handleError(error);
});
