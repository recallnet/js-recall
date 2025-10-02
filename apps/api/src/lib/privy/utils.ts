import type {
  LinkedAccountWithMetadata,
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { IncomingHttpHeaders } from "http";

/**
 * Extract Privy identity token from request.
 *
 * Preference order:
 * 1) privy-id-token header
 * 2) privy-id-token cookie
 *
 * @param request - The request-like object containing headers and/or cookies
 * @returns The Privy identity token if found, otherwise undefined
 */
export function extractPrivyIdentityToken(request: {
  headers?: IncomingHttpHeaders;
  cookies?: { get: (name: string) => { value: string } | undefined };
}): string | undefined {
  // Prefer explicit header if present
  const headerValue = request.headers?.["privy-id-token"];
  if (typeof headerValue === "string" && headerValue.length > 0) {
    return headerValue;
  }
  if (Array.isArray(headerValue) && headerValue.length > 0) {
    return headerValue[0];
  }

  // Fallback to cookie header parsing
  return request.headers?.cookie
    ?.split("; ")
    .find((c: string) => c.startsWith("privy-id-token="))
    ?.split("=")[1];
}

/**
 * Privy default JWT issuer
 */
export const PRIVY_ISSUER = "privy.io";

/**
 * A subset of user profile data extracted from Privy user object that matches our database schema,
 * and guaranteed to be present in the Privy user object or through parsing logic.
 */
export type PrivyUserInfo = {
  privyId: string;
  name: string;
  email: string;
  embeddedWallet: Omit<WalletWithMetadata, "type">;
  customWallets: WalletWithMetadata[];
};

/**
 * Check if a Privy user is set up with a custom linked wallet. Custom linked wallets are linked
 * accounts with a wallet client type that is not "privy" (i.e., not an embedded wallet).
 * @param wallet - The linked account to check.
 * @returns True if the linked account is a custom linked wallet, false otherwise. If the user is not
 * set up with a custom linked wallet, returns false.
 */
export function isCustomLinkedWallet(
  wallet: LinkedAccountWithMetadata,
): wallet is WalletWithMetadata {
  return wallet.type === "wallet" && wallet.walletClientType !== "privy";
}

/**
 * Check if a Privy user is set up with an embedded wallet. Embedded wallets are linked
 * accounts with a wallet client type that is "privy".
 * @param wallet - The linked account to check.
 * @returns True if the linked account is an embedded wallet, false otherwise. If the user is not
 * set up with an embedded wallet, returns false.
 */
export function isEmbeddedLinkedWallet(
  wallet: LinkedAccountWithMetadata,
): wallet is WalletWithMetadata {
  return wallet.type === "wallet" && wallet.walletClientType === "privy";
}

/**
 * Get the custom linked wallet from a Privy user.
 * @param privyUser - The Privy user to get the custom linked wallet from.
 * @returns The custom linked wallet, or undefined if no custom linked wallet is found.
 */
export function getCustomLinkedWallets(
  privyUser: PrivyUser,
): WalletWithMetadata[] {
  const customWallets = privyUser.linkedAccounts.filter(isCustomLinkedWallet);
  // Transform wallet address to lowercase for db comparison reasons
  return customWallets.map((wallet) => ({
    ...wallet,
    address: wallet.address.toLowerCase(),
  }));
}

/**
 * Get the custom linked wallet from a Privy user.
 * @param privyUser - The Privy user to get the custom linked wallet from.
 * @returns The custom linked wallet, or undefined if no custom linked wallet is found.
 */
export function getEmbeddedLinkedWallet(
  privyUser: PrivyUser,
): WalletWithMetadata | undefined {
  const embeddedWallet = privyUser.linkedAccounts.find(isEmbeddedLinkedWallet);
  // Transform wallet address to lowercase for db comparison reasons
  if (embeddedWallet) {
    embeddedWallet.address = embeddedWallet.address.toLowerCase();
  }
  return embeddedWallet;
}

/**
 * Extract username portion from email address.
 *
 * @param email - The email address to extract the username from.
 * @returns The username portion of the email address.
 */
export function extractUsernameFromEmail(email: string): string {
  const username = email.split("@")[0];
  if (!username || username.length === 0) {
    throw new Error(`Invalid email address: ${email}`);
  }
  // Replace periods or underscores with spaces, then remove all other special characters, and
  // trim and condense multiple spaces into a single space.
  return username
    .replace(/[._]/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Extract comprehensive profile data from Privy user object. Per our Privy configuration, we can
 * guarantee an email and embedded wallet address, and (potentially) a linked wallet.
 *
 * @param privyUser - The Privy user object.
 * @returns The user profile data.
 */
export function extractPrivyUserInfo(privyUser: PrivyUser): PrivyUserInfo {
  if (!privyUser.wallet?.address) {
    // Note: the `wallet.address` is the most recent linked wallet address, which may
    // or may not be the embedded Privy wallet.
    throw new Error(`Privy wallet address not found for user: ${privyUser.id}`);
  }
  const email = privyUser.google?.email ?? privyUser.email?.address;
  if (!email) {
    throw new Error(`Privy user email not found for user: ${privyUser.id}`);
  }

  // If the user has a linked wallet, use that address instead of the embedded Privy wallet address
  const embeddedWallet = getEmbeddedLinkedWallet(privyUser);
  if (!embeddedWallet) {
    throw new Error(
      `Privy embedded wallet not found for user: ${privyUser.id}`,
    );
  }
  const customWallets = getCustomLinkedWallets(privyUser);
  const privyId = privyUser.id;

  // Check if Google or GitHub are provided, and if so, override the user's email-derived name
  // For email providers, check `customMetadata` for a name (e.g., used in e2e tests)
  const name =
    privyUser.github?.name ??
    privyUser.google?.name ??
    (typeof privyUser.customMetadata?.name === "string"
      ? privyUser.customMetadata.name
      : null) ??
    extractUsernameFromEmail(email);

  return {
    privyId,
    name,
    email,
    embeddedWallet,
    customWallets,
  };
}
