import { Request } from "express";

import { UpdateCompetitionSchema } from "@/database/schema/core/types.js";
import { ApiError } from "@/middleware/errorHandler.js";
import {
  AgentCompetitionsParamsSchema,
  CompetitionAllowedUpdateSchema,
  PagingParamsSchema,
  UuidSchema,
} from "@/types/index.js";

export function ensureUserId(req: Request) {
  if (!req.userId) {
    throw new ApiError(400, "must be authenticated as a user");
  }
  return req.userId;
}

export function ensureUuid(uuid: string | undefined) {
  const { success, data: id } = UuidSchema.safeParse(uuid);
  if (!success) {
    throw new ApiError(400, "Invalid UUID");
  }

  return id;
}

export function ensurePaging(req: Request) {
  const { success, data, error } = PagingParamsSchema.safeParse(req.query);
  if (!success) {
    throw new ApiError(400, `Invalid pagination parameters: ${error.message}`);
  }

  return data;
}
export function ensureAgentCompetitionFilters(req: Request) {
  const { success, data } = AgentCompetitionsParamsSchema.safeParse(req.query);
  if (!success) {
    throw new ApiError(400, "Invalid sort filter page params");
  }

  return data;
}

export function ensureCompetitionUpdate(req: Request) {
  const { success, data } = UpdateCompetitionSchema.safeParse(req.body);
  if (!success) {
    throw new ApiError(400, "Invalid competition update request body");
  }

  const { success: allowed } = CompetitionAllowedUpdateSchema.safeParse(data);
  if (!allowed) {
    throw new ApiError(
      403,
      "Invalid competition update, attempting to update forbidden field",
    );
  }

  return data;
}
