import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import schema from "@recallnet/db/schema";

const { Pool } = pg;

/**
 * Create database connection pool
 */
export function createDbPool(connectionString: string) {
  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Create Drizzle instance
 */
export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    description?: string;
  } = {},
): Promise<void> {
  const {
    timeout = 60000,
    interval = 1000,
    description = "condition",
  } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      if (await condition()) {
        return;
      }
    } catch (error) {
      // Ignore errors during wait
    }
    await sleep(interval);
  }

  throw new Error(`Timeout waiting for ${description} after ${timeout}ms`);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random API key
 */
export function generateApiKey(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 32;
  let result = "rcl_";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a hash of the API key (simplified for dev)
 */
export function hashApiKey(apiKey: string): string {
  // In production this would use proper hashing like bcrypt
  // For dev/testing, we'll use a simple hash
  return `hash_${Buffer.from(apiKey).toString("base64")}`;
}

/**
 * Generate a Privy-like ID for mock mode
 */
export function generateMockPrivyId(index: number): string {
  return `did:privy:local-user-${index}`;
}

/**
 * Generate a random Ethereum address (for agents)
 */
export function generateRandomEthAddress(): string {
  // Generate a random 40 character hex string
  const chars = "0123456789abcdef";
  let address = "0x";
  for (let i = 0; i < 40; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return address;
}

/**
 * Generate a random handle (max 15 characters)
 */
export function generateHandle(name: string): string {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const random = Math.floor(Math.random() * 10000);
  const handle = `${sanitized}${random}`;
  // Truncate to 15 characters max
  return handle.substring(0, 15);
}

/**
 * Log with timestamp
 */
export function log(
  message: string,
  level: "info" | "error" | "success" = "info",
) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: "ℹ",
    error: "✗",
    success: "✓",
  }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}
