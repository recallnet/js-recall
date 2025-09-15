import { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { db } from "@/database/db.js";
import { BoostRepository } from "@/database/repositories/boost.repository.js";
import { ApiError } from "@/middleware/errorHandler.js";
import ServiceRegistry from "@/services/index.js";

import { ensureUuid } from "./request-helpers.js";

const BoostAgentSchema = z.object({
  amount: z.coerce.bigint(),
  idemKey: z
    .string()
    .refine(
      (val) => {
        // Basic base64 validation: must be a valid base64 string
        try {
          // Decode and check for errors
          Buffer.from(val, "base64");
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid base64 string" },
    )
    .transform((val) => Buffer.from(val, "base64")),
});

export function makeBoostController(services: ServiceRegistry) {
  const boostRepository = new BoostRepository(db);
  return {
    async getBoostBalance(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUuid(req.userId);
        const competitionId = ensureUuid(req.params.competitionId);

        // Get the user using the service
        const user = await services.userManager.getUser(userId);

        if (!user) {
          throw new ApiError(404, "User not found");
        }

        const balance = await boostRepository.userBoostBalance({
          userId: user.id,
          competitionId,
        });

        res.status(200).json({
          success: true,
          balance: balance.toString(),
        });
      } catch (error) {
        next(error);
      }
    },

    async agentBoostTotals(req: Request, res: Response, next: NextFunction) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);

        const boosts = await boostRepository.agentBoostTotals({
          competitionId,
        });

        res.status(200).json({
          success: true,
          boostTotals: Object.fromEntries(
            Object.entries(boosts).map(([key, value]) => [
              key,
              value.toString(),
            ]),
          ),
        });
      } catch (error) {
        next(error);
      }
    },

    async boostsForCompetition(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const userId = ensureUuid(req.userId);
        const competitionId = ensureUuid(req.params.competitionId);

        const boosts = await boostRepository.userBoosts({
          userId,
          competitionId,
        });

        res.status(200).json({
          success: true,
          boosts: Object.fromEntries(
            Object.entries(boosts).map(([key, value]) => [
              key,
              value.toString(),
            ]),
          ),
        });
      } catch (error) {
        next(error);
      }
    },

    async boostAgent(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUuid(req.userId);
        const competitionId = ensureUuid(req.params.competitionId);

        const user = await services.userManager.getUser(userId);

        if (!user) {
          throw new ApiError(404, "User not found");
        }

        const agentId = ensureUuid(req.params.agentId);

        const { amount, idemKey } = BoostAgentSchema.parse(req.body);

        const competition =
          await services.competitionManager.getCompetition(competitionId);

        if (!competition) {
          throw new ApiError(404, "No competition found.");
        }

        if (
          competition.votingStartDate == null ||
          competition.votingEndDate == null
        ) {
          throw new ApiError(
            500,
            "Can't boost in a competition with no defined boost start date or end date.",
          );
        }

        const now = new Date();
        if (
          !(
            competition.votingStartDate < now && now < competition.votingEndDate
          )
        ) {
          throw new ApiError(
            400,
            "Can't boost in a competition outside of the boost time window.",
          );
        }

        const result = await boostRepository.boostAgent({
          userId,
          wallet: user.walletAddress,
          agentId,
          competitionId,
          amount,
          idemKey,
        });

        res.status(200).json({
          success: true,
          agentTotal: result.agentBoostTotal.total.toString(),
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type BoostController = ReturnType<typeof makeBoostController>;
