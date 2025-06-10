import { Request } from "express";

import { ApiError } from "@/middleware/errorHandler.js";
import { PagingParamsSchema, UuidSchema } from "@/types/index.js";

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
