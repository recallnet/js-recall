import { z } from "zod/v4";

import { UserService } from "@recallnet/services";
import {
  AdminAddBonusBoostSchema,
  AdminBonusBoostItemSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

type AdminBonusBoostItem = z.infer<typeof AdminBonusBoostItemSchema>;

async function validateItems(
  userService: UserService,
  boosts: AdminBonusBoostItem[],
  errors: { BAD_REQUEST: (ops: { message: string; data: unknown }) => Error },
) {
  // Step 1: Pre-validate all items before processing any
  const validationErrors = [];

  for (const [i, boostItem] of boosts.entries()) {
    // Check if user exists for each wallet
    try {
      const user = await userService.getUserByWalletAddress(boostItem.wallet);
      if (!user) {
        validationErrors.push({
          index: i,
          wallet: boostItem.wallet,
          error: `User with wallet ${boostItem.wallet} not found`,
        });
      }
    } catch (error) {
      validationErrors.push({
        index: i,
        wallet: boostItem.wallet,
        error:
          error instanceof Error ? error.message : "Failed to validate user",
      });
    }
  }

  // If any validation errors, reject entire batch
  if (validationErrors.length > 0) {
    throw errors.BAD_REQUEST({
      message: `Found ${validationErrors.length} validation error(s). No boosts were created.`,
      data: {
        errors: validationErrors,
      },
    });
  }
}

/**
 * Add bonus boost(s) for user(s)
 */
export const addBonusBoost = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminAddBonusBoostSchema)
  .route({
    method: "POST",
    path: "/admin/boost-bonus",
    summary: "Add bonus boost",
    description:
      "Add bonus boost(s) to user wallet(s) with expiration and metadata",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    const { boosts } = input;

    // Step 1: Pre-validate all items before processing any
    await validateItems(context.userService, boosts, errors);

    // Step 2: Process all boosts in a single transaction using batch method
    const results = await context.boostBonusService.addBoostBonusBatch(
      boosts.map((boostItem) => ({
        wallet: boostItem.wallet,
        amount: BigInt(boostItem.amount),
        expiresAt: boostItem.expiresAt,
        createdByAdminId: undefined, // could extract from auth if needed
        meta: boostItem.meta,
      })),
    );

    // Transform results to include index
    const batchResults = results.map((result, i) => ({
      index: i,
      appliedCount: result.appliedToCompetitions.length,
      ...result,
    }));

    return {
      success: true,
      data: {
        results: batchResults,
      },
    };
  });

export type AddBonusBoostType = typeof addBonusBoost;
