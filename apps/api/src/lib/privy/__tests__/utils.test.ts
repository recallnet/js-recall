/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { describe, expect, it } from "vitest";

import {
  extractPrivyIdentityToken,
  extractPrivyUserInfo,
  extractUsernameFromEmail,
  getCustomLinkedWallets,
  getEmbeddedLinkedWallet,
  isCustomLinkedWallet,
  isEmbeddedLinkedWallet,
} from "../utils.js";

describe("privy/utils", () => {
  describe("extractPrivyIdentityToken", () => {
    it("should extract token from cookie header", () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
      const request = {
        headers: {
          cookie: `privy-id-token=${token}; other-cookie=value`,
        },
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBe(token);
    });

    it("should extract token when it's the only cookie", () => {
      const token = "single-token";
      const request = {
        headers: {
          cookie: `privy-id-token=${token}`,
        },
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBe(token);
    });

    it("should extract token from multiple cookies", () => {
      const token = "multi-cookie-token";
      const request = {
        headers: {
          cookie: `first=value1; privy-id-token=${token}; last=value2`,
        },
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBe(token);
    });

    it("should return undefined when no privy-id-token cookie exists", () => {
      const request = {
        headers: {
          cookie: `other-cookie=value; session-id=123`,
        },
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBeUndefined();
    });

    it("should return undefined when no cookie header exists", () => {
      const request = {
        headers: {},
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBeUndefined();
    });

    it("should return undefined when headers is undefined", () => {
      const request = {};

      const result = extractPrivyIdentityToken(request);
      expect(result).toBeUndefined();
    });

    it("should handle empty cookie header", () => {
      const request = {
        headers: {
          cookie: "",
        },
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBeUndefined();
    });

    it("should handle malformed cookie header", () => {
      const request = {
        headers: {
          cookie: "malformed-cookie-without-equals",
        },
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBeUndefined();
    });

    it("should handle cookie with no value", () => {
      const request = {
        headers: {
          cookie: "privy-id-token=",
        },
      };

      const result = extractPrivyIdentityToken(request);
      expect(result).toBe("");
    });
  });

  describe("extractUsernameFromEmail", () => {
    it("should extract username from basic email", () => {
      expect(extractUsernameFromEmail("john.doe@example.com")).toBe("john doe");
    });

    it("should extract username with underscores", () => {
      expect(extractUsernameFromEmail("jane_smith@company.org")).toBe(
        "jane smith",
      );
    });

    it("should remove special characters", () => {
      expect(extractUsernameFromEmail("test!#$%@domain.com")).toBe("test");
    });

    it("should handle mixed periods and underscores", () => {
      expect(extractUsernameFromEmail("first.last_name@test.com")).toBe(
        "first last name",
      );
    });

    it("should condense multiple spaces", () => {
      expect(extractUsernameFromEmail("multi..word__test@example.com")).toBe(
        "multi word test",
      );
    });

    it("should handle numeric usernames", () => {
      expect(extractUsernameFromEmail("user123@domain.com")).toBe("user123");
    });

    it("should handle mixed alphanumeric", () => {
      expect(extractUsernameFromEmail("test.user2023@company.org")).toBe(
        "test user2023",
      );
    });

    it("should handle email without @ as username", () => {
      // When there's no "@", split returns the whole string as username
      // Special characters are removed, so "invalid-email" becomes "invalidemail"
      expect(extractUsernameFromEmail("invalid-email")).toBe("invalidemail");
    });

    it("should throw on email with empty username", () => {
      expect(() => extractUsernameFromEmail("@domain.com")).toThrow(
        "Invalid email address: @domain.com",
      );
    });

    it("should handle edge case with only special characters in username", () => {
      expect(extractUsernameFromEmail("!@#$%@domain.com")).toBe("");
    });
  });

  describe("wallet helper functions", () => {
    const mockCustomWallet: WalletWithMetadata = {
      type: "wallet",
      address: "0x1234567890123456789012345678901234567890",
      chainType: "ethereum",
      walletClientType: "metamask",
      verifiedAt: new Date("2024-01-01T00:00:00.000Z"),
      connectedAt: new Date("2024-01-01T00:00:00.000Z"),
      latestVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
      firstVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    } as WalletWithMetadata;

    const mockEmbeddedWallet: WalletWithMetadata = {
      type: "wallet",
      address: "0x0987654321098765432109876543210987654321",
      chainType: "ethereum",
      walletClientType: "privy",
      verifiedAt: new Date("2024-01-01T00:00:00.000Z"),
      connectedAt: new Date("2024-01-01T00:00:00.000Z"),
      latestVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
      firstVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    } as WalletWithMetadata;

    describe("isCustomLinkedWallet", () => {
      it("should return true for custom wallet", () => {
        expect(isCustomLinkedWallet(mockCustomWallet)).toBe(true);
      });

      it("should return false for embedded wallet", () => {
        expect(isCustomLinkedWallet(mockEmbeddedWallet)).toBe(false);
      });

      it("should return false for non-wallet linked account", () => {
        const nonWallet = { type: "email", address: "test@example.com" } as any;
        expect(isCustomLinkedWallet(nonWallet)).toBe(false);
      });
    });

    describe("isEmbeddedLinkedWallet", () => {
      it("should return true for embedded wallet", () => {
        expect(isEmbeddedLinkedWallet(mockEmbeddedWallet)).toBe(true);
      });

      it("should return false for custom wallet", () => {
        expect(isEmbeddedLinkedWallet(mockCustomWallet)).toBe(false);
      });

      it("should return false for non-wallet linked account", () => {
        const nonWallet = { type: "email", address: "test@example.com" } as any;
        expect(isEmbeddedLinkedWallet(nonWallet)).toBe(false);
      });
    });

    describe("getCustomLinkedWallets", () => {
      it("should return custom wallets with lowercase addresses", () => {
        const privyUser = {
          linkedAccounts: [mockCustomWallet, mockEmbeddedWallet],
        } as PrivyUser;

        const result = getCustomLinkedWallets(privyUser);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          ...mockCustomWallet,
          address: mockCustomWallet.address.toLowerCase(),
        });
      });

      it("should return empty array when no custom wallets", () => {
        const privyUser = {
          linkedAccounts: [mockEmbeddedWallet],
        } as PrivyUser;

        const result = getCustomLinkedWallets(privyUser);
        expect(result).toEqual([]);
      });

      it("should handle user with no linked accounts", () => {
        const privyUser = { linkedAccounts: [] } as any as PrivyUser;
        const result = getCustomLinkedWallets(privyUser);
        expect(result).toEqual([]);
      });
    });

    describe("getEmbeddedLinkedWallet", () => {
      it("should return embedded wallet with lowercase address", () => {
        const privyUser = {
          linkedAccounts: [mockCustomWallet, mockEmbeddedWallet],
        } as PrivyUser;

        const result = getEmbeddedLinkedWallet(privyUser);

        expect(result).toEqual({
          ...mockEmbeddedWallet,
          address: mockEmbeddedWallet.address.toLowerCase(),
        });
      });

      it("should return undefined when no embedded wallet", () => {
        const privyUser = {
          linkedAccounts: [mockCustomWallet],
        } as PrivyUser;

        const result = getEmbeddedLinkedWallet(privyUser);
        expect(result).toBeUndefined();
      });

      it("should handle user with no linked accounts", () => {
        const privyUser = { linkedAccounts: [] } as any as PrivyUser;
        const result = getEmbeddedLinkedWallet(privyUser);
        expect(result).toBeUndefined();
      });
    });
  });

  describe("extractPrivyUserInfo", () => {
    const createMockPrivyUser = (overrides = {}): PrivyUser =>
      ({
        id: "privy-user-123",
        createdAt: new Date(),
        isGuest: false,
        customMetadata: {},
        wallet: {
          address: "0x1234567890123456789012345678901234567890",
        } as any,
        email: { address: "test@example.com" } as any,
        linkedAccounts: [
          {
            type: "wallet",
            address: "0x0987654321098765432109876543210987654321",
            chainType: "ethereum",
            walletClientType: "privy",
            verifiedAt: new Date("2024-01-01T00:00:00.000Z"),
            connectedAt: new Date("2024-01-01T00:00:00.000Z"),
            latestVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
            firstVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
          } as WalletWithMetadata,
        ],
        ...overrides,
      }) as PrivyUser;

    it("should extract user info with email authentication", () => {
      const privyUser = createMockPrivyUser();

      const result = extractPrivyUserInfo(privyUser);

      expect(result).toEqual({
        privyId: "privy-user-123",
        name: "test",
        email: "test@example.com",
        embeddedWallet: expect.objectContaining({
          address: "0x0987654321098765432109876543210987654321",
        }),
        customWallets: [],
      });
    });

    it("should prefer Google name over email-derived name", () => {
      const privyUser = createMockPrivyUser({
        google: { name: "Google User", email: "google@example.com" },
      });

      const result = extractPrivyUserInfo(privyUser);

      expect(result.name).toBe("Google User");
      expect(result.email).toBe("google@example.com");
    });

    it("should prefer GitHub name over Google name", () => {
      const privyUser = createMockPrivyUser({
        google: { name: "Google User", email: "google@example.com" },
        github: { name: "GitHub User" },
      });

      const result = extractPrivyUserInfo(privyUser);

      expect(result.name).toBe("GitHub User");
    });

    it("should use custom metadata name when provided", () => {
      const privyUser = createMockPrivyUser({
        customMetadata: { name: "Custom Name" },
      });

      const result = extractPrivyUserInfo(privyUser);

      expect(result.name).toBe("Custom Name");
    });

    it("should prioritize GitHub > Google > customMetadata > email-derived names", () => {
      const privyUser = createMockPrivyUser({
        email: { address: "email@example.com" },
        customMetadata: { name: "Custom Name" },
        google: { name: "Google User", email: "google@example.com" },
        github: { name: "GitHub User" },
      });

      const result = extractPrivyUserInfo(privyUser);

      expect(result.name).toBe("GitHub User");
    });

    it("should throw when wallet address is missing", () => {
      const privyUser = createMockPrivyUser({ wallet: null });

      expect(() => extractPrivyUserInfo(privyUser)).toThrow(
        "Privy wallet address not found for user: privy-user-123",
      );
    });

    it("should throw when email is missing", () => {
      const privyUser = createMockPrivyUser({
        email: null,
        google: null,
      });

      expect(() => extractPrivyUserInfo(privyUser)).toThrow(
        "Privy user email not found for user: privy-user-123",
      );
    });

    it("should throw when embedded wallet is missing", () => {
      const privyUser = createMockPrivyUser({
        linkedAccounts: [],
      });

      expect(() => extractPrivyUserInfo(privyUser)).toThrow(
        "Privy embedded wallet not found for user: privy-user-123",
      );
    });

    it("should include custom wallets when present", () => {
      const customWallet: WalletWithMetadata = {
        type: "wallet",
        address: "0xCUSTOM1234567890123456789012345678901234",
        chainType: "ethereum",
        walletClientType: "metamask",
        verifiedAt: new Date("2024-01-01T00:00:00.000Z"),
        connectedAt: new Date("2024-01-01T00:00:00.000Z"),
        latestVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
        firstVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
      } as WalletWithMetadata;

      const privyUser = createMockPrivyUser({
        linkedAccounts: [...createMockPrivyUser().linkedAccounts, customWallet],
      });

      const result = extractPrivyUserInfo(privyUser);

      expect(result.customWallets).toHaveLength(1);
      expect(result.customWallets[0]).toEqual({
        ...customWallet,
        address: customWallet.address.toLowerCase(),
      });
    });

    it("should handle non-string custom metadata name", () => {
      const privyUser = createMockPrivyUser({
        customMetadata: { name: 123 }, // Non-string name
      });

      const result = extractPrivyUserInfo(privyUser);

      expect(result.name).toBe("test"); // Falls back to email-derived name
    });

    it("should prefer Google email over regular email", () => {
      const privyUser = createMockPrivyUser({
        email: { address: "regular@example.com" },
        google: { email: "google@example.com" },
      });

      const result = extractPrivyUserInfo(privyUser);

      expect(result.email).toBe("google@example.com");
    });
  });
});
