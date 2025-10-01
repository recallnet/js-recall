import type {
  LinkedAccountWithMetadata,
  PrivyClient,
} from "@privy-io/server-auth";
import { type JWTPayload, exportJWK, importSPKI, jwtVerify } from "jose";
import { type Hex, checksumAddress } from "viem";

import { SelectUser } from "@recallnet/db/schema/core/types";
import type { UserService } from "@recallnet/services";

import { config } from "@/config/index.js";
import { authLogger } from "@/lib/logger.js";

import { PRIVY_ISSUER, PrivyUserInfo, extractPrivyUserInfo } from "./utils.js";

/**
 * A raw Privy JWT payload.
 * - `cr`: Creation time
 * - `linked_accounts`: Linked accounts (google, wallet, etc.)
 * - `iss`: Issuer (privy.io)
 * - `iat`: Issued at time
 * - `aud`: Audience (Privy app ID)
 * - `sub`: Subject (Privy user DID)
 * - `exp`: Expiration time
 */
export type PrivyJwtPayload = JWTPayload & {
  cr: string;
  // Note: the raw payload includes a string of linked accounts (google, wallet, etc.) that must
  // be parsed—and these match the Privy SDK's `LinkedAccountWithMetadata` type.
  linked_accounts: LinkedAccountWithMetadata[];
};

/**
 * A Privy identity token with claims.
 * - `privyId`: The Privy user DID
 * - `claims`: Parsed Privy JWT payload
 */
export type PrivyIdWithClaims = {
  privyId: string;
  claims: PrivyJwtPayload;
};

/**
 * Create a Privy client instance
 * @returns PrivyClient instance (real or mock based on environment)
 */
async function createPrivyClient(): Promise<PrivyClient> {
  if (config.server.nodeEnv === "test") {
    // Use dynamic import for test mode
    const testModule = await import("./mock.js");
    authLogger.debug("[createPrivyClient] Using MockPrivyClient for testing");
    return new testModule.MockPrivyClient(
      config.privy.appId,
      config.privy.appSecret,
    ) as unknown as PrivyClient;
  }

  // Dynamic import for production
  const privyModule = await import("@privy-io/server-auth");
  return new privyModule.PrivyClient(
    config.privy.appId,
    config.privy.appSecret,
  );
}

/**
 * Parse the JWT payload to the Privy JWT payload, which includes a `linked_accounts` field
 * that is a string of JSON and must be converted to a Privy `LinkedAccountWithMetadata` array.
 * @param payload - The JWT payload to parse.
 * @returns The Privy JWT payload.
 */
export function parseJwtPayloadToPrivyTypes(
  payload: JWTPayload,
): PrivyJwtPayload {
  const parsedLinkedAccount = JSON.parse(
    payload.linked_accounts as string,
  ) as LinkedAccountWithMetadata[];
  return {
    cr: payload.cr as string,
    linked_accounts: parsedLinkedAccount,
    ...payload,
  };
}

/**
 * Verify Privy identity token.
 *
 * This function uses the Privy public key to verify the identity token
 * and returns the payload if the token is valid. It can be used to verify
 * a Privy identity token without using the Privy SDK's `getUser` method.
 *
 * @param idToken - The Privy identity token to verify.
 * @returns The payload of the identity token as well as the JWT payload (which includes the
 * externally linked accounts that a user has linked to their Privy account).
 */
export async function verifyPrivyIdentityToken(
  idToken: string,
): Promise<PrivyIdWithClaims> {
  const matches = config.privy.jwksPublicKey.match(/.{1,64}/g);
  if (!matches) {
    throw new Error("Invalid JWKS public key format");
  }
  const pem = `-----BEGIN PUBLIC KEY-----
${matches.join("\n")}
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
    const finalPayload = parseJwtPayloadToPrivyTypes(payload);
    return { privyId: payload.sub, claims: finalPayload };
  } catch (error) {
    authLogger.error(
      `Privy identity token verification failed: ${JSON.stringify(error)}`,
    );
    throw new Error("Authentication failed");
  }
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
  const client = await createPrivyClient();
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
 * In all cases, we do not update the `walletAddress` and handle this through explicit UI actions,
 * which ensures custom wallets don't hit flakiness with mismatched wallet addresses.
 *
 * @param identityToken - The Privy identity token to verify.
 * @param userManager - The user manager to use to create or update users.
 * @returns The user object.
 */
export async function verifyPrivyIdentityTokenAndUpdateUser(
  idToken: string,
  userService: UserService,
): Promise<SelectUser> {
  // Note: in the future, we can simply use `verifyIdentityToken` to get the `privyId`, which is
  // stored in the `users` table as `privyID`. But, since we need to account for legacy users, we
  // must refetch user information from the Privy API and update are database accordingly.
  const { privyId, name, email, embeddedWallet, customWallets } =
    await verifyAndGetPrivyUserInfo(idToken);
  const embeddedWalletAddress = embeddedWallet.address;
  const now = new Date();

  // 1. Handle post-Privy migration users
  const existingUserWithPrivyId = await userService.getUserByPrivyId(privyId);
  if (existingUserWithPrivyId) {
    return await userService.updateUser({
      id: existingUserWithPrivyId.id,
      lastLoginAt: now,
    });
  }

  // 2. Handle post-legacy but pre-Privy users (an `email` always exists via legacy Loops emails)
  // Note: we skip the explicit email branch and rely on repository UPSERT (email idempotency)
  // in `registerUser` (called in the fallback below) to handle this case.

  // 3. Handle legacy users (only a `walletAddress` exists, but it might not be connected to Privy)
  // This is an edge case where a user never logged in nor set up an email, so our best guess is to
  // use the "latest" connected wallet as the primary wallet address and see if the user exists.
  const customWalletAddress = customWallets.sort(
    (a, b) =>
      (b.latestVerifiedAt?.getTime() ?? 0) -
      (a.latestVerifiedAt?.getTime() ?? 0),
  )[0]?.address;
  if (customWalletAddress) {
    const existingUserWithWallet =
      await userService.getUserByWalletAddress(customWalletAddress);
    if (existingUserWithWallet) {
      return await userService.updateUser({
        id: existingUserWithWallet.id,
        name: existingUserWithWallet.name ?? name,
        email,
        privyId,
        embeddedWalletAddress,
        lastLoginAt: now,
      });
    }
  }

  // 4. Create completely new user, using the embedded wallet address as the primary wallet address
  return await userService.registerUser(
    embeddedWalletAddress,
    name,
    email,
    undefined,
    undefined,
    privyId,
    embeddedWalletAddress,
  );
}

/**
 * Verify a custom linked wallet address is properly linked by the user in Privy.
 * @param idToken - The Privy identity token to verify.
 * @param walletAddress - The wallet address to verify.
 * @returns The custom linked wallet.
 * @throws {Error} If the custom linked wallet is not found.
 */
export async function verifyPrivyUserHasLinkedWallet(
  idToken: string,
  walletAddress: string,
): Promise<boolean> {
  const { customWallets } = await verifyAndGetPrivyUserInfo(idToken);
  const checksummedWalletAddress = checksumAddress(walletAddress as Hex);
  const customWallet = customWallets.find(
    (wallet) =>
      checksumAddress(wallet.address as Hex) === checksummedWalletAddress,
  );
  if (!customWallet) {
    return false;
  }
  return true;
}
