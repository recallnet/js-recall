import { SignJWT, importPKCS8 } from "jose";
import { v4 as uuidv4 } from "uuid";

import { generateRandomEthAddress } from "./test-helpers.js";

/**
 * Test Privy authentication utilities for E2E testing
 * These utilities create mock Privy JWT tokens and user data for testing
 */

/**
 * Test private key in PEM format for signing JWTs with ES256
 * Generated with Node.js crypto.generateKeyPairSync
 */
export const TEST_PRIVY_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgw5yShsMtPgp1mJFE
zMJ1XTMxLjL60h9+07uKn6HFPkChRANCAATZpR1ntLoo8IGWsH681eOYipu/DDum
bHk7OTzX6sAHS+p7cDVYLYjnNSdTwQ+o7b5Eyw+OFTKq3N0kj0ntLPdg
-----END PRIVATE KEY-----`;

/**
 * Test public key for JWT verification (base64 encoded, matches the private key above)
 * This is the format expected by the PRIVY_JWKS_PUBLIC_KEY environment variable
 */
export const TEST_PRIVY_PUBLIC_KEY_BASE64 =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2aUdZ7S6KPCBlrB+vNXjmIqbvww7pmx5Ozk81+rAB0vqe3A1WC2I5zUnU8EPqO2+RMsPjhUyqtzdJI9J7Sz3YA==";

/**
 * Test Privy app ID used in tests
 */
export const TEST_PRIVY_APP_ID = "test-app-id";

/**
 * Test Privy app secret (not used with ES256, kept for backwards compatibility)
 */
export const TEST_PRIVY_APP_SECRET = "test-app-secret";

/**
 * Test Privy app configuration
 */
export const TEST_PRIVY_CONFIG = {
  appId: TEST_PRIVY_APP_ID,
  appSecret: TEST_PRIVY_APP_SECRET,
  jwksPublicKey: TEST_PRIVY_PUBLIC_KEY_BASE64,
};

/**
 * Set up Privy test environment variables
 * Call this before running tests that require Privy authentication
 */
export function setupPrivyTestEnvironment(): void {
  // Override Privy configuration for testing
  process.env.PRIVY_APP_ID = TEST_PRIVY_CONFIG.appId;
  process.env.PRIVY_APP_SECRET = TEST_PRIVY_CONFIG.appSecret;
  process.env.PRIVY_JWKS_PUBLIC_KEY = TEST_PRIVY_CONFIG.jwksPublicKey;
}

/**
 * Clear linked wallets after each test to prevent test pollution
 */
export async function clearPrivyLinkedWallets(): Promise<void> {
  const { MockPrivyClient } = await import("@/lib/privy/mock.js");
  MockPrivyClient.clearLinkedWallets();
}

// Default test user data
export const defaultTestUser = {
  privyId: "did:privy:test-user-12345",
  name: "Test User",
  email: "test@example.com",
  provider: "email" as const,
  walletAddress: "0x742d35Cc6665C6532e5fc7E95C7Ed1F84e93e3E4",
  walletChainType: "ethereum",
};

/**
 * Authentication provider types supported by Privy
 */
export type PrivyAuthProvider = "email" | "google" | "github" | "wallet";

/**
 * Test user profile data interface
 */
export interface TestPrivyUser {
  privyId: string;
  name?: string;
  email?: string;
  provider: PrivyAuthProvider;
  walletAddress?: string;
  walletChainType?: string;
  imageUrl?: string;
}

/**
 * Create a mock Privy JWT token for testing
 * @param user User data to include in the token
 * @param options Additional JWT options
 * @returns Signed JWT token string
 */
export async function createMockPrivyToken(
  user: Partial<TestPrivyUser> = {},
  options: {
    expiresIn?: string | number;
    issuer?: string;
    audience?: string;
    linkedWallets?: string[];
  } = {},
): Promise<string> {
  const userData = { ...defaultTestUser, ...user };
  const now = new Date();

  // Import the private key for ES256 signing
  const privateKey = await importPKCS8(TEST_PRIVY_PRIVATE_KEY, "ES256");

  // Build linked accounts array to match real Privy JWT format
  const linkedAccounts = [];

  // Always add embedded wallet (required by Privy)
  const hash = userData.privyId.split(":").pop() || "default";
  let hexString = "";
  for (let i = 0; i < hash.length && hexString.length < 40; i++) {
    const charCode = hash.charCodeAt(i);
    hexString += charCode.toString(16).padStart(2, "0");
  }
  hexString = hexString.padEnd(40, "0").slice(0, 40);
  const embeddedWalletAddress = `0x${hexString}`.toLowerCase();
  linkedAccounts.push({
    type: "wallet",
    address: embeddedWalletAddress,
    walletClient: "privy",
    walletClientType: "privy",
    chainType: "ethereum",
    chainId: "1",
    verifiedAt: now,
    firstVerifiedAt: now,
    latestVerifiedAt: now,
  });

  // Add email linked account if email is provided
  if (userData.email) {
    linkedAccounts.push({
      type: "email",
      address: userData.email,
      verifiedAt: now,
      firstVerifiedAt: now,
      latestVerifiedAt: now,
    });
  }

  // Add custom wallet if provided
  if (userData.walletAddress) {
    linkedAccounts.push({
      type: "wallet",
      address: userData.walletAddress.toLowerCase(),
      walletClient: "metamask",
      walletClientType: "injected",
      chainType: userData.walletChainType || "ethereum",
      chainId: "1",
      verifiedAt: now,
      firstVerifiedAt: now,
      latestVerifiedAt: now,
    });
  }

  // Add provider-specific linked account
  if (userData.provider === "google" && userData.email) {
    linkedAccounts.push({
      type: "google_oauth",
      subject: userData.privyId,
      email: userData.email,
      name: userData.name || null,
      verifiedAt: now,
      firstVerifiedAt: now,
      latestVerifiedAt: now,
    });
  } else if (userData.provider === "github") {
    linkedAccounts.push({
      type: "github_oauth",
      subject: userData.privyId,
      username: userData.name || "testuser",
      name: userData.name || null,
      verifiedAt: now,
      firstVerifiedAt: now,
      latestVerifiedAt: now,
    });
  }

  // Build the JWT
  const jwt = new SignJWT({
    // Privy-specific claims at top level (matching PrivyJWTPayload interface)
    email: userData.email,
    provider: userData.provider,
    providerUsername: userData.name || userData.email?.split("@")[0],
    wallet_address: userData.walletAddress,
    wallet_chain_type: userData.walletChainType,
    // Creation time
    cr: now.toISOString(),
    // Linked accounts as stringified JSON (matching real Privy JWT format)
    linked_accounts: JSON.stringify(linkedAccounts),
    // Session ID
    sid: uuidv4(),
    // Additional linked wallets (custom claim for testing)
    linked_wallets: options.linkedWallets,
  })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuedAt()
    .setIssuer(options.issuer || "privy.io")
    .setAudience(options.audience || TEST_PRIVY_APP_ID)
    .setExpirationTime(
      typeof options.expiresIn === "number"
        ? Math.floor(Date.now() / 1000) + options.expiresIn
        : "1h",
    )
    .setSubject(userData.privyId);

  return await jwt.sign(privateKey);
}

/**
 * Generate a random Privy ID
 * @returns Random Privy ID
 */
export function generateRandomPrivyId(): string {
  // Generate a random string similar to Privy's format (25 characters, alphanumeric)
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `did:privy:${result}`;
}

/**
 * Create a test user with unique identifiers
 * @param overrides Optional overrides for the user data
 * @returns Test user data
 */
export function createTestPrivyUser(
  overrides: Partial<TestPrivyUser> = {},
): TestPrivyUser {
  const id = uuidv4().slice(0, 8);
  const privyId = generateRandomPrivyId();
  return {
    privyId,
    name: `Test User ${privyId}`,
    email: `test-${id}@example.com`,
    provider: "email",
    walletAddress: generateRandomEthAddress(),
    walletChainType: "ethereum",
    ...overrides,
  };
}

/**
 * Create multiple test users for batch testing
 * @param count Number of users to create
 * @param baseOverrides Base overrides to apply to all users
 * @returns Array of test users
 */
export function createTestPrivyUsers(
  count: number,
  baseOverrides: Partial<TestPrivyUser> = {},
): TestPrivyUser[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPrivyUser({
      ...baseOverrides,
      name: `${baseOverrides.name || "Test User"} ${i + 1}`,
    }),
  );
}

/**
 * Create a user with Google provider
 */
export function createGoogleTestUser(
  overrides: Partial<TestPrivyUser> = {},
): TestPrivyUser {
  return createTestPrivyUser({
    provider: "google",
    ...overrides,
  });
}

/**
 * Create a user with GitHub provider
 */
export function createGitHubTestUser(
  overrides: Partial<TestPrivyUser> = {},
): TestPrivyUser {
  return createTestPrivyUser({
    provider: "github",
    imageUrl: "https://avatars.githubusercontent.com/test-image",
    ...overrides,
  });
}

/**
 * Create a user with email-only authentication (no wallet)
 */
export function createEmailOnlyTestUser(
  overrides: Partial<TestPrivyUser> = {},
): TestPrivyUser {
  return createTestPrivyUser({
    provider: "email",
    walletAddress: undefined,
    walletChainType: undefined,
    ...overrides,
  });
}
