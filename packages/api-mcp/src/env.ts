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
  // Currently no required variables, only optional ones
  // This could be expanded if required variables are added later
  const requiredVars: (keyof Config)[] = [];
  return requiredVars.filter((v) => !process.env[v]);
}
