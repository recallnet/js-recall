/**
 * Environment configuration for Recall API MCP
 */

// Define types for configuration variables
export interface Config {
  API_SERVER_URL?: string;
  API_KEY?: string;
  LOG_LEVEL: string;
}

// Export configuration object with environment variables and defaults
export const config: Config = {
  API_SERVER_URL: process.env.API_SERVER_URL,
  API_KEY: process.env.API_KEY,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

/**
 * Validate required environment variables
 * @returns {string[]} Array of missing required variables
 */
export function validateEnv(): string[] {
  const requiredVars: (keyof Config)[] = ["API_KEY", "API_SERVER_URL"];
  return requiredVars.filter((v) => !process.env[v]);
}
