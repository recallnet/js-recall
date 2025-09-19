import {
  LinkedAccountWithMetadata,
  PrivyClient,
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { NextRequest } from "next/server";

/**
 * A Privy user with their connected accounts.
 */
interface PrivyUserWithAccounts {
  privyId: string;
  email: string;
  walletAddress: string;
  embeddedWalletAddress: string;
}

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
 * Extract Privy token from request headers cookies.
 *
 * The `privy-id-token` cookie is set by Privy when a user is authenticated.
 * It is a JWT token that contains the user's identity and authentication information.
 * We need to extract the token from the cookie header.
 *
 * @param request - The request object to extract the token from.
 * @returns The Privy identity token.
 */
export function extractPrivyIdentityToken(
  request: NextRequest,
): string | undefined {
  return request.headers
    ?.get("cookie")
    ?.split("; ")
    .find((c: string) => c.startsWith("privy-id-token="))
    ?.split("=")[1];
}

/**
 * Extracts a Privy user from a cookie
 * @param request - The request object to extract the user from.
 * @returns The Privy user.
 */
export async function getPrivyUserFromCookie(
  request: NextRequest,
): Promise<PrivyUserWithAccounts | undefined> {
  const privyIdToken = extractPrivyIdentityToken(request);
  if (!privyIdToken) {
    return undefined;
  }
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET is not set");
  }
  const privyClient = new PrivyClient(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET,
  );
  const user = await privyClient.getUser({ idToken: privyIdToken });
  // Only Google SSO or direct to email login are currently supported
  const email = user.google?.email ?? user.email?.address;
  if (!email) {
    // Note: this should never happen since email is required for login
    throw new Error("No email found");
  }
  return {
    privyId: user.id,
    email: email,
    walletAddress: getWalletsForUser(user).walletAddress,
    embeddedWalletAddress: getWalletsForUser(user).embeddedWalletAddress,
  };
}

/**
 * Extracts the wallet address and embedded wallet address from a Privy user object
 * @param privyUser - The Privy user object
 * @returns The wallet address and embedded wallet address
 */
export function getWalletsForUser(privyUser: PrivyUser): {
  walletAddress: string;
  embeddedWalletAddress: string;
} {
  const embeddedWalletAddress = privyUser.linkedAccounts.find(
    isEmbeddedLinkedWallet,
  )?.address;
  if (!embeddedWalletAddress) {
    // Note: this should never happen since embedded wallets are guaranteed
    throw new Error("No embedded wallet found");
  }
  // If there is no custom linked wallet, use the embedded wallet address (this matches how the
  // main backend API works).
  const walletAddress =
    privyUser.linkedAccounts.find(isCustomLinkedWallet)?.address ??
    embeddedWalletAddress;
  return { walletAddress, embeddedWalletAddress };
}
