/**
 * Test implementation of Privy authentication for E2E testing
 * This module provides mock implementations that bypass external API calls
 */
import type {
  LinkedAccountWithMetadata,
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";

import { config } from "@/config/index.js";
import { authLogger } from "@/lib/logger.js";

/**
 * Mock implementation of PrivyClient for testing
 */
export class MockPrivyClient {
  // Static map to track custom linked wallets for each privyId
  private static linkedWallets = new Map<string, string[]>();

  constructor(
    public appId: string,
    public appSecret: string,
  ) {}

  /**
   * Mock getUser method that returns user data based on the JWT token
   */
  async getUser({ idToken }: { idToken: string }): Promise<PrivyUser> {
    // Parse the JWT token to extract user data
    const payload = this.parseJwtPayload(idToken);
    return this.createUserFromJwtPayload(payload);
  }

  /**
   * Static method to simulate linking a wallet to a user (used by tests)
   */
  static linkWallet(privyId: string, walletAddress: string): void {
    const existingWallets = this.linkedWallets.get(privyId) || [];
    if (!existingWallets.includes(walletAddress.toLowerCase())) {
      existingWallets.push(walletAddress.toLowerCase());
      this.linkedWallets.set(privyId, existingWallets);
      authLogger.debug(
        `[MockPrivyClient] Linked wallet ${walletAddress} to privyId ${privyId}`,
      );
      authLogger.debug(
        `[MockPrivyClient] Total linked wallets for ${privyId}: ${existingWallets.length}`,
      );
    }
  }

  /**
   * Static method to clear all linked wallets (useful for test cleanup)
   */
  static clearLinkedWallets(): void {
    this.linkedWallets.clear();
  }

  /**
   * Parse JWT payload without verification (for testing)
   */
  private parseJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const payloadPart = parts[1];
    if (!payloadPart) {
      throw new Error("Invalid JWT payload");
    }

    const payload = Buffer.from(payloadPart, "base64").toString("utf-8");
    return JSON.parse(payload) as Record<string, unknown>;
  }

  /**
   * Create a mock Privy user from JWT payload
   */
  private createUserFromJwtPayload(
    payload: Record<string, unknown>,
  ): PrivyUser {
    const privyId = String(payload.sub || "");
    const email = payload.email ? String(payload.email) : undefined;
    const provider = (payload.provider as string) || undefined;
    const walletAddress = payload.wallet_address
      ? String(payload.wallet_address)
      : undefined;
    const walletChainType = payload.wallet_chain_type
      ? String(payload.wallet_chain_type)
      : undefined;
    const name = payload.providerUsername
      ? String(payload.providerUsername)
      : undefined;

    const now = new Date();
    const linkedAccounts: LinkedAccountWithMetadata[] = [];

    // Always add embedded wallet (required by our Privy configuration)
    // Generate a valid Ethereum address from the privyId
    const hash = privyId.split(":").pop() || "default";
    const embeddedWalletAddress =
      `0x${hash.padEnd(40, "0").slice(0, 40)}`.toLowerCase();
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
    } as WalletWithMetadata);

    // Add email linked account if email is provided
    if (email) {
      linkedAccounts.push({
        type: "email",
        address: email,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      } as LinkedAccountWithMetadata);
    }

    // Add custom wallet if provided
    if (walletAddress) {
      linkedAccounts.push({
        type: "wallet",
        address: walletAddress.toLowerCase(),
        walletClient: "metamask",
        walletClientType: "injected",
        chainType: walletChainType,
        chainId: "1",
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      } as WalletWithMetadata);
    }

    // Add any dynamically linked wallets from JWT payload or static map
    const linkedWalletsFromJWT = (payload.linked_wallets as string[]) || [];
    const linkedWalletsFromMap =
      MockPrivyClient.linkedWallets.get(privyId) || [];
    const allLinkedWallets = [
      ...new Set([...linkedWalletsFromJWT, ...linkedWalletsFromMap]),
    ];
    let mostRecentWallet = walletAddress || embeddedWalletAddress;

    for (const linkedWallet of allLinkedWallets) {
      // Skip if this wallet is already in the linkedAccounts
      const alreadyExists = linkedAccounts.some(
        (account) =>
          account.type === "wallet" &&
          account.address === linkedWallet.toLowerCase(),
      );

      if (!alreadyExists) {
        authLogger.debug(
          `[MockPrivyClient] Adding dynamically linked wallet: ${linkedWallet}`,
        );
        linkedAccounts.push({
          type: "wallet",
          address: linkedWallet.toLowerCase(),
          walletClient: "metamask",
          walletClientType: "injected",
          chainType: "ethereum",
          chainId: "1",
          verifiedAt: now,
          firstVerifiedAt: now,
          latestVerifiedAt: now,
        } as WalletWithMetadata);

        // The most recent wallet is the last one added
        mostRecentWallet = linkedWallet.toLowerCase();
      }
    }

    // Add provider-specific linked account
    if (provider === "google" && email) {
      linkedAccounts.push({
        type: "google_oauth",
        subject: privyId,
        email: email,
        name: name || null,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      } as LinkedAccountWithMetadata);
    } else if (provider === "github") {
      linkedAccounts.push({
        type: "github_oauth",
        subject: privyId,
        username: name || "testuser",
        name: name || null,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      } as LinkedAccountWithMetadata);
    }

    // Build the mock user object
    const mockUser: PrivyUser = {
      id: privyId,
      createdAt: now,
      linkedAccounts,
      isGuest: false,
      customMetadata: {},
      wallet: {
        address: mostRecentWallet.toLowerCase(),
        chainType:
          walletChainType === "solana" ||
          walletChainType === "bitcoin-segwit" ||
          walletChainType === "cosmos" ||
          walletChainType === "stellar" ||
          walletChainType === "sui" ||
          walletChainType === "tron" ||
          walletChainType === "near" ||
          walletChainType === "ton" ||
          walletChainType === "spark"
            ? walletChainType
            : "ethereum",
        walletClientType:
          mostRecentWallet === embeddedWalletAddress ? "privy" : "injected",
        connectorType:
          mostRecentWallet === embeddedWalletAddress ? "embedded" : "injected",
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      },
    };

    // Add email object if email is provided
    if (email) {
      mockUser.email = {
        address: email,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      };
    }

    // Add provider-specific objects
    if (provider === "google" && email) {
      mockUser.google = {
        email: email,
        name: name || null,
        subject: privyId,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      };
    } else if (provider === "github") {
      mockUser.github = {
        subject: privyId,
        username: name || "testuser",
        name: name || null,
        email: email || null,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      };
    }

    authLogger.debug(`[MockPrivyClient] Created mock user: ${privyId}`);
    return mockUser;
  }
}

/**
 * Get Privy client - returns mock client in test mode
 */
export function getPrivyClient(appId: string, appSecret: string) {
  if (config.server.nodeEnv === "test") {
    authLogger.debug("[getPrivyClient] Using MockPrivyClient for testing");
    return new MockPrivyClient(appId, appSecret);
  }

  // This should never be called in test mode, but if it is, throw an error
  throw new Error("Real PrivyClient should not be used in test mode");
}
