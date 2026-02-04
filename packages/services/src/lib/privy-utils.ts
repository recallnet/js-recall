import type {
  LinkedAccountWithMetadata,
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { IncomingHttpHeaders } from "http";

/**
 * Extract Privy token from request headers cookies.
 *
 * The `privy-id-token` cookie is set by Privy when a user is authenticated.
 * It is a JWT token that contains the user's identity and authentication information.
 * We need to extract the token from the cookie header.
 *
 * @param request - The request object to extract the token from.
 * @returns The Privy identity token.
 */
export function extractPrivyIdentityToken(request: {
  headers?: IncomingHttpHeaders;
  cookies?: { get: (name: string) => { value: string } | undefined };
}): string | undefined {
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
 * A subset of user profile data extracted from Privy user object that matches our database schema.
 * For email/social logins: email and embeddedWallet are present.
 * For wallet-first logins: loginWallet is present, email and embeddedWallet may be absent.
 */
export type PrivyUserInfo = {
  privyId: string;
  email?: string; // Optional for wallet-first users
  embeddedWallet?: Omit<WalletWithMetadata, "type">; // Optional for wallet-first users
  customWallets: WalletWithMetadata[];
  loginWallet?: WalletWithMetadata; // Wallet used for wallet-first login
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
  // Sort by firstVerifiedAt (most recent first) and transform wallet address to lowercase
  return customWallets
    .sort((a, b) => {
      const timeA = a.firstVerifiedAt
        ? new Date(a.firstVerifiedAt).getTime()
        : 0;
      const timeB = b.firstVerifiedAt
        ? new Date(b.firstVerifiedAt).getTime()
        : 0;
      return timeB - timeA;
    })
    .map((wallet) => ({
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
 * Extract comprehensive profile data from Privy user object.
 * Supports both email/social logins (with embedded wallet) and wallet-first logins.
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
  const embeddedWallet = getEmbeddedLinkedWallet(privyUser);
  const customWallets = getCustomLinkedWallets(privyUser);
  const privyId = privyUser.id;

  // For wallet-first users, use the most recent custom wallet
  let loginWallet: WalletWithMetadata | undefined;
  if (!embeddedWallet && customWallets.length > 0) {
    loginWallet = customWallets[0];
  }

  return {
    privyId,
    email,
    embeddedWallet,
    customWallets,
    loginWallet,
  };
}
