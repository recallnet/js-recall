import { NextFunction, Request, Response } from "express";
import { z } from "zod";

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
  return {
    async getBoostBalance(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUuid(req.userId);
        const competitionId = ensureUuid(req.params.competitionId);

        const result = await services.boostService.getUserBoostBalance(
          userId,
          competitionId,
        );

        if (result.isErr()) {
          next(result.error);
          return;
        } else {
          res.status(200).json({
            success: true,
            balance: result.value.toString(),
          });
        }
      } catch (error) {
        next(error);
      }
    },

    async agentBoostTotals(req: Request, res: Response, next: NextFunction) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);

        const result =
          await services.boostService.getAgentBoostTotals(competitionId);

        if (result.isErr()) {
          next(result.error);
        } else {
          res.status(200).json({
            success: true,
            boostTotals: Object.fromEntries(
              Object.entries(result.value).map(([key, value]) => [
                key,
                value.toString(),
              ]),
            ),
          });
        }
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

        const result = await services.boostService.getUserBoosts(
          userId,
          competitionId,
        );

        if (result.isErr()) {
          next(result.error);
        } else {
          res.status(200).json({
            success: true,
            boosts: Object.fromEntries(
              Object.entries(result.value).map(([key, value]) => [
                key,
                value.toString(),
              ]),
            ),
          });
        }
      } catch (error) {
        next(error);
      }
    },

    async boostAgent(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUuid(req.userId);
        const competitionId = ensureUuid(req.params.competitionId);
        const agentId = ensureUuid(req.params.agentId);
        const { amount, idemKey } = BoostAgentSchema.parse(req.body);

        const result = await services.boostService.boostAgent({
          userId,
          competitionId,
          agentId,
          amount,
          idemKey,
        });

        if (result.isErr()) {
          next(result.error);
        } else {
          res.status(200).json({
            success: true,
            agentTotal: result.value.agentBoostTotal.total.toString(),
          });
        }
      } catch (error) {
        next(error);
      }
    },
  };
}

export type BoostController = ReturnType<typeof makeBoostController>;
