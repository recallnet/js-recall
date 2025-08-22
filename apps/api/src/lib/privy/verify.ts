import type { PrivyClient } from "@privy-io/server-auth";
import { exportJWK, importSPKI, jwtVerify } from "jose";

import { config } from "@/config/index.js";
import { SelectUser } from "@/database/schema/core/types.js";
import { authLogger } from "@/lib/logger.js";
import type { UserManager } from "@/services/user-manager.service.js";

import { PRIVY_ISSUER, PrivyUserInfo, extractPrivyUserInfo } from "./utils.js";

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
  const embeddedWalletAddress = embeddedWallet.address;
  const now = new Date();

  // Note: generally speaking, we *could* allow for multiple linked wallets, but our current Privy
  // configuration enforces maximum 1 linked wallet per account; hence, we can safely assume the
  // first value is the "primary" linked wallet.
  const customWalletAddress = customWallets[0]?.address;

  // 1. Handle post-Privy migration users
  const existingUserWithPrivyId = await userManager.getUserByPrivyId(privyId);
  if (existingUserWithPrivyId) {
    return await userManager.updateUser({
      id: existingUserWithPrivyId.id,
      lastLoginAt: now,
    });
  }

  // 2. Handle post-legacy but pre-Privy users (an `email` always exists via legacy Loops emails)
  const existingUserWithEmail = await userManager.getUserByEmail(email);
  if (existingUserWithEmail) {
    return await userManager.updateUser({
      id: existingUserWithEmail.id,
      privyId,
      name: existingUserWithEmail.name ?? name,
      embeddedWalletAddress,
      updatedAt: now,
      lastLoginAt: now,
    });
  }

  // 3. Handle legacy users (only a `walletAddress` exists, but it might not be connected to Privy)
  if (customWalletAddress) {
    const existingUserWithWallet =
      await userManager.getUserByWalletAddress(customWalletAddress);
    if (existingUserWithWallet) {
      return await userManager.updateUser({
        id: existingUserWithWallet.id,
        name: existingUserWithWallet.name ?? name,
        email,
        privyId,
        embeddedWalletAddress,
        updatedAt: now,
        lastLoginAt: now,
      });
    }
  }

  // 4. Create completely new user, using the embedded wallet address as the primary wallet address
  return await userManager.registerUser(
    embeddedWalletAddress,
    name,
    email,
    undefined,
    undefined,
    privyId,
    embeddedWalletAddress,
  );
}
