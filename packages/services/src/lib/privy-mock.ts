/**
 * Test implementation of Privy authentication for E2E testing
 * This module provides mock implementations that bypass external API calls
 */
import type {
  LinkedAccountWithMetadata,
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";

type WalletChainType =
  | "ethereum"
  | "cosmos"
  | "stellar"
  | "sui"
  | "tron"
  | "bitcoin-segwit"
  | "near"
  | "ton"
  | "spark"
  | "solana";

/**
 * Mock implementation of PrivyClient for testing.
 * Note: This is cast to PrivyClient when used, implementing only the subset of methods we need.
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
    }
  }

  /**
   * Mock deletion of a Privy user. Throws when privyId contains "fail" to simulate API failure.
   * This allows E2E tests to exercise transaction rollback behavior.
   * @param privyId The Privy user ID to delete
   */
  async deleteUser(privyId: string): Promise<void> {
    if (privyId.toLowerCase().includes("fail")) {
      throw new Error(`Mock Privy delete failure for ${privyId}`);
    }
    // No-op for success path
  }

  /**
   * Static method to clear all linked wallets (useful for test cleanup)
   */
  static clearLinkedWallets(): void {
    this.linkedWallets.clear();
  }

  /**
   * Format linked accounts for a test user
   * @param user - The test user
   * @param provider - The authentication provider of the user
   * @param email - The email address of the user
   * @param walletAddress - The wallet address of the user
   * @param embeddedWalletAddress - The embedded wallet address of the user
   */
  private formatLinkedAccounts(
    provider: string,
    email?: string,
    walletAddress?: string,
    embeddedWalletAddress?: string,
    name?: string,
  ): LinkedAccountWithMetadata[] {
    const linkedAccounts: LinkedAccountWithMetadata[] = [];

    if (email) {
      linkedAccounts.push({
        type: "email",
        address: email,
        verifiedAt: new Date(),
        firstVerifiedAt: new Date(),
        latestVerifiedAt: new Date(),
      });
    }

    if (embeddedWalletAddress) {
      linkedAccounts.push({
        id: new Date().getTime().toString(),
        type: "wallet",
        address: embeddedWalletAddress,
        walletClientType: "privy",
        chainType: "ethereum",
        chainId: "1",
        verifiedAt: new Date(),
        firstVerifiedAt: new Date(),
        latestVerifiedAt: new Date(),
      });
    }

    if (walletAddress) {
      linkedAccounts.push({
        type: "wallet",
        address: walletAddress,
        walletClientType: "injected",
        chainType: "ethereum",
        chainId: "1",
        verifiedAt: new Date(),
        firstVerifiedAt: new Date(),
        latestVerifiedAt: new Date(),
      });
    }

    if (provider === "google" && email) {
      linkedAccounts.push({
        type: "google_oauth",
        subject: new Date().getTime().toString(),
        email: email,
        name: name || null,
        verifiedAt: new Date(),
        firstVerifiedAt: new Date(),
        latestVerifiedAt: new Date(),
      });
    }

    if (provider === "github") {
      linkedAccounts.push({
        type: "github_oauth",
        subject: new Date().getTime().toString(),
        email: email || null,
        username: name || null,
        name: name || null,
        verifiedAt: new Date(),
        firstVerifiedAt: new Date(),
        latestVerifiedAt: new Date(),
      });
    }

    return linkedAccounts;
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
    // Convenience variables for easier test overrides
    const email = payload.email ? String(payload.email) : undefined;
    const provider = (payload.provider as string) || undefined;
    const walletAddress = payload.wallet_address
      ? String(payload.wallet_address)
      : undefined;
    const walletChainType = payload.wallet_chain_type
      ? String(payload.wallet_chain_type)
      : undefined;
    const name = payload.provider_username
      ? String(payload.provider_username)
      : undefined;

    const now = new Date();
    let linkedAccounts: LinkedAccountWithMetadata[] = [];

    // Always generate embedded wallet address (required by our Privy configuration)
    const hash = privyId.split(":").pop() || "default";
    let hexString = "";
    for (let i = 0; i < hash.length && hexString.length < 40; i++) {
      const charCode = hash.charCodeAt(i);
      hexString += charCode.toString(16).padStart(2, "0");
    }
    hexString = hexString.padEnd(40, "0").slice(0, 40);
    const embeddedWalletAddress = `0x${hexString}`.toLowerCase();

    // Parse linked_accounts if it's a stringified JSON (matching real Privy JWT format)
    if (typeof payload.linked_accounts === "string") {
      try {
        linkedAccounts = JSON.parse(
          payload.linked_accounts,
        ) as LinkedAccountWithMetadata[];
      } catch {
        // If parsing fails, we'll build linkedAccounts below
        linkedAccounts = [];
      }
    } else if (Array.isArray(payload.linked_accounts)) {
      // Support backward compatibility if linked_accounts is already an array
      linkedAccounts = payload.linked_accounts as LinkedAccountWithMetadata[];
    }

    // If linkedAccounts is empty, build it from other JWT fields
    if (linkedAccounts.length === 0) {
      linkedAccounts = this.formatLinkedAccounts(
        provider || "",
        email,
        walletAddress,
        embeddedWalletAddress,
        name,
      );
    }

    // Determine the most recent wallet address
    const wallets = linkedAccounts.filter(
      (account) =>
        account.type === "wallet" && account.walletClientType !== "privy",
    ) as WalletWithMetadata[];
    const mostRecentWallet =
      wallets.length > 0
        ? wallets[wallets.length - 1]!.address
        : embeddedWalletAddress;

    // Build the mock user object
    const mockUser: PrivyUser = {
      id: privyId,
      createdAt: now,
      linkedAccounts,
      isGuest: false,
      customMetadata: {},
      wallet: {
        address: mostRecentWallet.toLowerCase(),
        chainType: walletChainType
          ? (walletChainType as WalletChainType)
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

    // Add email object from linked accounts or top-level claim
    const emailFromLinked = linkedAccounts.find((a) => a.type === "email");
    const finalEmail = emailFromLinked?.address || email;
    if (finalEmail) {
      mockUser.email = {
        address: finalEmail,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      };
    }

    // Store the name in customMetadata for email providers
    // This simulates how Privy might store additional user profile data
    if (provider === "email" && name) {
      mockUser.customMetadata = {
        ...mockUser.customMetadata,
        name: name,
      };
    }

    // Add provider-specific objects inferred from linked accounts when available
    const googleLinked = linkedAccounts.find((a) => a.type === "google_oauth");
    if (googleLinked) {
      mockUser.google = {
        email: googleLinked.email || finalEmail || "",
        name: googleLinked.name || null,
        subject: googleLinked.subject || privyId,
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      };
    }

    const githubLinked = linkedAccounts.find(
      (a) => a.type === "github_oauth",
    ) as
      | { email?: string; username?: string; name?: string; subject?: string }
      | undefined;
    if (githubLinked) {
      mockUser.github = {
        subject: githubLinked.subject || privyId,
        username: githubLinked.username || name || "testuser",
        name: githubLinked.name || name || null,
        email: githubLinked.email || finalEmail || "",
        verifiedAt: now,
        firstVerifiedAt: now,
        latestVerifiedAt: now,
      };
    }

    return mockUser;
  }
}
