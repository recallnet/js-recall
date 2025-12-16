import type {
  LinkedAccountWithMetadata,
  PrivyClient,
} from "@privy-io/server-auth";
import { type JWTPayload, exportJWK, importSPKI, jwtVerify } from "jose";
import type { Logger } from "pino";

import {
  PRIVY_ISSUER,
  PrivyUserInfo,
  extractPrivyUserInfo,
} from "./privy-utils.js";

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
 * @param jwksPublicKey - The Privy JWKS public key for verification.
 * @param appId - The Privy app ID for audience verification.
 * @param logger - Optional logger for error logging.
 * @returns The payload of the identity token as well as the JWT payload (which includes the
 * externally linked accounts that a user has linked to their Privy account).
 */
export async function verifyPrivyIdentityToken(
  idToken: string,
  jwksPublicKey: string,
  appId: string,
  logger?: Logger,
): Promise<PrivyIdWithClaims> {
  const matches = jwksPublicKey.match(/.{1,64}/g);
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
      audience: appId,
    });
    if (!payload.sub) {
      throw new Error(
        "Privy identity token verification failed: missing subject",
      );
    }
    const finalPayload = parseJwtPayloadToPrivyTypes(payload);
    return { privyId: payload.sub, claims: finalPayload };
  } catch (error) {
    logger?.error(
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
 * @param privyClient - The Privy client instance to use for user lookup.
 * @returns The user profile data.
 */
export async function verifyAndGetPrivyUserInfo(
  idToken: string,
  privyClient: PrivyClient,
): Promise<PrivyUserInfo> {
  const user = await privyClient.getUser({ idToken: idToken });
  return extractPrivyUserInfo(user);
}

/**
 * Verify a custom linked wallet address is properly linked by the user in Privy.
 * @param idToken - The Privy identity token to verify.
 * @param privyClient - The Privy client instance to use for user lookup.
 * @param walletAddress - The wallet address to verify.
 * @returns True if the wallet is linked, false otherwise.
 */
export async function verifyPrivyUserHasLinkedWallet(
  idToken: string,
  privyClient: PrivyClient,
  walletAddress: string,
): Promise<boolean> {
  const { customWallets } = await verifyAndGetPrivyUserInfo(
    idToken,
    privyClient,
  );
  const customWallet = customWallets.find(
    (wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase(),
  );
  if (!customWallet) {
    return false;
  }
  return true;
}
