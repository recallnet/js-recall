import { IronSession } from "iron-session";
import { SiweMessage, generateNonce } from "siwe";

import {
  createUserFromWallet,
  findByWalletAddress as findUserByWalletAddress,
} from "@/database/repositories/user-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { LoginResponse, SessionData } from "@/types/index.js";

/**
 * Authentication Service
 * Handles SIWE authentication for users with wallet-based login
 */
export class AuthService {
  /**
   * Generate a new nonce for SIWE authentication
   * @returns A new nonce string
   */
  async getNonce(): Promise<string> {
    const nonce = generateNonce();
    // TODO: we can consider Redis or storing in the database (with expiration)
    return nonce;
  }

  /**
   * Authenticate a user with SIWE (Sign-In with Ethereum)
   * @param params Login parameters including message, signature, and session
   * @returns Login response with success status and user info
   */
  async login(params: {
    message: string;
    signature: string;
    session: IronSession<SessionData>;
  }): Promise<LoginResponse> {
    const { message, signature, session } = params;

    try {
      const siweMessage = new SiweMessage(message);
      const { data: siweData, success: siweSuccess } = await siweMessage.verify(
        {
          signature,
          nonce: session.nonce,
        },
        { suppressExceptions: true },
      );

      if (!siweSuccess) {
        session.nonce = undefined;
        await session.save();
        return { success: false };
      }

      session.nonce = undefined;

      // Attempt to find the user that matches the verified wallet address
      const wallet = siweData.address;
      let user = await findUserByWalletAddress(wallet);
      let userId = user?.id;

      if (!user) {
        serviceLogger.debug(
          `[AuthService] No user found for wallet ${wallet}. Creating new user.`,
        );
        user = await createUserFromWallet(wallet);
        userId = user.id;
        serviceLogger.debug(
          `[AuthService] New user ${userId} created for wallet ${wallet}`,
        );
      }

      // Store session data
      session.siwe = siweData;
      session.userId = userId;
      session.wallet = wallet;
      await session.save();

      serviceLogger.debug(
        `[AuthService] User login successful for wallet: ${wallet}, userId: ${userId}`,
      );

      return {
        success: true,
        userId,
        wallet,
      };
    } catch (error) {
      serviceLogger.error(
        "[AuthService] Error during SIWE verification process:",
        error,
      );

      // Clear session on error
      session.nonce = undefined;
      session.siwe = undefined;
      session.userId = undefined;
      session.wallet = undefined;
      await session.save();

      return { success: false };
    }
  }

  /**
   * Log out a user by clearing their session
   * @param session The user's session to clear
   */
  async logout(session: IronSession<SessionData>): Promise<void> {
    session.nonce = undefined;
    session.siwe = undefined;
    session.userId = undefined;
    session.agentId = undefined;
    session.adminId = undefined;
    session.wallet = undefined;
    await session.save();
    session.destroy();

    serviceLogger.debug("[AuthService] User logged out successfully");
  }
}
