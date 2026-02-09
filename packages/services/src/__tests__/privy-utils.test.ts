import type {
  LinkedAccountWithMetadata,
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { describe, expect, it } from "vitest";

import {
  extractPrivyUserInfo,
  getCustomLinkedWallets,
  getEmbeddedLinkedWallet,
  isCustomLinkedWallet,
  isEmbeddedLinkedWallet,
} from "../lib/privy-utils.js";

function makeWallet(
  overrides: Partial<WalletWithMetadata> & { address: string },
): WalletWithMetadata {
  return {
    type: "wallet",
    chainType: "ethereum",
    walletClientType: "injected",
    connectorType: "injected",
    verifiedAt: new Date(),
    firstVerifiedAt: new Date(),
    latestVerifiedAt: new Date(),
    ...overrides,
  } as WalletWithMetadata;
}

function makePrivyUser(
  linkedAccounts: LinkedAccountWithMetadata[],
  walletAddress?: string,
): PrivyUser {
  return {
    id: "did:privy:test123",
    createdAt: new Date(),
    linkedAccounts,
    wallet: walletAddress ? { address: walletAddress } : undefined,
  } as unknown as PrivyUser;
}

describe("privy-utils", () => {
  describe("isCustomLinkedWallet", () => {
    it("should return true for non-privy wallet", () => {
      const wallet = makeWallet({
        address: "0xabc",
        walletClientType: "metamask",
      });
      expect(isCustomLinkedWallet(wallet)).toBe(true);
    });

    it("should return false for privy embedded wallet", () => {
      const wallet = makeWallet({
        address: "0xabc",
        walletClientType: "privy",
      });
      expect(isCustomLinkedWallet(wallet)).toBe(false);
    });

    it("should return false for non-wallet account types", () => {
      const account = {
        type: "email",
        address: "test@example.com",
      } as unknown as LinkedAccountWithMetadata;
      expect(isCustomLinkedWallet(account)).toBe(false);
    });
  });

  describe("isEmbeddedLinkedWallet", () => {
    it("should return true for privy wallet", () => {
      const wallet = makeWallet({
        address: "0xabc",
        walletClientType: "privy",
      });
      expect(isEmbeddedLinkedWallet(wallet)).toBe(true);
    });

    it("should return false for non-privy wallet", () => {
      const wallet = makeWallet({
        address: "0xabc",
        walletClientType: "metamask",
      });
      expect(isEmbeddedLinkedWallet(wallet)).toBe(false);
    });
  });

  describe("getCustomLinkedWallets", () => {
    it("should return only custom wallets sorted by firstVerifiedAt descending", () => {
      const older = makeWallet({
        address: "0xOLDER",
        walletClientType: "metamask",
        firstVerifiedAt: new Date("2024-01-01"),
      });
      const newer = makeWallet({
        address: "0xNEWER",
        walletClientType: "metamask",
        firstVerifiedAt: new Date("2024-06-01"),
      });
      const embedded = makeWallet({
        address: "0xEMBEDDED",
        walletClientType: "privy",
        firstVerifiedAt: new Date("2024-03-01"),
      });

      const user = makePrivyUser([older, embedded, newer], "0xNEWER");
      const result = getCustomLinkedWallets(user);

      expect(result).toHaveLength(2);
      expect(result[0]!.address).toBe("0xnewer"); // most recent first
      expect(result[1]!.address).toBe("0xolder");
    });

    it("should lowercase wallet addresses", () => {
      const wallet = makeWallet({
        address: "0xAbCdEf1234567890",
        walletClientType: "metamask",
      });

      const user = makePrivyUser([wallet], "0xAbCdEf1234567890");
      const result = getCustomLinkedWallets(user);

      expect(result[0]!.address).toBe("0xabcdef1234567890");
    });

    it("should handle wallets without firstVerifiedAt timestamps", () => {
      const withTimestamp = makeWallet({
        address: "0xWITH",
        walletClientType: "metamask",
        firstVerifiedAt: new Date("2024-06-01"),
      });
      const withoutTimestamp = makeWallet({
        address: "0xWITHOUT",
        walletClientType: "metamask",
        firstVerifiedAt: undefined as unknown as Date,
      });

      const user = makePrivyUser([withoutTimestamp, withTimestamp], "0xWITH");
      const result = getCustomLinkedWallets(user);

      expect(result).toHaveLength(2);
      // Wallet with timestamp should sort first (timeB - timeA, descending)
      expect(result[0]!.address).toBe("0xwith");
      expect(result[1]!.address).toBe("0xwithout");
    });

    it("should return empty array when no custom wallets exist", () => {
      const embedded = makeWallet({
        address: "0xEMBEDDED",
        walletClientType: "privy",
      });

      const user = makePrivyUser([embedded], "0xEMBEDDED");
      const result = getCustomLinkedWallets(user);

      expect(result).toHaveLength(0);
    });
  });

  describe("getEmbeddedLinkedWallet", () => {
    it("should return the embedded wallet with lowercased address", () => {
      const embedded = makeWallet({
        address: "0xAbCdEf",
        walletClientType: "privy",
      });

      const user = makePrivyUser([embedded], "0xAbCdEf");
      const result = getEmbeddedLinkedWallet(user);

      expect(result).toBeDefined();
      expect(result!.address).toBe("0xabcdef");
    });

    it("should return undefined when no embedded wallet exists", () => {
      const custom = makeWallet({
        address: "0xabc",
        walletClientType: "metamask",
      });

      const user = makePrivyUser([custom], "0xabc");
      const result = getEmbeddedLinkedWallet(user);

      expect(result).toBeUndefined();
    });
  });

  describe("extractPrivyUserInfo", () => {
    it("should set loginWallet for wallet-first users (no email)", () => {
      const customWallet = makeWallet({
        address: "0xEXTERNAL",
        walletClientType: "metamask",
        firstVerifiedAt: new Date("2024-06-01"),
      });

      const user = makePrivyUser([customWallet], "0xEXTERNAL");
      const result = extractPrivyUserInfo(user);

      expect(result.loginWallet).toBeDefined();
      expect(result.loginWallet!.address).toBe("0xexternal");
      expect(result.email).toBeUndefined();
      expect(result.embeddedWallet).toBeUndefined();
    });

    it("should not set loginWallet for email users", () => {
      const embedded = makeWallet({
        address: "0xEMBEDDED",
        walletClientType: "privy",
      });
      const customWallet = makeWallet({
        address: "0xCUSTOM",
        walletClientType: "metamask",
      });

      const user = {
        ...makePrivyUser([embedded, customWallet], "0xCUSTOM"),
        email: { address: "test@example.com" },
      } as unknown as PrivyUser;
      const result = extractPrivyUserInfo(user);

      expect(result.loginWallet).toBeUndefined();
      expect(result.email).toBe("test@example.com");
      expect(result.customWallets).toHaveLength(1);
    });

    it("should not set loginWallet for google users", () => {
      const embedded = makeWallet({
        address: "0xEMBEDDED",
        walletClientType: "privy",
      });

      const user = {
        ...makePrivyUser([embedded], "0xEMBEDDED"),
        google: { email: "test@gmail.com" },
      } as unknown as PrivyUser;
      const result = extractPrivyUserInfo(user);

      expect(result.loginWallet).toBeUndefined();
      expect(result.email).toBe("test@gmail.com");
    });

    it("should throw when no wallet address is found", () => {
      const user = makePrivyUser([], undefined);

      expect(() => extractPrivyUserInfo(user)).toThrow(
        "Privy wallet address not found",
      );
    });

    it("should use most recently verified custom wallet as loginWallet", () => {
      const older = makeWallet({
        address: "0xOLDER",
        walletClientType: "metamask",
        firstVerifiedAt: new Date("2024-01-01"),
      });
      const newer = makeWallet({
        address: "0xNEWER",
        walletClientType: "metamask",
        firstVerifiedAt: new Date("2024-06-01"),
      });

      const user = makePrivyUser([older, newer], "0xNEWER");
      const result = extractPrivyUserInfo(user);

      expect(result.loginWallet!.address).toBe("0xnewer");
    });
  });
});
