import minimist from "minimist";
import { z } from "zod";

import {
  Configuration,
  Permission,
  Resource,
} from "@recallnet/agent-toolkit/shared";

/**
 * List of tools that are accepted by the MCP server in the format `resource.action` (e.g.
 * `account.read`, `bucket.write`)
 */
// Note: in the future, we can make the private key optional to enable read-only MCP servers
// and expose only the read tools
export const ACCEPTED_TOOLS = [
  "account.read",
  "account.write",
  "bucket.read",
  "bucket.write",
] as const;

/**
 * List of networks that are accepted by the MCP server
 */
export const NETWORKS = ["testnet", "localnet"] as const;

/**
 * Schema for configuration for CLI arguments and environment variables
 */
export const ConfigSchema = z.object({
  tools: z
    .array(z.string())
    .default(["all"])
    .refine(
      (tools): tools is Array<(typeof ACCEPTED_TOOLS)[number] | "all"> =>
        tools.every(
          (tool) =>
            tool === "all" ||
            ACCEPTED_TOOLS.includes(tool as (typeof ACCEPTED_TOOLS)[number]),
        ),
      (tools) => ({
        message: `Invalid tool(s). Each tool must be one of: ${ACCEPTED_TOOLS.join(", ")} or "all". Tools provided: ${tools.join(", ")}`,
      }),
    )
    .describe("List of tools to enable"),
  privateKey: z
    .string({
      required_error:
        "Private key is required. Set RECALL_PRIVATE_KEY env var or pass --private-key",
      invalid_type_error: "Private key must be a string",
    })
    .min(1, "Private key cannot be empty")
    .transform((val) => (!val.startsWith("0x") ? `0x${val}` : val))
    .pipe(
      z.string().regex(/^0x[a-fA-F0-9]{64}$/, {
        message:
          "Private key must be a valid 32-byte hex string (with or without '0x' prefix)",
      }),
    ),
  network: z
    .enum(NETWORKS, {
      errorMap: () => ({
        message: `Network must be one of: ${NETWORKS.join(", ")}`,
      }),
    })
    .optional()
    .default("testnet")
    .describe(`Recall network to use (${NETWORKS.join(", ")})`),
});

/**
 * Validated configuration object from CLI arguments and environment variables
 */
export type ValidatedConfig = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate both CLI arguments and environment variables
 * @returns Validated configuration object
 */
export function parseAndValidateConfig(): ValidatedConfig {
  const argv = minimist(process.argv.slice(2), {
    string: ["private-key", "network", "tools"],
    alias: {
      "private-key": "privateKey",
    },
  });

  const rawConfig = {
    privateKey: argv.privateKey || process.env.RECALL_PRIVATE_KEY,
    network: argv.network || process.env.RECALL_NETWORK,
    tools: argv.tools?.split(",") || process.env.RECALL_TOOLS?.split(","),
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(`Configuration validation failed:\n${issues}`);
    }
    throw error;
  }
}

/**
 * Build MCP configuration from validated config
 * @param config - Validated configuration object
 * @returns MCP configuration object
 */
export function buildMcpConfiguration(config: ValidatedConfig): Configuration {
  const configuration: Configuration = { actions: {}, context: {} };

  if (config.tools.includes("all")) {
    ACCEPTED_TOOLS.forEach((tool) => {
      const [resource, action] = tool.split(".");
      if (!configuration.actions) {
        configuration.actions = {};
      }
      configuration.actions[resource as Resource] = {
        ...configuration.actions[resource as Resource],
        [action as Permission]: true,
      };
    });
  } else {
    config.tools.forEach((tool) => {
      const [resource, action] = tool.split(".");
      if (!configuration.actions) {
        configuration.actions = {};
      }
      configuration.actions[resource as Resource] = {
        ...configuration.actions[resource as Resource],
        [action as Permission]: true,
      };
    });
  }

  if (config.network) {
    configuration.context = { network: config.network };
  }

  return configuration;
}
