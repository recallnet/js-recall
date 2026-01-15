import { AdminResetPrivyUserSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

export interface ResetResult {
  identifier: string;
  success: boolean;
  error?: string;
}

/**
 * Reset Privy user data and delete from Privy
 *
 * This admin endpoint accepts either an array of emails or wallet addresses,
 * finds the corresponding users, resets their Privy-related fields in the database,
 * and deletes them from Privy.
 *
 * Operations are atomic per-user: if Privy deletion fails, DB is not updated for that user.
 */
export const resetPrivyUser = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminResetPrivyUserSchema)
  .route({
    method: "POST",
    path: "/admin/reset-privy-user",
    summary: "Reset Privy user data",
    description:
      "Reset user Privy-related fields and delete from Privy. Accepts either emails or wallet addresses.",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    const { emails, wallets } = input;
    const results: ResetResult[] = [];
    let resetCount = 0;

    // Determine which identifiers to process
    const identifiers = emails ?? wallets ?? [];
    const lookupByEmail = !!emails;

    for (const identifier of identifiers) {
      try {
        // Find user by email or wallet
        const user = lookupByEmail
          ? await context.userService.getUserByEmail(identifier)
          : await context.userService.getUserByWalletAddress(identifier);

        if (!user) {
          results.push({
            identifier,
            success: false,
            error: "User not found",
          });
          continue;
        }

        // If user has a Privy ID, delete from Privy first
        if (user.privyId) {
          try {
            await context.privyClient.deleteUser(user.privyId);
          } catch (privyError) {
            const errorMessage =
              privyError instanceof Error
                ? privyError.message
                : "Unknown Privy error";
            results.push({
              identifier,
              success: false,
              error: `Privy deletion failed: ${errorMessage}`,
            });
            continue;
          }
        }

        // Update DB to reset Privy-related fields
        await context.userService.updateUser({
          id: user.id,
          email: null,
          privyId: null,
          embeddedWalletAddress: null,
          walletLastVerifiedAt: null,
        });

        results.push({
          identifier,
          success: true,
        });
        resetCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          identifier,
          success: false,
          error: errorMessage,
        });
      }
    }

    // Check if all failed
    if (resetCount === 0 && identifiers.length > 0) {
      throw errors.BAD_REQUEST({
        message: "No users were reset",
        cause: results,
      });
    }

    return {
      success: true,
      resetCount,
      totalRequested: identifiers.length,
      results,
    };
  });

export type ResetPrivyUserType = typeof resetPrivyUser;
