import {
  LinkedAccountWithMetadata,
  PrivyClient,
  User as PrivyUser,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { IncomingHttpHeaders } from "http";
import { exportJWK, importSPKI, jwtVerify } from "jose";
import { v4 as uuidv4 } from "uuid";

import { config } from "@/config/index.js";
import { create } from "@/database/repositories/user-repository.js";
import { SelectUser } from "@/database/schema/core/types.js";
import type { UserManager } from "@/services/user-manager.service.js";

import { authLogger } from "./logger.js";

const PRIVY_ISSUER = "privy.io";

/**
 * A subset of user profile data extracted from Privy user object that matches our database schema,
 * and guaranteed to be present in the Privy user object or through parsing logic.
 */
type PrivyUserInfo = {
  privyId: string;
  name: string;
  email: string;
  embeddedWallet: Omit<WalletWithMetadata, "type">;
  customWallets: WalletWithMetadata[];
};

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
 * Verify Privy identity token.
 *
 * This function uses the Privy public key to verify the identity token
 * and returns the payload if the token is valid. It can be used to verify
 * a Privy identity token without using the Privy SDK's `getUser` method, which
 * makes an external API call to Privy upon successful verification.
 *
 * @param idToken - The Privy identity token to verify.
 * @returns The payload of the identity token.
 */
export async function verifyPrivyIdentityToken(
  idToken: string,
): Promise<{ privyId: string }> {
  const pem = `-----BEGIN PUBLIC KEY-----
${config.privy.jwksPublicKey.match(/.{1,64}/g)!.join("\n")}
-----END PUBLIC KEY-----`;
  const key = await importSPKI(pem, "ES256");
  const jwk = await exportJWK(key);

  try {
    const { payload } = await jwtVerify(idToken, jwk, {
      issuer: PRIVY_ISSUER,
      audience: config.privy.appId,
    });
    if (!payload.sub) {
      throw new Error(
        "Privy identity token verification failed: missing subject",
      );
    }
    return { privyId: payload.sub };
  } catch (error) {
    authLogger.error("Privy identity token verification failed:", error);
    throw new Error("Authentication failed");
  }
}

/**
 * Check if a Privy user is set up with a custom linked wallet. Custom linked wallets are linked
 * accounts with a wallet client type that is not "privy" (i.e., not an embedded wallet).
 * @param wallet - The linked account to check.
 * @returns True if the linked account is a custom linked wallet, false otherwise. If the user is not
 * set up with a custom linked wallet, returns false.
 */
function isCustomLinkedWallet(
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
function isEmbeddedLinkedWallet(
  wallet: LinkedAccountWithMetadata,
): wallet is WalletWithMetadata {
  return wallet.type === "wallet" && wallet.walletClientType === "privy";
}

/**
 * Get the custom linked wallet from a Privy user.
 * @param privyUser - The Privy user to get the custom linked wallet from.
 * @returns The custom linked wallet, or undefined if no custom linked wallet is found.
 */
function getCustomLinkedWallets(privyUser: PrivyUser): WalletWithMetadata[] {
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
function getEmbeddedLinkedWallet(
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
function extractUsernameFromEmail(email: string): string {
  const username = email.split("@")[0];
  if (!username) {
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
  authLogger.debug(
    `User ${privyId} has embedded wallet address: ${embeddedWallet.address}; custom wallet address: ${customWallets?.map((wallet) => wallet.address).join(", ")}`,
  );

  // Check if Google or GitHub are provided, and if so, override the user's email-derived name
  const name =
    privyUser.github?.name ??
    privyUser.google?.name ??
    extractUsernameFromEmail(email);

  return {
    privyId,
    name,
    email,
    embeddedWallet,
    customWallets,
  };
}

/**
 * Get a subset of Privy user information from an identity access token. Note: this uses the Privy
 * SDK's `getUser` method, which will first verify the identity token (locally) and then fetch user
 * data from Privy.
 * @param idToken - The Privy identity token to verify.
 * @returns The user profile data.
 */
export async function verifyAndGetPrivyUserInfo(
  idToken: string,
): Promise<PrivyUserInfo> {
  const client = new PrivyClient(config.privy.appId, config.privy.appSecret);
  const user = await client.getUser({ idToken: idToken });
  return extractPrivyUserInfo(user);
}

/**
 * Verify Privy identity token and create user if needed (used during login)
 * This function uses Privy's getUser method for proper identity token verification
 * and combines it with automatic user creation using data from Privy.
 *
 * Note: we need to make these checks for connected users:
 * 1. For "ultra legacy" users, we can only guarantee a `walletAddress`. Email may not exist
 *    since we implemented custom email verification sometime after launch, but before Privy.
 * 2. For post-legacy but pre-Privy users, we can only guarantee a `walletAddress` and `email`,
 *    but not an `embeddedWalletAddress`.
 * 3. For post-Privy users, we can guarantee an `email` and `embeddedWalletAddress`,
 *    but not a `walletAddress` (i.e., a user may not have a custom linked wallet).
 * 4. i.e., we need to check the three cases above and update the user accordingly, else, we
 *    fallback to creating a brand new user.
 *
 * In all cases, we do not update the `walletAddress` and handle this through explicity UI actions,
 * which ensures custom wallets don't hit flakiness with mismatched wallet addresses.
 *
 * @param identityToken - The Privy identity token to verify.
 * @param userManager - The user manager to use to create or update users.
 * @returns The user object.
 */
export async function verifyPrivyIdentityTokenAndEnsureUser(
  idToken: string,
  userManager: UserManager,
): Promise<SelectUser> {
  // Note: in the future, we can simply use `verifyIdentityToken` to get the `privyId`, which is
  // stored in the `users` table as `privyID`. But, since we need to account for legacy users, we
  // must refetch user information from the Privy API and update are database accordingly.
  const { privyId, name, email, embeddedWallet, customWallets } =
    await verifyAndGetPrivyUserInfo(idToken);
  const now = new Date();

  // Note: generally speaking, we *could* allow for multiple linked wallets, but our current Privy
  // configuration enforces maximum 1 linked wallet per account; hence, we can safely assume the
  // first value is the "primary" linked wallet.
  const customWallet = customWallets[0];

  // 1. Handle post-Privy migration users
  const existingUserWithPrivyId = await userManager.getUserByPrivyId(privyId);
  if (existingUserWithPrivyId) {
    authLogger.debug(`Found existing user with Privy ID: ${privyId}`);
    return await userManager.updateUser({
      id: existingUserWithPrivyId.id,
      lastLoginAt: now,
    });
  }

  // 2. Handle post-legacy but pre-Privy users (an `email` always exists via legacy Loops emails)
  const existingUserWithEmail = await userManager.getUserByEmail(email);
  if (existingUserWithEmail) {
    authLogger.debug(
      `Migrating existing email user ID: ${existingUserWithEmail.id} with new wallet ${customWallet?.address}`,
    );
    return await userManager.updateUser({
      id: existingUserWithEmail.id,
      privyId,
      name: existingUserWithEmail.name ?? name,
      embeddedWalletAddress: embeddedWallet.address,
      updatedAt: now,
      lastLoginAt: now,
    });
  }

  // 3. Handle legacy users (only a `walletAddress` exists, but it might not be connected to Privy)
  if (customWallet?.address) {
    const existingUserWithWallet = await userManager.getUserByWalletAddress(
      customWallet.address,
    );
    if (existingUserWithWallet) {
      authLogger.debug(
        `Found existing wallet user ID: ${existingUserWithWallet.id} with wallet ${customWallet.address}`,
      );
      return await userManager.updateUser({
        id: existingUserWithWallet.id,
        name: existingUserWithWallet.name ?? name,
        email,
        privyId,
        embeddedWalletAddress: embeddedWallet.address,
        updatedAt: now,
        lastLoginAt: now,
      });
    }
  }

  // 4. Create completely new user, using the embedded wallet address as the primary wallet address
  const userId = uuidv4();
  authLogger.debug(`Creating new user '${userId}' for Privy ID: ${privyId}`);
  return await create({
    id: userId,
    privyId,
    name: name,
    email: email,
    walletAddress: embeddedWallet.address,
    walletLastVerifiedAt: now, // Note: we only track this for the `walletAddress` column
    embeddedWalletAddress: embeddedWallet.address,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  });
}
