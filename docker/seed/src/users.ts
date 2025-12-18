import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import schema from "@recallnet/db/schema";

import { ANVIL_WALLETS } from "./anvil-wallets.js";
import { generateMockPrivyId, log } from "./utils.js";

export interface UserSeedData {
  walletAddress: string;
  privyId: string | null;
  name: string;
  email: string;
  imageUrl: string;
}

/**
 * Generate user seed data from Anvil wallets
 */
export function generateUserData(authMode: "mock" | "privy"): UserSeedData[] {
  const userNames = [
    "Alice Trader",
    "Bob Arbitrage",
    "Charlie DeFi",
    "Diana Strategy",
    "Eve Analytics",
    "Frank Quant",
    "Grace Market",
    "Henry Algo",
    "Iris Smart",
    "Jack Crypto",
  ];

  return ANVIL_WALLETS.map((wallet, index) => ({
    walletAddress: wallet.address,
    privyId: authMode === "mock" ? generateMockPrivyId(index) : null,
    name: userNames[index] || `User ${index + 1}`,
    email: `user${index}@recall.local`,
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${index}`,
  }));
}

/**
 * Seed users into the database
 */
export async function seedUsers(
  db: NodePgDatabase<typeof schema>,
  authMode: "mock" | "privy",
): Promise<void> {
  log("Seeding users...");

  const userData = generateUserData(authMode);

  for (const user of userData) {
    try {
      // Check if user already exists
      const existing = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.walletAddress, user.walletAddress))
        .limit(1);

      if (existing.length > 0) {
        log(`User ${user.walletAddress} already exists, skipping`, "info");
        continue;
      }

      // Insert user with generated UUID
      await db.insert(schema.users).values({
        id: randomUUID(),
        walletAddress: user.walletAddress,
        privyId: user.privyId,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
        status: "active",
        isSubscribed: false,
        metadata: {},
      });

      log(`Created user: ${user.name} (${user.walletAddress})`, "success");
    } catch (error) {
      log(`Failed to create user ${user.name}: ${error}`, "error");
      throw error;
    }
  }

  log(`Seeded ${userData.length} users`, "success");
}

/**
 * Get seeded user IDs
 */
export async function getSeededUserIds(
  db: NodePgDatabase<typeof schema>,
): Promise<string[]> {
  // Get all users and return first 10 (our seeded Anvil users)
  const allUsers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .limit(10);

  return allUsers.map((u) => u.id);
}
