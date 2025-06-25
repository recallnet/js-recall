import axios from "axios";

import { config } from "@/config/index.js";
import { findById as findAgentById } from "@/database/repositories/agent-repository.js";
import {
  findEmailVerificationTokenByToken,
  markTokenAsUsed,
} from "@/database/repositories/email-verification-repository.js";
import { findById as findUserById } from "@/database/repositories/user-repository.js";
import { AgentManager } from "@/services/agent-manager.service.js";
import { UserManager } from "@/services/user-manager.service.js";

type Result<Ok, Err> =
  | { success: true; value: Ok }
  | { success: false; error: Err };

/**
 * Domain-specific error types for email verification
 */
type VerifyEmailError =
  | { type: "InvalidToken"; token: string }
  | { type: "TokenHasBeenUsed"; token: string }
  | { type: "TokenHasExpired"; token: string }
  | { type: "NoAssociation"; token: string }
  | { type: "SystemError"; message: string; originalError?: unknown };

/**
 * Email Verification Service
 * Handles email verification token creation and validation
 */
export class EmailVerificationService {
  private userManager: UserManager;
  private agentManager: AgentManager;

  constructor() {
    this.userManager = new UserManager();
    this.agentManager = new AgentManager();
  }

  /**
   * Verify an email verification token
   * @param token The token to verify
   * @returns Result object with verification outcome or specific error
   */
  async verifyToken(
    token: string,
  ): Promise<
    Result<
      { message: string; userId?: string; agentId?: string },
      VerifyEmailError
    >
  > {
    try {
      const tokenRecord = await findEmailVerificationTokenByToken(token);
      if (!tokenRecord) {
        return {
          success: false,
          error: {
            type: "InvalidToken",
            token,
          },
        };
      }

      if (tokenRecord.used) {
        return {
          success: false,
          error: {
            type: "TokenHasBeenUsed",
            token,
          },
        };
      }

      if (new Date() > tokenRecord.expiresAt) {
        return {
          success: false,
          error: {
            type: "TokenHasExpired",
            token,
          },
        };
      }

      await markTokenAsUsed(tokenRecord.id);

      // Check if it's associated with user
      if (tokenRecord.userId) {
        const user = await findUserById(tokenRecord.userId);
        await this.userManager.markEmailAsVerified(tokenRecord.userId);

        // Update Loops with "Verified" userGroup if user exists
        if (user && user.email && user.name) {
          await this.updateLoopsWithVerifiedStatus(user.email, user.name);
        }

        return {
          success: true,
          value: {
            message: "Email verified successfully for user",
            userId: tokenRecord.userId,
          },
        };
      }

      // Check if it's associated with agent
      if (tokenRecord.agentId) {
        const agent = await findAgentById(tokenRecord.agentId);
        await this.agentManager.markEmailAsVerified(tokenRecord.agentId);

        // Update Loops with "Verified" userGroup if agent exists
        if (agent && agent.email && agent.name) {
          await this.updateLoopsWithVerifiedStatus(agent.email, agent.name);
        }

        return {
          success: true,
          value: {
            message: "Email verified successfully for agent",
            agentId: tokenRecord.agentId,
          },
        };
      }

      return {
        success: false,
        error: {
          type: "NoAssociation",
          token,
        },
      };
    } catch (error) {
      console.error("[EmailVerificationService] Error verifying token:", error);
      return {
        success: false,
        error: {
          type: "SystemError",
          message: "Error verifying token",
          originalError: error,
        },
      };
    }
  }

  /**
   * Update Loops with "Verified" userGroup status
   * @param email The email address to update
   * @param name The name to update
   * @returns Promise resolving to the API response, or null if API key is missing
   */
  private async updateLoopsWithVerifiedStatus(
    email: string,
    name: string,
  ): Promise<void> {
    try {
      // Get the Loops API key from environment variables
      const loopsApiKey = config.email.apiKey;
      if (!loopsApiKey) {
        console.error(
          "[EmailVerificationService] Missing LOOPS_API_KEY in environment variables",
        );
        return;
      }

      // Prepare the payload for Loops API
      const loopsPayload = {
        email: email,
        firstName: name,
        userGroup: "Verified",
      };

      // Send request to Loops API
      const response = await axios.put(
        "https://app.loops.so/api/v1/contacts/update",
        loopsPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${loopsApiKey}`,
          },
        },
      );

      if (response.status !== 200) {
        console.error(
          "[EmailVerificationService] Loops API error:",
          response.data,
        );
      } else {
        console.log(
          `[EmailVerificationService] Successfully updated Loops with Verified status for ${email}`,
        );
      }
    } catch (error) {
      console.error("[EmailVerificationService] Error updating Loops:", error);
      // Don't throw error to prevent blocking the verification flow
    }
  }
}
