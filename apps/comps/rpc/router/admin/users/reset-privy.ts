import { AdminResetPrivyUserSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Reset Privy user data and delete from Privy
 *
 * This admin endpoint accepts either an array of emails or wallet addresses,
 * finds the corresponding users, resets their Privy-related fields in the database,
 * and deletes them from Privy.
 *
 * Note on atomicity: If Privy deletion fails, the DB is not updated for that user.
 * However, if Privy deletion succeeds but the DB update fails, the user will be
 * deleted from Privy but the DB will retain stale data. This edge case is logged
 * for manual recovery if needed.
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
  .handler(async ({ input, context }) => {
    const { emails, wallets } = input;
    const results: Array<
      | { identifier: string; success: true }
      | { identifier: string; success: false; error: string }
    > = [];
    let resetCount = 0;

    // Determine which identifiers to process
    const identifiers = emails ?? wallets ?? [];
    const lookupByEmail = !!emails;

    context.logger.info(
      { identifierCount: identifiers.length, lookupByEmail },
      "Starting Privy user reset operation",
    );

    for (const identifier of identifiers) {
      // Track whether Privy deletion succeeded for this user (for error context)
      let privyDeleted = false;

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
            privyDeleted = true;
          } catch (privyError) {
            const errorMessage =
              privyError instanceof Error
                ? privyError.message
                : "Unknown Privy error";
            context.logger.error(
              {
                error: privyError,
                userId: user.id,
                privyId: user.privyId,
                identifier,
              },
              "Failed to delete user from Privy",
            );
            results.push({
              identifier,
              success: false,
              error: `Privy deletion failed: ${errorMessage}`,
            });
            continue;
          }
        }

        // Update DB to reset Privy-related fields
        try {
          await context.userService.updateUser({
            id: user.id,
            email: null,
            privyId: null,
            embeddedWalletAddress: null,
            walletLastVerifiedAt: null,
          });
        } catch (dbError) {
          // Critical: Privy deletion may have succeeded but DB update failed
          context.logger.error(
            {
              error: dbError,
              userId: user.id,
              identifier,
              privyDeleted,
              privyId: user.privyId,
            },
            privyDeleted
              ? "CRITICAL: Database update failed after Privy deletion - inconsistent state"
              : "Database update failed",
          );
          const errorMessage =
            dbError instanceof Error ? dbError.message : "Unknown error";
          results.push({
            identifier,
            success: false,
            error: privyDeleted
              ? `Database update failed after Privy deletion: ${errorMessage}`
              : `Database update failed: ${errorMessage}`,
          });
          continue;
        }

        results.push({
          identifier,
          success: true,
        });
        resetCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        context.logger.error(
          { error, identifier, lookupByEmail },
          "Unexpected error during Privy user reset",
        );
        results.push({
          identifier,
          success: false,
          error: errorMessage,
        });
      }
    }

    context.logger.info(
      { resetCount, totalRequested: identifiers.length },
      "Completed Privy user reset operation",
    );

    return {
      success: true,
      resetCount,
      totalRequested: identifiers.length,
      results,
    };
  });

export type ResetPrivyUserType = typeof resetPrivyUser;
