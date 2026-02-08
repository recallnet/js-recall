import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import schema from "@recallnet/db/schema";

import { ANVIL_WALLETS } from "./anvil-wallets.js";
import { log } from "./utils.js";

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
export function generateUserData(): UserSeedData[] {
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
    privyId: null,
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
): Promise<void> {
  log("Seeding users...");

  const userData = generateUserData();

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
  // Get users in the same order as ANVIL_WALLETS to ensure consistent indexing
  const userIds: string[] = [];

  for (const wallet of ANVIL_WALLETS) {
    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.walletAddress, wallet.address))
      .limit(1);

    if (user) {
      userIds.push(user.id);
    }
  }

  return userIds;
}
